package com.api.v1.library.controller;

import com.api.v1.library.common.response.SuccessResponse;
import com.api.v1.library.model.request.ReturnRequest;
import com.api.v1.library.model.response.ReturnPreviewResponse;
import com.api.v1.library.model.response.ReturnResultResponse;
import com.api.v1.library.service.ReturnService;
import com.api.v1.library.util.APIResponseUtil;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/returns")
@RequiredArgsConstructor
@Tag(name = "Returns", description = "Check books back in")
public class ReturnController {
    private final ReturnService returnService;

    @GetMapping("/preview")
    @Operation(summary = "Who has this copy and how late it is")
    public ResponseEntity<SuccessResponse<ReturnPreviewResponse>> preview(@RequestParam String code) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, returnService.preview(code), "Return preview retrieved"));
    }

    @PostMapping
    @Operation(summary = "Check a copy in and issue / extend the visit's receipt")
    public ResponseEntity<SuccessResponse<ReturnResultResponse>> process(@Valid @RequestBody ReturnRequest request) {
        return ResponseEntity.ok(APIResponseUtil.success(HttpStatus.OK, returnService.process(request), "Book returned successfully"));
    }
}
