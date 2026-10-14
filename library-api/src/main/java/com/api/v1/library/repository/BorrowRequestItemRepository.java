package com.api.v1.library.repository;

import com.api.v1.library.common.enumerates.RequestStatus;
import com.api.v1.library.model.entity.BorrowRequestItem;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BorrowRequestItemRepository extends JpaRepository<BorrowRequestItem, Long> {

    /** Pending-request items holding this copy (a soft lock on the copy). */
    @Query("""
            select i from BorrowRequestItem i
            where i.copy.id = :copyId and i.request.status = :status
            """)
    List<BorrowRequestItem> findByCopyIdAndRequestStatus(@Param("copyId") String copyId,
                                                         @Param("status") RequestStatus status);

    boolean existsByBookId(Long bookId);
}
