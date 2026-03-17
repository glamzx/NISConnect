package com.nisconnect.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Async configuration for background database writes.
 *
 * When a message is sent via WebSocket, the flow is:
 *   1. Push message to recipient instantly (via STOMP)
 *   2. Fire-and-forget the DB persist to this async executor
 *
 * This decouples message delivery latency from MySQL write latency.
 * The executor has a bounded queue to prevent OOM under extreme load.
 *
 * Tuning (via application.yml → app.async.*):
 *   core-pool-size  : 4    — threads always alive, handles normal load
 *   max-pool-size   : 10   — burst capacity for message spikes
 *   queue-capacity  : 500  — backpressure buffer before rejecting
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Value("${app.async.core-pool-size:4}")
    private int corePoolSize;

    @Value("${app.async.max-pool-size:10}")
    private int maxPoolSize;

    @Value("${app.async.queue-capacity:500}")
    private int queueCapacity;

    @Value("${app.async.thread-name-prefix:chat-db-}")
    private String threadNamePrefix;

    @Bean(name = "chatDbExecutor")
    public Executor chatDbExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(corePoolSize);
        executor.setMaxPoolSize(maxPoolSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix(threadNamePrefix);
        executor.setRejectedExecutionHandler((r, e) -> {
            // Log the rejection — this means the queue is full (500+ pending writes)
            // In production, consider pushing to a dead-letter queue
            org.slf4j.LoggerFactory.getLogger(AsyncConfig.class)
                    .error("Chat DB write rejected — queue full! Message may be lost.");
        });
        executor.initialize();
        return executor;
    }
}
