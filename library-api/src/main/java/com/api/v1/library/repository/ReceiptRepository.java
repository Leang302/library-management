package com.api.v1.library.repository;

import com.api.v1.library.model.entity.Receipt;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReceiptRepository extends JpaRepository<Receipt, Long> {

    Optional<Receipt> findByToken(String token);

    Optional<Receipt> findByNumberIgnoreCase(String number);

    boolean existsByNumber(String number);

    /** A student's receipts with every line's loan, book and copy in one SELECT. */
    @EntityGraph(attributePaths = {"member", "member.user", "staff", "lines", "lines.loan", "lines.loan.book", "lines.loan.copy"})
    List<Receipt> findByMemberIdOrderByUpdatedAtDesc(Long memberId);
}
