package com.api.v1.library.model.entity;

import com.api.v1.library.common.enumerates.CopyStatus;
import com.api.v1.library.common.enumerates.ItemCondition;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/** One physical copy. Its id (BOOKCOPY-000001) is what the QR label inside the book encodes. */
@Entity
@Table(name = "book_copies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookCopy {

    @Id
    @Column(length = 20)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CopyStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_condition", length = 20)
    private ItemCondition condition;

    private String note;

    /** Optimistic lock: two desks can never both lend the same copy. */
    @Version
    private Long version;

    @CreationTimestamp
    @Column(name = "acquired_at", updatable = false)
    private Instant acquiredAt;
}
