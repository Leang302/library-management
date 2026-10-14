package com.api.v1.library.model.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** What will happen if this copy is checked in now. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReturnPreviewResponse {

    private CopyResponse copy;
    private BookResponse book;
    private LoanResponse loan;
    private MemberResponse member;
}
