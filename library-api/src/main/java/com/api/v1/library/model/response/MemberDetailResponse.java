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
public class MemberDetailResponse {

    private MemberResponse member;
    private List<LoanResponse> loans;
    private List<ReservationResponse> reservations;
    private EligibilityResponse eligibility;
}
