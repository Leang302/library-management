package com.api.v1.library.repository;

import com.api.v1.library.common.enumerates.CopyStatus;
import com.api.v1.library.model.entity.BookCopy;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface BookCopyRepository extends JpaRepository<BookCopy, String> {

    List<BookCopy> findByBookIdOrderByIdAsc(Long bookId);

    long countByStatus(CopyStatus status);

    long countByStatusNot(CopyStatus status);

    /** Rows of [bookId, status, count] — availability for a whole page of books in one query. */
    @Query("""
            select c.book.id, c.status, count(c) from BookCopy c
            where c.book.id in :bookIds
            group by c.book.id, c.status
            """)
    List<Object[]> countByBookAndStatus(@Param("bookIds") Collection<Long> bookIds);

    /** Row-locks copies for the duration of a checkout (SELECT ... FOR UPDATE). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from BookCopy c where c.id in :ids")
    List<BookCopy> lockAll(@Param("ids") Collection<String> ids);
}
