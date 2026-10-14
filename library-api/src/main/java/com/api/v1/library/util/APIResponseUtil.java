package com.api.v1.library.util;

import com.api.v1.library.common.response.ErrorResponse;
import com.api.v1.library.common.response.PaginationResponse;
import com.api.v1.library.common.response.SuccessResponse;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class APIResponseUtil {

    private APIResponseUtil() {
    }

    // Success response
    public static <T> SuccessResponse<T> success(HttpStatus status) {
        return SuccessResponse.<T>builder()
                .status(status.getReasonPhrase())
                .code(status.value())
                .localDateTime(LocalDateTime.now())
                .build();
    }

    // Success response with a custom message
    public static <T> SuccessResponse<T> success(HttpStatus status, String message) {
        return SuccessResponse.<T>builder()
                .message(message)
                .status(status.getReasonPhrase())
                .code(status.value())
                .localDateTime(LocalDateTime.now())
                .build();
    }

    // Success response with payload
    public static <T> SuccessResponse<T> success(HttpStatus status, T payload) {
        return SuccessResponse.<T>builder()
                .payload(payload)
                .status(status.getReasonPhrase())
                .code(status.value())
                .localDateTime(LocalDateTime.now())
                .build();
    }

    // Success response with payload and a custom message
    public static <T> SuccessResponse<T> success(HttpStatus status, T payload, String message) {
        return SuccessResponse.<T>builder()
                .payload(payload)
                .message(message)
                .status(status.getReasonPhrase())
                .code(status.value())
                .localDateTime(LocalDateTime.now())
                .build();
    }

    // Paginated response
    public static <T> PaginationResponse<List<T>> pagination(HttpStatus status, Page<T> page) {
        return pagination(status, page, "Successfully");
    }

    // Paginated response with a custom message (page numbers are 1-based)
    public static <T> PaginationResponse<List<T>> pagination(HttpStatus status, Page<T> page, String message) {
        return PaginationResponse.<List<T>>builder()
                .payload(page.getContent())
                .message(message)
                .page(page.getNumber() + 1)
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .first(page.isFirst())
                .last(page.isLast())
                .empty(page.isEmpty())
                .hasNext(page.hasNext())
                .hasPrevious(page.hasPrevious())
                .status(status.getReasonPhrase())
                .code(status.value())
                .localDateTime(LocalDateTime.now())
                .build();
    }

    // Error response with status and message
    public static ErrorResponse error(HttpStatus status, String message) {
        return ErrorResponse.builder()
                .message(message)
                .status(status.getReasonPhrase())
                .code(status.value())
                .timestamp(LocalDateTime.now())
                .build();
    }

    // Error response with status, message and path
    public static ErrorResponse error(HttpStatus status, String message, String path) {
        return ErrorResponse.builder()
                .message(message)
                .status(status.getReasonPhrase())
                .code(status.value())
                .timestamp(LocalDateTime.now())
                .path(path)
                .build();
    }

    // Error response with status, message, details, and path
    public static ErrorResponse error(HttpStatus status, String message, String details, String path) {
        return ErrorResponse.builder()
                .message(message)
                .details(details)
                .status(status.getReasonPhrase())
                .code(status.value())
                .timestamp(LocalDateTime.now())
                .path(path)
                .build();
    }

    // Error response with status, message, validation errors (Map) and path
    public static ErrorResponse error(HttpStatus status, String message, Map<String, String> validationErrors, String path) {
        return ErrorResponse.builder()
                .message(message)
                .status(status.getReasonPhrase())
                .code(status.value())
                .timestamp(LocalDateTime.now())
                .validationErrors(validationErrors)
                .path(path)
                .build();
    }

    // Error response with status, message, list of errors and path
    public static ErrorResponse error(HttpStatus status, String message, List<String> errors, String path) {
        return ErrorResponse.builder()
                .message(message)
                .status(status.getReasonPhrase())
                .code(status.value())
                .timestamp(LocalDateTime.now())
                .errors(errors)
                .path(path)
                .build();
    }

    // Error response from existing ErrorResponse
    public static ErrorResponse error(ErrorResponse errorPayload) {
        if (errorPayload.getTimestamp() == null) {
            errorPayload.setTimestamp(LocalDateTime.now());
        }
        return errorPayload;
    }
}
