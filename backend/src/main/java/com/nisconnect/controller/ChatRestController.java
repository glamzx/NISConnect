package com.nisconnect.controller;

import com.nisconnect.model.MessageEntity;
import com.nisconnect.repository.ConversationRepository;
import com.nisconnect.repository.MessageRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST endpoints for chat history — used as a fallback when WebSocket reconnects.
 *
 * After a connection drop, the client:
 *   1. Reconnects via STOMP
 *   2. Calls GET /api/chat?with={userId}&after={lastMsgId} to fetch missed messages
 *   3. Resumes real-time flow
 */
@RestController
@RequestMapping("/api/chat")
public class ChatRestController {

    private final MessageRepository messageRepo;
    private final ConversationRepository conversationRepo;

    public ChatRestController(MessageRepository messageRepo,
                              ConversationRepository conversationRepo) {
        this.messageRepo = messageRepo;
        this.conversationRepo = conversationRepo;
    }

    /**
     * GET /api/chat?with={userId}&after={lastMsgId}
     * Fetch messages with a specific user after a given message ID.
     * Used for reconnection catch-up.
     */
    @GetMapping
    public ResponseEntity<?> getMessages(
            @RequestParam("with") Long otherUserId,
            @RequestParam(value = "after", required = false) Long afterMessageId,
            HttpServletRequest request) {

        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false, "message", "Not authenticated."));
        }

        Long currentUser = (Long) session.getAttribute("userId");
        Long userA = Math.min(currentUser, otherUserId);
        Long userB = Math.max(currentUser, otherUserId);

        var conv = conversationRepo.findByUserAAndUserB(userA, userB);
        if (conv.isEmpty()) {
            return ResponseEntity.ok(Map.of("success", true, "messages", List.of()));
        }

        List<MessageEntity> messages;
        if (afterMessageId != null) {
            // Reconnection catch-up: only messages after the last seen ID
            messages = messageRepo.findMessagesAfter(conv.get().getId(), afterMessageId);
        } else {
            // Full history (paginated, last 200 messages)
            messages = messageRepo.findByConversationIdOrderByCreatedAtAsc(
                    conv.get().getId(), PageRequest.of(0, 200));
        }

        return ResponseEntity.ok(Map.of("success", true, "messages", messages));
    }

    /**
     * POST /api/chat/read?with={userId}
     * Mark all messages from a user as read.
     */
    @PostMapping("/read")
    @Transactional
    public ResponseEntity<?> markAsRead(
            @RequestParam("with") Long otherUserId,
            HttpServletRequest request) {

        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false, "message", "Not authenticated."));
        }

        Long currentUser = (Long) session.getAttribute("userId");
        Long userA = Math.min(currentUser, otherUserId);
        Long userB = Math.max(currentUser, otherUserId);

        var conv = conversationRepo.findByUserAAndUserB(userA, userB);
        if (conv.isEmpty()) {
            return ResponseEntity.ok(Map.of("success", true, "updated", 0));
        }

        int updated = messageRepo.markAsRead(conv.get().getId(), currentUser);
        return ResponseEntity.ok(Map.of("success", true, "updated", updated));
    }
}
