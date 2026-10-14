package com.api.v1.library.controller;

import com.api.v1.library.common.enumerates.RequestStatus;
import com.api.v1.library.common.response.PaginationResponse;
import com.api.v1.library.common.response.SuccessResponse;
import com.api.v1.library.model.request.CodeRequest;
import com.api.v1.library.model.request.ReasonRequest;
import com.api.v1.library.model.response.ApproveResponse;
import com.api.v1.library.model.response.BorrowRequestResponse;
import com.api.v1.library.model.response.HandoverResponse;
import com.api.v1.library.model.response.ReviewResponse;
import com.api.v1.library.service.CheckoutService;
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
@RequestMapping("/api/v1/requests")
@RequiredArgsConstructor
@Validated
@Tag(name = "Checkout requests", description = "Review, hand over and approve students' checkout passes")
public class RequestController {
    private final CheckoutService checkoutService;

    @GetMapping
    @Operation(summary = "List checkout requests, optionally by status")
    public ResponseEntity<PaginationResponse<List<BorrowRequestResponse>>> list(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "DESC") Sort.Direction direction,
            @RequestParam(required = false) RequestStatus status
    ) {
        return ResponseEntity.ok(
                APIResponseUtil.pagination(HttpStatus.OK, checkoutService.list(page, size, direction, status), "Requests retrieved successfully")
        );
    }

    @GetMapping("/{id}/review")
    @Operation(summary = "Checks and items for one request")
    public ResponseEntity<SuccessResponse<ReviewResponse>> review(@PathVariable Long id) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, checkoutService.review(id), "Review retrieved successfully"));
    }

    @PostMapping("/{id}/handover")
    @Operation(summary = "Scan a physical book being handed over")
    public ResponseEntity<SuccessResponse<HandoverResponse>> handover(@PathVariable Long id, @Valid @RequestBody CodeRequest request) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, checkoutService.handover(id, request.getCode()), "Book scanned"));
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "Approve: lend the books and set due dates")
    public ResponseEntity<SuccessResponse<ApproveResponse>> approve(@PathVariable Long id) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, checkoutService.approve(id), "Checkout approved"));
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Reject with a reason shown to the student")
    public ResponseEntity<SuccessResponse<BorrowRequestResponse>> reject(@PathVariable Long id,
                                                                         @Valid @RequestBody(required = false) ReasonRequest request) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK,
                checkoutService.reject(id, request == null ? null : request.getReason()), "Checkout rejected"));
    }
}
