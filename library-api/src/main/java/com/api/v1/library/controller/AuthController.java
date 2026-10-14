package com.api.v1.library.controller;

import com.api.v1.library.common.response.SuccessResponse;
import com.api.v1.library.model.request.LoginRequest;
import com.api.v1.library.model.request.LogoutRequest;
import com.api.v1.library.model.response.AuthResponse;
import com.api.v1.library.model.response.UserResponse;
import com.api.v1.library.service.AuthService;
import com.api.v1.library.util.APIResponseUtil;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Sign in, sign out and the current user")
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    @Operation(summary = "Sign in with email or student ID; pass deviceToken to receive push notifications")
    public ResponseEntity<SuccessResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(
                APIResponseUtil.success(HttpStatus.OK, authService.login(request), "Signed in successfully")
        );
    }

    @PostMapping("/logout")
    @Operation(summary = "Sign out this device: it stops receiving push notifications")
    public ResponseEntity<SuccessResponse<Void>> logout(@RequestBody(required = false) LogoutRequest request) {
        authService.logout(request);
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, "Signed out successfully"));
    }

    @GetMapping("/me")
    @Operation(summary = "The signed-in user")
    public ResponseEntity<SuccessResponse<UserResponse>> me() {
        return ResponseEntity.ok(
                APIResponseUtil.success(HttpStatus.OK, authService.me(), "User retrieved successfully")
        );
    }
}
