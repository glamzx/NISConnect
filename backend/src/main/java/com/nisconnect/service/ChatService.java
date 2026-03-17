package com.nisconnect.service;

import com.nisconnect.dto.ChatMessageResponse;
import com.nisconnect.model.ConversationEntity;
import com.nisconnect.model.MessageEntity;
import com.nisconnect.model.UserEntity;
import com.nisconnect.repository.ConversationRepository;
import com.nisconnect.repository.MessageRepository;
import com.nisconnect.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chat service — handles the async database persistence of messages.
 *
 * Architecture flow:
 *   1. ChatController receives STOMP message
 *   2. Controller immediately pushes the message to the recipient via WebSocket
 *   3. Controller calls saveMessageAsync() — fire-and-forget
 *   4. This service persists to MySQL on a background thread (chatDbExecutor)
 *   5. On failure, a delivery-failure notification is sent back to the sender
 *
 * This decoupling means the UI latency for message delivery is ~1-5ms (WebSocket push)
 * instead of ~20-50ms (WebSocket push + MySQL write).
 */
@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    private final ConversationRepository conversationRepo;
    private final MessageRepository messageRepo;
    private final UserRepository userRepo;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatService(ConversationRepository conversationRepo,
                       MessageRepository messageRepo,
                       UserRepository userRepo,
                       SimpMessagingTemplate messagingTemplate) {
        this.conversationRepo = conversationRepo;
        this.messageRepo = messageRepo;
        this.userRepo = userRepo;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Save a message to the database asynchronously.
     * Runs on the chatDbExecutor thread pool — does NOT block the WebSocket thread.
     *
     * @param senderId       The authenticated sender's user ID
     * @param recipientId    The intended recipient's user ID
     * @param content        Message text (nullable if attachment present)
     * @param attachmentPath File path for attachments (nullable)
     * @param attachmentType MIME type of attachment (nullable)
     */
    @Async("chatDbExecutor")
    @Transactional
    public void saveMessageAsync(Long senderId, Long recipientId,
                                 String content, String attachmentPath,
                                 String attachmentType) {
        try {
            // ── Find or create conversation ──────────────────
            Long userA = Math.min(senderId, recipientId);
            Long userB = Math.max(senderId, recipientId);

            ConversationEntity conversation = conversationRepo
                    .findByUserAAndUserB(userA, userB)
                    .orElseGet(() -> {
                        log.info("Creating new conversation between {} and {}", userA, userB);
                        return conversationRepo.save(new ConversationEntity(userA, userB));
                    });

            // ── Persist the message ──────────────────────────
            MessageEntity message = new MessageEntity(
                    conversation.getId(), senderId,
                    content, attachmentPath, attachmentType
            );
            messageRepo.save(message);

            // ── Touch conversation timestamp ─────────────────
            conversationRepo.touchUpdatedAt(conversation.getId());

            log.debug("Message persisted: convId={}, msgId={}, sender={}",
                    conversation.getId(), message.getId(), senderId);

        } catch (Exception e) {
            log.error("Failed to persist message from {} to {}: {}",
                    senderId, recipientId, e.getMessage(), e);

            // Notify the sender that their message failed to save
            ChatMessageResponse failure = new ChatMessageResponse();
            failure.setContent("[System] Your message could not be saved. Please try again.");
            failure.setSenderId(0L);
            failure.setSenderName("System");

            messagingTemplate.convertAndSendToUser(
                    senderId.toString(), "/queue/messages", failure
            );
        }
    }

    /**
     * Get user details by ID (for building response DTOs).
     */
    public UserEntity getUserById(Long userId) {
        return userRepo.findById(userId).orElse(null);
    }

    /**
     * Get user by email (for authentication).
     */
    public UserEntity getUserByEmail(String email) {
        return userRepo.findByEmail(email).orElse(null);
    }
}
