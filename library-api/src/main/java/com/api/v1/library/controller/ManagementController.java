package com.api.v1.library.controller;

import com.api.v1.library.common.response.PaginationResponse;
import com.api.v1.library.common.response.SuccessResponse;
import com.api.v1.library.model.response.AuditLogResponse;
import com.api.v1.library.model.response.LibrarianDashboardResponse;
import com.api.v1.library.model.response.ReportsResponse;
import com.api.v1.library.model.response.SettingsResponse;
import com.api.v1.library.model.update.SettingsUpdate;
import com.api.v1.library.service.AuditService;
import com.api.v1.library.service.DashboardService;
import com.api.v1.library.service.SettingsService;
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

/** Dashboards, reports, borrowing policy and the audit log. */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Validated
@Tag(name = "Management", description = "Dashboards, reports, borrowing policy and audit log")
public class ManagementController {
    private final DashboardService dashboardService;
    private final SettingsService settingsService;
    private final AuditService auditService;

    @GetMapping("/dashboard/librarian")
    @Operation(summary = "Desk dashboard")
    public ResponseEntity<SuccessResponse<LibrarianDashboardResponse>> librarianDashboard() {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, dashboardService.librarian(), "Dashboard retrieved successfully"));
    }

    @GetMapping("/dashboard/reports")
    @Operation(summary = "Library-wide statistics for the last N days")
    public ResponseEntity<SuccessResponse<ReportsResponse>> reports(@RequestParam(defaultValue = "30") @Min(1) @Max(365) int days) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, dashboardService.reports(days), "Reports retrieved successfully"));
    }

    @GetMapping("/settings")
    @Operation(summary = "Borrowing policy (any signed-in user)")
    public ResponseEntity<SuccessResponse<SettingsResponse>> settings() {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, settingsService.get(), "Settings retrieved successfully"));
    }

    @PutMapping("/settings")
    @Operation(summary = "Update borrowing policy")
    public ResponseEntity<SuccessResponse<SettingsResponse>> updateSettings(@Valid @RequestBody SettingsUpdate request) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, settingsService.update(request), "Settings updated successfully"));
    }

    @GetMapping("/audit-logs")
    @Operation(summary = "Recent activity")
    public ResponseEntity<PaginationResponse<List<AuditLogResponse>>> auditLogs(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        return ResponseEntity.ok(APIResponseUtil.pagination(HttpStatus.OK, auditService.list(page, size), "Audit log retrieved successfully"));
    }
}
