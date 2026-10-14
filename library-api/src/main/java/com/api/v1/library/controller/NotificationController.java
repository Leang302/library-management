package com.api.v1.library.controller;

import com.api.v1.library.common.response.PaginationResponse;
import com.api.v1.library.common.response.SuccessResponse;
import com.api.v1.library.model.request.DeviceTokenRequest;
import com.api.v1.library.model.response.CountResponse;
import com.api.v1.library.model.response.NotificationResponse;
import com.api.v1.library.service.NotificationService;
import com.api.v1.library.util.APIResponseUtil;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Validated
@Tag(name = "Notifications", description = "The signed-in user's notifications and push devices")
public class NotificationController {
    private final NotificationService notificationService;

    @GetMapping
    @Operation(summary = "My notifications, newest first")
    public ResponseEntity<PaginationResponse<List<NotificationResponse>>> list(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        return ResponseEntity.ok(
                APIResponseUtil.pagination(HttpStatus.OK, notificationService.list(page, size), "Notifications retrieved successfully")
        );
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Number of unread notifications")
    public ResponseEntity<SuccessResponse<CountResponse>> unreadCount() {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, notificationService.unreadCount(), "Unread count retrieved"));
    }

    @PostMapping("/{id}/read")
    @Operation(summary = "Mark one notification read")
    public ResponseEntity<SuccessResponse<Void>> markRead(@PathVariable Long id) {
        notificationService.markRead(id);
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, "Notification marked as read"));
    }

    @PostMapping("/read-all")
    @Operation(summary = "Mark all my notifications read")
    public ResponseEntity<SuccessResponse<Void>> markAllRead() {
        notificationService.markAllRead();
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, "All notifications marked as read"));
    }

    @PostMapping("/devices")
    @Operation(summary = "Register this device's FCM token for push (e.g. after the token rotates)")
    public ResponseEntity<SuccessResponse<Void>> registerDevice(@Valid @RequestBody DeviceTokenRequest request) {
        notificationService.registerDevice(request);
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, "Device registered for push notifications"));
    }
}
