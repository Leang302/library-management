package com.api.v1.library.model.response;

import com.api.v1.library.common.enumerates.CopyStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReturnResultResponse {

    private LoanResponse loan;

    /** AVAILABLE, RESERVED (held for the next in the queue) or MAINTENANCE (returned damaged). */
    private CopyStatus copyStatus;

    /** Name of the member the copy is now held for, when it went to the reservation queue. */
    private String heldForName;

    private ReceiptResponse receipt;
}
