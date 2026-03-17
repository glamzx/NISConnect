package com.nisconnect.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Inbound DTO — sent by the client via STOMP to /app/chat.send
 */
public class ChatMessageRequest {

    @NotNull(message = "recipientId is required")
    private Long recipientId;

    private String content;
    private String attachmentPath;
    private String attachmentType;

    // Used for reconnection: client sends the last message ID it received
    private Long lastSeenMessageId;

    // ── Getters & Setters ────────────────────────────────────

    public Long getRecipientId() { return recipientId; }
    public void setRecipientId(Long recipientId) { this.recipientId = recipientId; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getAttachmentPath() { return attachmentPath; }
    public void setAttachmentPath(String attachmentPath) { this.attachmentPath = attachmentPath; }

    public String getAttachmentType() { return attachmentType; }
    public void setAttachmentType(String attachmentType) { this.attachmentType = attachmentType; }

    public Long getLastSeenMessageId() { return lastSeenMessageId; }
    public void setLastSeenMessageId(Long lastSeenMessageId) { this.lastSeenMessageId = lastSeenMessageId; }
}
