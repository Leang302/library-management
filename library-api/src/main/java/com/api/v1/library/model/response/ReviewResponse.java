package com.api.v1.library.model.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Everything the librarian needs to decide on a checkout request. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewResponse {

    private BorrowRequestResponse request;
    private MemberResponse member;
    private List<CheckResponse> checks;
    private List<Item> items;

    /** True when every check passes and the request can be approved now. */
    private boolean ok;

    private int scanned;
    private boolean needScan;

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
        private boolean ok;
        private String issue;
    }
}
