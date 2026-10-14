package com.api.v1.library.model.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberCardResponse {

    private MemberResponse member;

    /** LMS-MEM:&lt;token&gt; — shown as a QR on the student's digital membership card. */
    private String qrPayload;
}
