package com.nisconnect.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * JPA entity mapped to the existing `conversations` table.
 * Each conversation is a 1-to-1 thread between two users.
 * Convention: user_a < user_b (lower ID always stored first).
 */
@Entity
@Table(name = "conversations",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_a", "user_b"}))
public class ConversationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_a", nullable = false)
    private Long userA;

    @Column(name = "user_b", nullable = false)
    private Long userB;

    @Column(name = "updated_at", nullable = false,
            insertable = false, updatable = false)
    private Instant updatedAt;

    // ── Constructors ─────────────────────────────────────────

    public ConversationEntity() {}

    public ConversationEntity(Long userA, Long userB) {
        // Always store the lower ID as userA
        this.userA = Math.min(userA, userB);
        this.userB = Math.max(userA, userB);
    }

    // ── Getters & Setters ────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserA() { return userA; }
    public void setUserA(Long userA) { this.userA = userA; }

    public Long getUserB() { return userB; }
    public void setUserB(Long userB) { this.userB = userB; }

    public Instant getUpdatedAt() { return updatedAt; }
}
