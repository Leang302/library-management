package com.api.v1.library.model.entity;

import com.api.v1.library.common.enumerates.MemberStatus;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Owning side of the one-to-one with User: "members" holds a unique "user_id" FK. */
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    /** Number printed on the physical student ID card, e.g. STU-10231. */
    @Column(name = "student_id", nullable = false, unique = true)
    private String studentId;

    private String program;

    @Column(name = "study_year")
    private Integer year;

    /** Opaque token encoded in the membership card QR (LMS-MEM:token). */
    @Column(name = "member_token", nullable = false, unique = true)
    private String memberToken;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MemberStatus status;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** Copy ids the student scanned but has not checked out yet. Copy status is NOT changed. */
    @Builder.Default
    @ElementCollection
    @CollectionTable(name = "member_cart", joinColumns = @JoinColumn(name = "member_id"))
    @OrderColumn(name = "position")
    @Column(name = "copy_id")
    private List<String> cart = new ArrayList<>();
}
