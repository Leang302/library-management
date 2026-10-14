package com.api.v1.library.model.response;

import com.api.v1.library.common.enumerates.ReservationStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReservationResponse {

    private Long id;
    private Long bookId;
    private String bookTitle;
    private Long memberId;
    private String memberName;
    private ReservationStatus status;

    /** Place in the queue while WAITING (1 = next), otherwise 0. */
    private int position;

    private String copyId;
    private Instant readyAt;
    private Instant holdUntil;
    private Instant createdAt;
}
