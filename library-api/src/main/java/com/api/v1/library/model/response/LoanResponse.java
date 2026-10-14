package com.api.v1.library.model.response;

import com.api.v1.library.common.enumerates.ItemCondition;
import com.api.v1.library.common.enumerates.LoanStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoanResponse {

    private Long id;
    private Long requestId;
    private String copyId;
    private Long bookId;
    private String bookTitle;
    private String bookAuthor;
    private Long memberId;
    private String memberName;
    private String studentId;
    private Instant borrowedAt;
    private Instant dueAt;
    private Instant returnedAt;
    private LoanStatus status;
    private ItemCondition condition;

    /** Days past the due date (at return, or as of now for open loans). Late returns cost nothing in the MVP. */
    private int daysLate;
}
