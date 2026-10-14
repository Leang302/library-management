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
public class ReportsResponse {

    private int days;
    private long borrowed;
    private long returned;
    private long overdue;
    private long lost;
    private long totalCopies;
    private long totalTitles;
    private long activeMembers;
    private long newMembers;
    private List<TopBook> topBooks;
    private List<CategoryCount> categories;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopBook {
        private Long bookId;
        private String title;
        private long count;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CategoryCount {
        private String name;
        private long count;
    }
}
