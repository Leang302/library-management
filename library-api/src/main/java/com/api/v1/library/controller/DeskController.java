package com.api.v1.library.controller;

import com.api.v1.library.common.enumerates.ReservationStatus;
import com.api.v1.library.common.response.PaginationResponse;
import com.api.v1.library.common.response.SuccessResponse;
import com.api.v1.library.model.request.CodeRequest;
import com.api.v1.library.model.response.LoanResponse;
import com.api.v1.library.model.response.ReceiptResponse;
import com.api.v1.library.model.response.ReservationResponse;
import com.api.v1.library.model.response.ScanResolveResponse;
import com.api.v1.library.service.LoanService;
import com.api.v1.library.service.ReservationService;
import com.api.v1.library.service.ReturnService;
import com.api.v1.library.service.ScanService;
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

/** Circulation desk: the universal scanner, loans, receipts and reservations. */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Validated
@Tag(name = "Desk", description = "Universal scan, loans, receipts and reservations (librarians)")
public class DeskController {
    private final ScanService scanService;
    private final LoanService loanService;
    private final ReturnService returnService;
    private final ReservationService reservationService;

    @PostMapping("/scan/resolve")
    @Operation(summary = "Identify any scanned code and suggest the next screen")
    public ResponseEntity<SuccessResponse<ScanResolveResponse>> resolve(@Valid @RequestBody CodeRequest request) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, scanService.resolve(request.getCode()), "Code resolved"));
    }

    @GetMapping("/loans")
    @Operation(summary = "Transactions: status=ALL, ACTIVE, OVERDUE or RETURNED")
    public ResponseEntity<PaginationResponse<List<LoanResponse>>> loans(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "DESC") Sort.Direction direction,
            @RequestParam(defaultValue = "ALL") String status,
            @RequestParam(required = false) String q
    ) {
        return ResponseEntity.ok(
                APIResponseUtil.pagination(HttpStatus.OK, loanService.list(page, size, direction, status, q), "Loans retrieved successfully")
        );
    }

    @GetMapping("/receipts/verify")
    @Operation(summary = "Check a receipt is genuine from its QR or number")
    public ResponseEntity<SuccessResponse<ReceiptResponse>> verifyReceipt(@RequestParam String code) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, returnService.verify(code), "Receipt is genuine"));
    }

    @GetMapping("/reservations")
    @Operation(summary = "Reservations, optionally by status")
    public ResponseEntity<PaginationResponse<List<ReservationResponse>>> reservations(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
            @RequestParam(required = false) ReservationStatus status
    ) {
        return ResponseEntity.ok(
                APIResponseUtil.pagination(HttpStatus.OK, reservationService.list(page, size, status), "Reservations retrieved successfully")
        );
    }

    @DeleteMapping("/reservations/{id}")
    @Operation(summary = "Cancel any reservation")
    public ResponseEntity<SuccessResponse<Void>> cancelReservation(@PathVariable Long id) {
        reservationService.cancelAny(id);
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, "Reservation cancelled successfully"));
    }
}
