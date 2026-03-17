-- ============================================================
-- V2: Optimize Messages Schema for Real-Time Chat
-- ============================================================
-- Run this migration AFTER the existing schema.sql.
-- These changes improve read performance without impacting write speed.
-- ============================================================

-- ── 1. Composite index for fast message retrieval ────────────
-- Covers: "get messages for conversation X, ordered by time"
-- This replaces the single-column idx_msg_conv for queries that ORDER BY created_at
CREATE INDEX idx_msg_conv_created
    ON messages (conversation_id, created_at DESC);

-- ── 2. Read-status tracking ─────────────────────────────────
-- Used for unread message counts without scanning entire conversation
ALTER TABLE messages
    ADD COLUMN read_status TINYINT(1) NOT NULL DEFAULT 0
    AFTER attachment_type;

-- Index for unread-count queries:
-- SELECT COUNT(*) WHERE conversation_id=? AND sender_id!=? AND read_status=0
CREATE INDEX idx_msg_unread
    ON messages (conversation_id, sender_id, read_status);

-- ── 3. Covering index for conversation listing ──────────────
-- Covers: "list all conversations for user X, sorted by updated_at"
-- Avoids a table lookup when the query only needs these columns
CREATE INDEX idx_conv_users
    ON conversations (user_a, user_b, updated_at DESC);

-- ============================================================
-- Index Strategy Rationale
-- ============================================================
--
-- Write impact: Minimal. MySQL InnoDB (B+Tree) indexes add ~5-10%
-- overhead per INSERT. With 3 additional indexes on a table that
-- receives ~1 INSERT/write (messages), this is negligible.
--
-- Read benefit: Major.
--   - idx_msg_conv_created: turns O(n) scan → O(log n) seek for
--     loading chat history. Critical for conversations with 1000+ messages.
--   - idx_msg_unread: turns unread count from full-table scan → index-only scan.
--   - idx_conv_users: eliminates table lookup for conversation list queries.
--
-- Memory: Each index adds ~30-50 bytes per row. For 1M messages,
-- that's ~30-50 MB of additional index size — well within typical
-- buffer pool sizes.
-- ============================================================
