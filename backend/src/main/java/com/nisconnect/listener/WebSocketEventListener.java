package com.nisconnect.listener;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Listens for WebSocket session lifecycle events.
 *
 * ── Connection Drop Handling ──────────────────────────────────
 * When a user's WebSocket connection drops (network issue, browser close, etc.):
 *   1. STOMP heartbeat misses trigger a SessionDisconnectEvent
 *   2. This listener removes the user from the online-users map
 *   3. Optionally broadcasts "user went offline" to their contacts
 *
 * The client-side handles reconnection via StompJS's built-in reconnectDelay.
 * On reconnect, a new SessionConnectEvent fires and the user is re-added.
 *
 * ── Scalability ───────────────────────────────────────────────
 * The ConcurrentHashMap tracks online users for this server instance.
 * For multi-instance deployment, swap to Redis Pub/Sub for presence tracking.
 */
@Component
public class WebSocketEventListener {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventListener.class);

    /**
     * Maps userId → WebSocket sessionId.
     * Thread-safe for concurrent connect/disconnect events.
     */
    private final Map<Long, String> onlineUsers = new ConcurrentHashMap<>();

    @EventListener
    public void handleConnect(SessionConnectEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        Map<String, Object> sessionAttrs = headers.getSessionAttributes();

        if (sessionAttrs != null && sessionAttrs.containsKey("userId")) {
            Long userId = (Long) sessionAttrs.get("userId");
            String wsSessionId = headers.getSessionId();

            onlineUsers.put(userId, wsSessionId);
            log.info("User connected: userId={}, wsSession={}, totalOnline={}",
                    userId, wsSessionId, onlineUsers.size());
        }
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        Map<String, Object> sessionAttrs = headers.getSessionAttributes();

        if (sessionAttrs != null && sessionAttrs.containsKey("userId")) {
            Long userId = (Long) sessionAttrs.get("userId");
            onlineUsers.remove(userId);

            log.info("User disconnected: userId={}, reason={}, totalOnline={}",
                    userId, event.getCloseStatus(), onlineUsers.size());

            // (Optional) Broadcast "user offline" to their contacts:
            // messagingTemplate.convertAndSend("/topic/presence",
            //     Map.of("userId", userId, "status", "offline"));
        }
    }

    /**
     * Check if a user is currently online (has an active WebSocket connection).
     */
    public boolean isOnline(Long userId) {
        return onlineUsers.containsKey(userId);
    }

    /**
     * Get the count of currently connected users.
     */
    public int getOnlineCount() {
        return onlineUsers.size();
    }
}
