package com.nisconnect.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.List;

/**
 * WebSocket + STOMP configuration.
 *
 * Architecture:
 *   Client  ──▸  /ws (SockJS)  ──▸  STOMP frames
 *
 * Destination prefixes:
 *   /app/**          — messages routed to @MessageMapping controllers
 *   /topic/**        — broadcast (e.g., online-status updates)
 *   /queue/**        — user-specific queues (private messages)
 *
 * Heartbeat:
 *   Server sends a heartbeat every 10s, expects one from the client every 10s.
 *   If no heartbeat arrives for 3 missed intervals, the connection is considered
 *   dead and a SessionDisconnectEvent fires.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${app.websocket.allowed-origins:http://localhost:3000}")
    private List<String> allowedOrigins;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // In-memory broker for /topic (broadcast) and /queue (per-user)
        // For production scale (1000+ concurrent), swap to:
        //   registry.enableStompBrokerRelay("/topic", "/queue")
        //           .setRelayHost("rabbitmq-host").setRelayPort(61613);
        registry.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[]{10000, 10000})  // server-send, server-receive (ms)
                .setTaskScheduler(heartbeatScheduler());

        // All @MessageMapping destinations are prefixed with /app
        registry.setApplicationDestinationPrefixes("/app");

        // User-specific destinations: /user/{userId}/queue/messages
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins(allowedOrigins.toArray(String[]::new))
                .addInterceptors(new HttpHandshakeInterceptor())
                .withSockJS();  // Fallback for browsers that don't support WS
    }

    /**
     * Task scheduler required for heartbeat.
     */
    @org.springframework.context.annotation.Bean
    public org.springframework.scheduling.TaskScheduler heartbeatScheduler() {
        var scheduler = new org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("ws-heartbeat-");
        return scheduler;
    }
}
