package com.api.v1.library.repository;

import com.api.v1.library.common.enumerates.ReservationStatus;
import com.api.v1.library.model.entity.Reservation;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    /** The waiting queue for a title, first come first served. */
    @EntityGraph(attributePaths = {"member", "member.user"})
    List<Reservation> findByBookIdAndStatusOrderByCreatedAtAscIdAsc(Long bookId, ReservationStatus status);

    /** Waiting queues for many titles at once, to work out queue positions in one query. */
    List<Reservation> findByBookIdInAndStatusOrderByCreatedAtAscIdAsc(Collection<Long> bookIds, ReservationStatus status);

    @EntityGraph(attributePaths = {"book", "member", "member.user", "copy"})
    List<Reservation> findByMemberIdOrderByCreatedAtDesc(Long memberId);

    @EntityGraph(attributePaths = {"book", "member", "member.user", "copy"})
    Page<Reservation> findByStatus(ReservationStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"book", "member", "member.user", "copy"})
    Page<Reservation> findAllBy(Pageable pageable);

    Optional<Reservation> findFirstByCopyIdAndStatus(String copyId, ReservationStatus status);

    Optional<Reservation> findFirstByMemberIdAndBookIdAndStatusIn(Long memberId, Long bookId,
                                                                  Collection<ReservationStatus> statuses);

    boolean existsByBookIdAndStatusIn(Long bookId, Collection<ReservationStatus> statuses);

    @EntityGraph(attributePaths = {"copy", "copy.book"})
    List<Reservation> findByStatusAndHoldUntilBefore(ReservationStatus status, Instant now);
}
