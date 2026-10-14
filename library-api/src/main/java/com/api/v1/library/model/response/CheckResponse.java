package com.api.v1.library.model.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One line of an eligibility / approval checklist. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckResponse {

    private String key;
    private String label;
    private boolean ok;
    private String detail;
}
