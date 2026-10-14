package com.api.v1.library.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 40)
    private String type;

    @Column(nullable = false)
    private String title;

    @Column(length = 1000)
    private String body;

    /** App screen to open, e.g. "mybooks", "receipt", "requestReview". */
    @Column(name = "link_to", length = 40)
    private String linkTo;

    @Column(name = "link_id")
    private Long linkId;

    @Column(name = "is_read", nullable = false)
    private boolean read;

    /** Not a creation timestamp: an updated receipt notification is bumped back to the top. */
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
