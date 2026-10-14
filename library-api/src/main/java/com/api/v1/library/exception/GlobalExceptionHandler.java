package com.api.v1.library.exception;

import com.api.v1.library.common.response.ErrorResponse;
import com.api.v1.library.util.APIResponseUtil;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.HashMap;

/**
 * Every error uses the same ErrorResponse body. Unlike the reference project, the real
 * HTTP status is kept (404, 422, 401...) so clients and the security layer can rely on it.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception e, HttpServletRequest request) {
        log.error("Unhandled error on {}", request.getRequestURI(), e);
        return respond(APIResponseUtil.error(HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected error occurred. Please try again later.", request.getRequestURI()));
    }

    @ExceptionHandler(CustomException.class)
    public ResponseEntity<ErrorResponse> handleCustomException(CustomException e, HttpServletRequest request) {
        ErrorResponse error = e.getErrorResponse();
        error.setPath(request.getRequestURI());
        return respond(error);
    }

    /** Another desk changed the same copy at the same moment. */
    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleConcurrentUpdate(HttpServletRequest request) {
        return respond(APIResponseUtil.error(HttpStatus.CONFLICT,
                "This record was just changed at another desk. Refresh and try again.", request.getRequestURI()));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ErrorResponse> handleHttpMessageNotReadableException(HttpServletRequest request) {
        return respond(APIResponseUtil.error(HttpStatus.BAD_REQUEST,
                "The request is malformed. Please check the JSON format and parameters and try again.",
                request.getRequestURI()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handlerArgumentNotValidException(MethodArgumentNotValidException e, HttpServletRequest request) {
        HashMap<String, String> errors = new HashMap<>();
        for (FieldError field : e.getBindingResult().getFieldErrors()) {
            errors.putIfAbsent(field.getField(), field.getDefaultMessage());
        }
        return respond(APIResponseUtil.error(HttpStatus.BAD_REQUEST, "Invalid Request", errors, request.getRequestURI()));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthenticationException(AuthenticationException e, HttpServletRequest request) {
        return respond(APIResponseUtil.error(HttpStatus.UNAUTHORIZED, e.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDeniedException(HttpServletRequest request) {
        return respond(APIResponseUtil.error(HttpStatus.FORBIDDEN, "You don't have permission to do this.", request.getRequestURI()));
    }

    private static ResponseEntity<ErrorResponse> respond(ErrorResponse error) {
        return ResponseEntity.status(error.getCode()).body(error);
    }
}
