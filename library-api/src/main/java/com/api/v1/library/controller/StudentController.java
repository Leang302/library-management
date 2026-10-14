package com.api.v1.library.controller;

import com.api.v1.library.common.response.SuccessResponse;
import com.api.v1.library.model.request.BookIdRequest;
import com.api.v1.library.model.request.CodeRequest;
import com.api.v1.library.model.response.BorrowRequestResponse;
import com.api.v1.library.model.response.CartResponse;
import com.api.v1.library.model.response.LoanResponse;
import com.api.v1.library.model.response.MemberCardResponse;
import com.api.v1.library.model.response.ReceiptResponse;
import com.api.v1.library.model.response.ReservationResponse;
import com.api.v1.library.service.CartService;
import com.api.v1.library.service.CheckoutService;
import com.api.v1.library.service.LoanService;
import com.api.v1.library.service.MemberService;
import com.api.v1.library.service.ReservationService;
import com.api.v1.library.service.ReturnService;
import com.api.v1.library.util.APIResponseUtil;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Everything a signed-in student does with their own account. */
@RestController
@RequestMapping("/api/v1/me")
@RequiredArgsConstructor
@Tag(name = "Student", description = "Cart, checkout QR, loans, reservations and receipts of the signed-in student")
public class StudentController {
    private final CartService cartService;
    private final CheckoutService checkoutService;
    private final LoanService loanService;
    private final ReservationService reservationService;
    private final ReturnService returnService;
    private final MemberService memberService;

    /* ---------- cart ---------- */

    @GetMapping("/cart")
    @Operation(summary = "My cart with eligibility checks")
    public ResponseEntity<SuccessResponse<CartResponse>> cart() {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, cartService.view(), "Cart retrieved successfully"));
    }

    @PostMapping("/cart")
    @Operation(summary = "Add a scanned book copy to my cart")
    public ResponseEntity<SuccessResponse<CartResponse>> addToCart(@Valid @RequestBody CodeRequest request) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, cartService.add(request.getCode()), "Book added to cart"));
    }

    @PostMapping("/cart/books/{bookId}")
    @Operation(summary = "Add the first borrowable copy of a title to my cart")
    public ResponseEntity<SuccessResponse<CartResponse>> addBookToCart(@PathVariable Long bookId) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, cartService.addBook(bookId), "Book added to cart"));
    }

    @DeleteMapping("/cart/{copyId}")
    @Operation(summary = "Remove a copy from my cart")
    public ResponseEntity<SuccessResponse<CartResponse>> removeFromCart(@PathVariable String copyId) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, cartService.remove(copyId), "Book removed from cart"));
    }

    /* ---------- checkout pass ---------- */

    @PostMapping("/checkout")
    @Operation(summary = "Generate a checkout QR from my cart")
    public ResponseEntity<SuccessResponse<BorrowRequestResponse>> checkout() {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                APIResponseUtil.success(HttpStatus.CREATED, checkoutService.create(), "Checkout QR created successfully"));
    }

    @GetMapping("/checkout/current")
    @Operation(summary = "My live pending checkout (payload is absent when there is none)")
    public ResponseEntity<SuccessResponse<BorrowRequestResponse>> currentCheckout() {
        BorrowRequestResponse current = checkoutService.current();
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, current,
                current == null ? "No pending checkout" : "Checkout retrieved successfully"));
    }

    @GetMapping("/checkout/{id}")
    @Operation(summary = "One of my checkout requests (poll for approval)")
    public ResponseEntity<SuccessResponse<BorrowRequestResponse>> checkoutById(@PathVariable Long id) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, checkoutService.mine(id), "Checkout retrieved successfully"));
    }

    @PostMapping("/checkout/{id}/refresh")
    @Operation(summary = "Rotate the QR token and extend expiry")
    public ResponseEntity<SuccessResponse<BorrowRequestResponse>> refreshCheckout(@PathVariable Long id) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, checkoutService.refresh(id), "Checkout QR refreshed"));
    }

    @PostMapping("/checkout/{id}/cancel")
    @Operation(summary = "Cancel my pending checkout")
    public ResponseEntity<SuccessResponse<BorrowRequestResponse>> cancelCheckout(@PathVariable Long id) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, checkoutService.cancelMine(id), "Checkout cancelled"));
    }

    /* ---------- loans, reservations, receipts, card ---------- */

    @GetMapping("/loans")
    @Operation(summary = "My loans: scope=current or history")
    public ResponseEntity<SuccessResponse<List<LoanResponse>>> loans(@RequestParam(defaultValue = "current") String scope) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, loanService.mine(scope), "Loans retrieved successfully"));
    }

    @GetMapping("/reservations")
    @Operation(summary = "My reservations")
    public ResponseEntity<SuccessResponse<List<ReservationResponse>>> reservations() {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, reservationService.mine(), "Reservations retrieved successfully"));
    }

    @PostMapping("/reservations")
    @Operation(summary = "Join the waiting queue for a title with no copies available")
    public ResponseEntity<SuccessResponse<ReservationResponse>> reserve(@Valid @RequestBody BookIdRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                APIResponseUtil.success(HttpStatus.CREATED, reservationService.reserve(request.getBookId()), "Reservation created successfully"));
    }

    @DeleteMapping("/reservations/{id}")
    @Operation(summary = "Cancel my reservation")
    public ResponseEntity<SuccessResponse<Void>> cancelReservation(@PathVariable Long id) {
        reservationService.cancelMine(id);
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, "Reservation cancelled successfully"));
    }

    @GetMapping("/receipts")
    @Operation(summary = "My return receipts")
    public ResponseEntity<SuccessResponse<List<ReceiptResponse>>> receipts() {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, returnService.mine(), "Receipts retrieved successfully"));
    }

    @GetMapping("/member-card")
    @Operation(summary = "My digital membership card")
    public ResponseEntity<SuccessResponse<MemberCardResponse>> memberCard() {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, memberService.myCard(), "Member card retrieved successfully"));
    }
}
