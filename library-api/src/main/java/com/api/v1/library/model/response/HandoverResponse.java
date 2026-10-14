package com.api.v1.library.model.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HandoverResponse {

    /** True when the desk handed over a different copy of the same title and the request switched to it. */
    private boolean swapped;
    private String from;
    private String copyId;
    private String bookTitle;
    private ReviewResponse review;
}
