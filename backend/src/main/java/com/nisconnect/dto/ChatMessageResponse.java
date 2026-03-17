package com.nisconnect.dto;

import java.time.Instant;

/**
 * Outbound DTO — pushed to the recipient via STOMP on /user/{id}/queue/messages
 */
public class ChatMessageResponse {

    private Long id;
    private Long conversationId;
    private Long senderId;
    private String senderName;
    private String senderAvatar;
    private String content;
    private String attachmentPath;
    private String attachmentType;
    private Instant createdAt;

    // ── Builder-style static factory ─────────────────────────

    public static ChatMessageResponse of(Long senderId, String senderName, String senderAvatar,
                                          String content, String attachmentPath, String attachmentType) {
        ChatMessageResponse r = new ChatMessageResponse();
        r.senderId = senderId;
        r.senderName = senderName;
        r.senderAvatar = senderAvatar;
        r.content = content;
        r.attachmentPath = attachmentPath;
        r.attachmentType = attachmentType;
        r.createdAt = Instant.now();
        return r;
    }

    // ── Getters & Setters ────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }

    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getSenderAvatar() { return senderAvatar; }
    public void setSenderAvatar(String senderAvatar) { this.senderAvatar = senderAvatar; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getAttachmentPath() { return attachmentPath; }
    public void setAttachmentPath(String attachmentPath) { this.attachmentPath = attachmentPath; }

    public String getAttachmentType() { return attachmentType; }
    public void setAttachmentType(String attachmentType) { this.attachmentType = attachmentType; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
