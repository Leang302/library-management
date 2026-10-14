package com.api.v1.library.controller;

import com.api.v1.library.common.response.SuccessResponse;
import com.api.v1.library.model.response.CopyResponse;
import com.api.v1.library.model.update.CopyStatusUpdate;
import com.api.v1.library.service.BookService;
import com.api.v1.library.util.APIResponseUtil;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/copies")
@RequiredArgsConstructor
@Tag(name = "Copies", description = "Physical copies (librarians)")
public class CopyController {
    private final BookService bookService;

    @GetMapping("/{copyId}")
    @Operation(summary = "Copy status and current borrower")
    public ResponseEntity<SuccessResponse<CopyResponse>> get(@PathVariable String copyId) {
        return ResponseEntity.ok(
                APIResponseUtil.success(HttpStatus.OK, bookService.getCopy(copyId), "Copy retrieved successfully")
        );
    }

    @PatchMapping("/{copyId}/status")
    @Operation(summary = "Mark a copy available, under maintenance or lost")
    public ResponseEntity<SuccessResponse<CopyResponse>> updateStatus(@PathVariable String copyId,
                                                                      @Valid @RequestBody CopyStatusUpdate request) {
        return ResponseEntity.ok(
                APIResponseUtil.success(HttpStatus.OK, bookService.updateCopyStatus(copyId, request), "Copy updated successfully")
        );
    }
}
