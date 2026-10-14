package com.api.v1.library.repository;

import com.api.v1.library.common.enumerates.RequestStatus;
import com.api.v1.library.model.entity.BorrowRequest;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface BorrowRequestRepository extends JpaRepository<BorrowRequest, Long> {

    Optional<BorrowRequest> findByToken(String token);

    Optional<BorrowRequest> findByCodeIgnoreCase(String code);

    boolean existsByCode(String code);

    Optional<BorrowRequest> findFirstByMemberIdAndStatusOrderByRequestedAtDesc(Long memberId, RequestStatus status);

    /** Lists fetch the student, items and their books in one SELECT. */
    @EntityGraph(attributePaths = {"member", "member.user", "processedBy", "items", "items.book", "items.copy"})
    List<BorrowRequest> findByStatusOrderByRequestedAtAsc(RequestStatus status);

    @EntityGraph(attributePaths = {"member", "member.user", "processedBy", "items", "items.book", "items.copy"})
    List<BorrowRequest> findAllByOrderByRequestedAtDesc();

    /** Pages fetch the student in the same SELECT; items load in one batch (default_batch_fetch_size). */
    @EntityGraph(attributePaths = {"member", "member.user", "processedBy"})
    Page<BorrowRequest> findByStatus(RequestStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"member", "member.user", "processedBy"})
    Page<BorrowRequest> findAllBy(Pageable pageable);

    long countByStatus(RequestStatus status);

    List<BorrowRequest> findByStatusAndExpiresAtBefore(RequestStatus status, Instant now);

    /** Row-locks the request so it can only be approved once, even from two desks. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from BorrowRequest r where r.id = :id")
    Optional<BorrowRequest> lockById(@Param("id") Long id);
}
