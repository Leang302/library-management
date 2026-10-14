package com.api.v1.library.repository;

import com.api.v1.library.model.entity.AuditLog;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    @EntityGraph(attributePaths = "user")
    Page<AuditLog> findAllBy(Pageable pageable);

    /** Keeps the log lines (their text names the person) when an account is deleted. */
    @Modifying
    @Query("update AuditLog a set a.user = null where a.user.id = :userId")
    int detachUser(@Param("userId") Long userId);
}
