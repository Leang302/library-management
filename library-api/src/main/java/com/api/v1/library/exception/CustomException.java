package com.api.v1.library.exception;

import com.api.v1.library.common.response.ErrorResponse;
import com.api.v1.library.util.APIResponseUtil;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * The one exception type services throw. Library rule failures use
 * UNPROCESSABLE_ENTITY (422) with a message the app can show as-is.
 */
@Getter
public class CustomException extends RuntimeException {
    private final ErrorResponse errorResponse;
    private final HttpStatus httpStatus;

    // Constructor with only HttpStatus
    public CustomException(HttpStatus httpStatus) {
        this(httpStatus, httpStatus.getReasonPhrase());
    }

    // Constructor with just message
    public CustomException(String message) {
        this(HttpStatus.BAD_REQUEST, message);
    }

    // Constructor with HTTP status and message
    public CustomException(HttpStatus httpStatus, String message) {
        super(message);
        this.errorResponse = APIResponseUtil.error(httpStatus, message);
        this.httpStatus = httpStatus;
    }

    // Constructor with message, details, HTTP status, and path
    public CustomException(String message, String details, HttpStatus httpStatus, String path) {
        super(message);
        this.errorResponse = APIResponseUtil.error(httpStatus, message, details, path);
        this.httpStatus = httpStatus;
    }
}
