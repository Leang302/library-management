package com.api.v1.library.model.response;

import com.api.v1.library.common.enumerates.RequestStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BorrowRequestResponse {

    private Long id;
    private String code;

    /** LMS-REQ:&lt;token&gt; — only filled for the student who owns the request. */
    private String qrPayload;

    private Long memberId;
    private String memberName;
    private String studentId;
    private RequestStatus status;
    private Instant requestedAt;
    private Instant expiresAt;
    private Instant processedAt;
    private String processedByName;
    private String rejectReason;
    private List<Item> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Item {
        private Long id;
        private String copyId;
        private Long bookId;
        private String bookTitle;
        private String bookAuthor;
        private boolean verified;
        private String swappedFrom;
    }
}
