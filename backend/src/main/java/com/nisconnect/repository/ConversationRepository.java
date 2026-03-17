package com.nisconnect.repository;

import com.nisconnect.model.ConversationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<ConversationEntity, Long> {

    /**
     * Find a conversation between two users.
     * Always pass the lower ID as userA to match the table invariant.
     */
    Optional<ConversationEntity> findByUserAAndUserB(Long userA, Long userB);

    /**
     * Touch the updated_at timestamp on a conversation (MySQL ON UPDATE CURRENT_TIMESTAMP).
     * We do a dummy update to trigger the auto-update.
     */
    @Modifying
    @Query("UPDATE ConversationEntity c SET c.userA = c.userA WHERE c.id = :convId")
    void touchUpdatedAt(Long convId);
}
