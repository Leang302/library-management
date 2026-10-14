package com.api.v1.library.model.request;

import com.api.v1.library.common.enumerates.DevicePlatform;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Sign in with an email address or a student ID")
public class LoginRequest {

    @NotBlank(message = "Enter your email or student ID")
    @Schema(example = "librarian@library.com")
    private String identifier;

    @NotBlank(message = "Enter your password")
    @Schema(example = "library123")
    private String password;

    @Schema(description = "Optional FCM token: this device then receives push notifications for this user only")
    private String deviceToken;

    private DevicePlatform platform;
}
