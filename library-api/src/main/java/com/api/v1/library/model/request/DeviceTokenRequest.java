package com.api.v1.library.model.request;

import com.api.v1.library.common.enumerates.DevicePlatform;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** The device's Firebase Cloud Messaging registration token. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceTokenRequest {

    @NotBlank(message = "token is required")
    @Size(max = 512, message = "token is too long")
    @Schema(description = "FCM registration token from firebase_messaging getToken()")
    private String token;

    @Builder.Default
    private DevicePlatform platform = DevicePlatform.ANDROID;
}
