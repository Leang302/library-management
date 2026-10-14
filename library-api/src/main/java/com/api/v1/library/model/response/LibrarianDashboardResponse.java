package com.api.v1.library.model.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LibrarianDashboardResponse {

    private long borrowedToday;
    private long returnedToday;
    private long pending;
    private long overdue;
    private long activeMembers;
    private long availableCopies;
    private List<LoanResponse> dueToday;
    private List<BorrowRequestResponse> pendingRequests;
    private List<DayStat> last7;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DayStat {
        private String label;
        private long borrowed;
        private long returned;
    }
}
