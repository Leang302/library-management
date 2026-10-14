package com.api.v1.library.model.response;

import com.api.v1.library.common.enumerates.ItemCondition;

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
public class ReceiptResponse {

    private Long id;
    private String type;
    private String number;

    /** LMS-RCT:&lt;token&gt; — staff scan it to confirm the receipt is genuine. */
    private String qrPayload;

    private Long memberId;
    private String memberName;
    private String staffName;
    private Instant createdAt;
    private List<Line> lines;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Line {
        private String copyId;
        private String bookTitle;
        private Instant dueAt;
        private Instant returnedAt;
        private ItemCondition condition;
        private int daysLate;
    }
}
