package com.api.v1.library.model.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class LogoutRequest {

    @Schema(description = "This device's FCM token, so it stops receiving pushes for the signed-out user")
    private String deviceToken;
}
