package com.api.v1.library.repository;

import com.api.v1.library.common.enumerates.LoanStatus;
import com.api.v1.library.model.entity.Loan;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * List queries fetch the book, copy and borrower in the same SELECT ({@link EntityGraph}),
 * so mapping a page of loans never triggers one query per row.
 */
@Repository
public interface LoanRepository extends JpaRepository<Loan, Long> {

    @EntityGraph(attributePaths = {"book", "copy", "member", "member.user"})
    List<Loan> findByMemberIdAndStatusInOrderByDueAtAsc(Long memberId, Collection<LoanStatus> statuses);

    @EntityGraph(attributePaths = {"book", "copy", "member", "member.user"})
    List<Loan> findByMemberIdAndStatusOrderByReturnedAtDesc(Long memberId, LoanStatus status);

    @EntityGraph(attributePaths = {"book", "copy", "member", "member.user"})
    List<Loan> findByMemberIdOrderByBorrowedAtDesc(Long memberId);

    @EntityGraph(attributePaths = {"book", "copy", "member", "member.user"})
    Optional<Loan> findFirstByCopyIdAndStatusIn(String copyId, Collection<LoanStatus> statuses);

    /** Open loans for many copies at once (staff copy lists). */
    @EntityGraph(attributePaths = {"book", "copy", "member", "member.user"})
    List<Loan> findByCopyIdInAndStatusIn(Collection<String> copyIds, Collection<LoanStatus> statuses);

    @EntityGraph(attributePaths = {"book", "copy", "member", "member.user"})
    List<Loan> findByStatusIn(Collection<LoanStatus> statuses);

    @EntityGraph(attributePaths = {"book", "copy", "member", "member.user"})
    List<Loan> findByBorrowedAtAfter(Instant from);

    @EntityGraph(attributePaths = {"book", "copy", "member", "member.user"})
    List<Loan> findByReturnedAtAfter(Instant from);

    long countByStatus(LoanStatus status);

    boolean existsByMemberId(Long memberId);

    boolean existsByBookId(Long bookId);

    boolean existsByApprovedByIdOrReturnedToId(Long approvedById, Long returnedToId);

    /** Rows of [memberId, status, count] — open-loan counts for a whole page of members in one query. */
    @Query("""
            select l.member.id, l.status, count(l) from Loan l
            where l.member.id in :memberIds and l.status in :statuses
            group by l.member.id, l.status
            """)
    List<Object[]> countByMemberAndStatus(@Param("memberIds") Collection<Long> memberIds,
                                          @Param("statuses") Collection<LoanStatus> statuses);

    /** One page of loans; pass "" (not null) for q to match everything. */
    @EntityGraph(attributePaths = {"book", "copy", "member", "member.user"})
    @Query(value = """
            select l from Loan l join l.member m join m.user u join l.book b
            where l.status in :statuses
              and (lower(u.name) like lower(concat('%', :q, '%'))
                   or lower(m.studentId) like lower(concat('%', :q, '%'))
                   or lower(b.title) like lower(concat('%', :q, '%'))
                   or lower(l.copy.id) like lower(concat('%', :q, '%')))
            """,
            countQuery = """
            select count(l) from Loan l join l.member m join m.user u join l.book b
            where l.status in :statuses
              and (lower(u.name) like lower(concat('%', :q, '%'))
                   or lower(m.studentId) like lower(concat('%', :q, '%'))
                   or lower(b.title) like lower(concat('%', :q, '%'))
                   or lower(l.copy.id) like lower(concat('%', :q, '%')))
            """)
    Page<Loan> search(@Param("statuses") Collection<LoanStatus> statuses, @Param("q") String q, Pageable pageable);
}
