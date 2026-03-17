package com.nisconnect.config;

import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * Intercepts the WebSocket handshake to enforce cookie-based authentication.
 *
 * Flow:
 *   1. Browser sends the initial HTTP upgrade request with the session cookie.
 *   2. This interceptor extracts the session and checks for a valid userId.
 *   3. If valid, the userId is placed into the WebSocket session attributes
 *      so controllers can access it via Principal or session map.
 *   4. If invalid, the handshake is rejected with a 403.
 *
 * This ensures no unauthenticated user can open a WebSocket connection.
 */
public class HttpHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(HttpHandshakeInterceptor.class);

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes) {

        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpSession session = servletRequest.getServletRequest().getSession(false);

            if (session != null) {
                Object userId = session.getAttribute("userId");
                if (userId != null) {
                    // Store in WS session attributes — accessible in ChatController
                    attributes.put("userId", userId);
                    attributes.put("sessionId", session.getId());
                    log.debug("WebSocket handshake authorized for userId={}", userId);
                    return true;
                }
            }

            log.warn("WebSocket handshake rejected — no valid session");
            return false;
        }

        return false;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception) {
        // No-op — logging is done in beforeHandshake
    }
}
