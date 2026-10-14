package com.api.v1.library.model.response;

import com.api.v1.library.common.enumerates.MemberStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberResponse {

    private Long id;
    private Long userId;
    private String name;
    private String email;
    private String studentId;
    private String program;
    private Integer year;
    private MemberStatus status;
    private Instant joinedAt;
    private Instant expiresAt;
    private int activeLoans;
    private int overdueLoans;
}
