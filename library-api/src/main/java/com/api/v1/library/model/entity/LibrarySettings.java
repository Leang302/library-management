package com.api.v1.library.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Borrowing policy, editable by librarians. Single row with id = 1. */
@Entity
@Table(name = "library_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LibrarySettings {

    public static final long SINGLETON_ID = 1L;

    @Id
    private Long id;

    @Builder.Default
    @Column(name = "library_name", nullable = false)
    private String libraryName = "Greenleaf Library";

    /** Max books a student can have on loan at once. */
    @Builder.Default
    @Column(name = "max_borrow", nullable = false)
    private int maxBorrow = 3;

    @Builder.Default
    @Column(name = "loan_days", nullable = false)
    private int loanDays = 14;

    /** How long a checkout QR stays valid, in minutes. */
    @Builder.Default
    @Column(name = "request_expiry_min", nullable = false)
    private int requestExpiryMin = 10;

    /** Students with an overdue book cannot borrow. */
    @Builder.Default
    @Column(name = "block_on_overdue", nullable = false)
    private boolean blockOnOverdue = true;

    /** Librarian must scan every book being handed over before approving. */
    @Builder.Default
    @Column(name = "require_handover_scan", nullable = false)
    private boolean requireHandoverScan = true;

    @Builder.Default
    @Column(name = "reservation_hold_days", nullable = false)
    private int reservationHoldDays = 3;

    @Builder.Default
    @Column(name = "due_soon_days", nullable = false)
    private int dueSoonDays = 3;

    /** Sequence for BOOKCOPY-###### identifiers. */
    @Builder.Default
    @Column(name = "copy_seq", nullable = false)
    private long copySeq = 0;
}
