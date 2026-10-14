package com.api.v1.library.repository;

import com.api.v1.library.model.entity.Member;

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

@Repository
public interface MemberRepository extends JpaRepository<Member, Long> {

    @EntityGraph(attributePaths = "user")
    Optional<Member> findByUserId(Long userId);

    /** Member records for a whole page of users in one query. */
    @EntityGraph(attributePaths = "user")
    List<Member> findByUserIdIn(Collection<Long> userIds);

    Optional<Member> findByStudentIdIgnoreCase(String studentId);

    Optional<Member> findByMemberToken(String memberToken);

    boolean existsByStudentIdIgnoreCase(String studentId);

    /** One page of members; pass "" (not null) to match everyone. Sort by "user.name". */
    @EntityGraph(attributePaths = "user")
    @Query(value = """
            select m from Member m join m.user u
            where lower(u.name) like lower(concat('%', :q, '%'))
               or lower(u.email) like lower(concat('%', :q, '%'))
               or lower(m.studentId) like lower(concat('%', :q, '%'))
            """,
            countQuery = """
            select count(m) from Member m join m.user u
            where lower(u.name) like lower(concat('%', :q, '%'))
               or lower(u.email) like lower(concat('%', :q, '%'))
               or lower(m.studentId) like lower(concat('%', :q, '%'))
            """)
    Page<Member> search(@Param("q") String q, Pageable pageable);

    @Query("select count(m) from Member m where m.status = com.api.v1.library.common.enumerates.MemberStatus.ACTIVE and m.expiresAt > :now")
    long countValid(@Param("now") Instant now);

    long countByJoinedAtAfter(Instant from);
}
