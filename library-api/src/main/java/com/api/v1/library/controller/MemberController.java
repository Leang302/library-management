package com.api.v1.library.controller;

import com.api.v1.library.common.response.PaginationResponse;
import com.api.v1.library.common.response.SuccessResponse;
import com.api.v1.library.model.response.MemberDetailResponse;
import com.api.v1.library.model.response.MemberResponse;
import com.api.v1.library.model.update.MemberStatusUpdate;
import com.api.v1.library.service.MemberService;
import com.api.v1.library.util.APIResponseUtil;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/members")
@RequiredArgsConstructor
@Validated
@Tag(name = "Members", description = "Library members (librarians)")
public class MemberController {
    private final MemberService memberService;

    @GetMapping
    @Operation(summary = "Search members by name, email or student ID")
    public ResponseEntity<PaginationResponse<List<MemberResponse>>> list(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "ASC") Sort.Direction direction,
            @RequestParam(required = false) String q
    ) {
        return ResponseEntity.ok(
                APIResponseUtil.pagination(HttpStatus.OK, memberService.list(page, size, direction, q), "Members retrieved successfully")
        );
    }

    @GetMapping("/{id}")
    @Operation(summary = "Member record with loans, reservations and eligibility")
    public ResponseEntity<SuccessResponse<MemberDetailResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, memberService.get(id), "Member retrieved successfully"));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Suspend or reactivate a membership")
    public ResponseEntity<SuccessResponse<MemberResponse>> updateStatus(@PathVariable Long id, @Valid @RequestBody MemberStatusUpdate request) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, memberService.updateStatus(id, request), "Member updated successfully"));
    }

    @PostMapping("/{id}/renew")
    @Operation(summary = "Renew membership for a year")
    public ResponseEntity<SuccessResponse<MemberResponse>> renew(@PathVariable Long id) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, memberService.renew(id), "Membership renewed successfully"));
    }
}
