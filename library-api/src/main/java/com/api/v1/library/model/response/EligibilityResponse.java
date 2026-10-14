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
public class EligibilityResponse {

    private boolean ok;
    private List<CheckResponse> checks;
    private List<String> errors;
    private int activeCount;
    private int overdueCount;
    private int remaining;
}
