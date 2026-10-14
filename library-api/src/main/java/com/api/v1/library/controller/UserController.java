package com.api.v1.library.controller;

import com.api.v1.library.common.enumerates.Role;
import com.api.v1.library.common.response.PaginationResponse;
import com.api.v1.library.common.response.SuccessResponse;
import com.api.v1.library.model.request.UserCreateRequest;
import com.api.v1.library.model.response.UserResponse;
import com.api.v1.library.model.update.UserUpdate;
import com.api.v1.library.service.UserService;
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
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Validated
@Tag(name = "Users", description = "Account management (librarians)")
public class UserController {
    private final UserService userService;

    @GetMapping
    @Operation(summary = "List users, optionally by role or search text")
    public ResponseEntity<PaginationResponse<List<UserResponse>>> list(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "ASC") Sort.Direction direction,
            @RequestParam(required = false) Role role,
            @RequestParam(required = false) String q
    ) {
        return ResponseEntity.ok(
                APIResponseUtil.pagination(HttpStatus.OK, userService.list(page, size, direction, role, q), "Users retrieved successfully")
        );
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a user")
    public ResponseEntity<SuccessResponse<UserResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, userService.get(id), "User retrieved successfully"));
    }

    @PostMapping
    @Operation(summary = "Create a user (students need their ID card number)")
    public ResponseEntity<SuccessResponse<UserResponse>> create(@Valid @RequestBody UserCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                APIResponseUtil.success(HttpStatus.CREATED, userService.create(request), "User created successfully"));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a user, change role or deactivate")
    public ResponseEntity<SuccessResponse<UserResponse>> update(@PathVariable Long id, @Valid @RequestBody UserUpdate request) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, userService.update(id, request), "User updated successfully"));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a user with no library history")
    public ResponseEntity<SuccessResponse<Void>> delete(@PathVariable Long id) {
        userService.delete(id);
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, "User deleted successfully"));
    }
}
