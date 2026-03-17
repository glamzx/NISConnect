package com.nisconnect.controller;

import com.nisconnect.dto.ChatMessageRequest;
import com.nisconnect.dto.ChatMessageResponse;
import com.nisconnect.model.UserEntity;
import com.nisconnect.service.ChatService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Map;

/**
 * WebSocket chat controller — handles real-time messaging via STOMP.
 *
 * Endpoints (STOMP destinations):
 *   /app/chat.send    — send a message to another user
 *   /app/chat.typing  — broadcast typing indicator
 *
 * Client subscribes to:
 *   /user/{userId}/queue/messages  — receive private messages
 *   /user/{userId}/queue/typing    — receive typing indicators
 *
 * ── Connection Drop Handling ──────────────────────────────────
 * Server-side:
 *   - STOMP heartbeats (10s/10s) detect stale connections
 *   - SessionDisconnectEvent fires → WebSocketEventListener logs it
 *
 * Client-side (implement in your frontend JS):
 *   var stompClient = new StompJs.Client({
 *       brokerURL: 'ws://localhost:8080/ws',
 *       reconnectDelay: 5000,          // auto-reconnect after 5s
 *       heartbeatIncoming: 10000,
 *       heartbeatOutgoing: 10000,
 *       onConnect: function() {
 *           // Re-subscribe to your queue
 *           // Fetch missed messages via REST: GET /api/chat?with={userId}&after={lastMsgId}
 *       },
 *       onStompError: function(frame) {
 *           console.error('STOMP error:', frame.headers['message']);
 *       }
 *   });
 *   stompClient.activate();
 */
@Controller
public class ChatController {

    private static final Logger log = LoggerFactory.getLogger(ChatController.class);

    private final SimpMessagingTemplate messagingTemplate;
    private final ChatService chatService;

    public ChatController(SimpMessagingTemplate messagingTemplate, ChatService chatService) {
        this.messagingTemplate = messagingTemplate;
        this.chatService = chatService;
    }

    /**
     * Handle incoming chat messages.
     *
     * Flow:
     *   1. Extract sender from WebSocket session (set by HttpHandshakeInterceptor)
     *   2. Build the outbound DTO with sender metadata
     *   3. Push immediately to the recipient via STOMP → zero-latency delivery
     *   4. Fire async DB save → MySQL write happens in background
     */
    @MessageMapping("/chat.send")
    public void sendMessage(@Payload ChatMessageRequest request,
                            SimpMessageHeaderAccessor headerAccessor) {

        // ── Extract authenticated user from WS session ───────
        Long senderId = getUserIdFromSession(headerAccessor);
        if (senderId == null) {
            log.warn("Message rejected — no authenticated user in session");
            return;
        }

        // ── Validate ─────────────────────────────────────────
        if (request.getRecipientId() == null || request.getRecipientId().equals(senderId)) {
            log.warn("Invalid recipient: {}", request.getRecipientId());
            return;
        }
        if (isBlank(request.getContent()) && isBlank(request.getAttachmentPath())) {
            log.warn("Empty message from user {}", senderId);
            return;
        }

        // ── Build outbound message ───────────────────────────
        UserEntity sender = chatService.getUserById(senderId);
        ChatMessageResponse response = ChatMessageResponse.of(
                senderId,
                sender != null ? sender.getFullName() : "Unknown",
                sender != null ? sender.getAvatarUrl() : null,
                request.getContent(),
                request.getAttachmentPath(),
                request.getAttachmentType()
        );

        // ── 1. Push to recipient INSTANTLY via WebSocket ─────
        messagingTemplate.convertAndSendToUser(
                request.getRecipientId().toString(),
                "/queue/messages",
                response
        );

        // Also echo back to sender (so their UI confirms delivery)
        messagingTemplate.convertAndSendToUser(
                senderId.toString(),
                "/queue/messages",
                response
        );

        log.debug("Message pushed: {} → {}", senderId, request.getRecipientId());

        // ── 2. Persist to DB in background (fire-and-forget) ─
        chatService.saveMessageAsync(
                senderId,
                request.getRecipientId(),
                request.getContent(),
                request.getAttachmentPath(),
                request.getAttachmentType()
        );
    }

    /**
     * Handle typing indicators.
     * Lightweight — no DB write, just a push to the other user.
     */
    @MessageMapping("/chat.typing")
    public void typingIndicator(@Payload ChatMessageRequest request,
                                SimpMessageHeaderAccessor headerAccessor) {

        Long senderId = getUserIdFromSession(headerAccessor);
        if (senderId == null || request.getRecipientId() == null) return;

        UserEntity sender = chatService.getUserById(senderId);

        ChatMessageResponse typing = new ChatMessageResponse();
        typing.setSenderId(senderId);
        typing.setSenderName(sender != null ? sender.getFullName() : "Someone");
        typing.setContent("__TYPING__");  // Frontend checks for this sentinel value

        messagingTemplate.convertAndSendToUser(
                request.getRecipientId().toString(),
                "/queue/typing",
                typing
        );
    }

    // ── Helpers ──────────────────────────────────────────────

    private Long getUserIdFromSession(SimpMessageHeaderAccessor headerAccessor) {
        Map<String, Object> sessionAttrs = headerAccessor.getSessionAttributes();
        if (sessionAttrs == null) return null;
        Object userId = sessionAttrs.get("userId");
        return userId instanceof Long ? (Long) userId : null;
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
