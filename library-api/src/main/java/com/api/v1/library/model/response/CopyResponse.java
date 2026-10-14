package com.api.v1.library.model.response;

import com.api.v1.library.common.enumerates.CopyStatus;
import com.api.v1.library.common.enumerates.ItemCondition;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CopyResponse {

    private String id;
    private Long bookId;
    private String bookTitle;
    private CopyStatus status;
    private ItemCondition condition;
    private String note;

    /** Only filled for staff. */
    private LoanResponse currentLoan;
}
