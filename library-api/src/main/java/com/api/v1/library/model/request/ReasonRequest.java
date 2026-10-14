package com.api.v1.library.model.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReasonRequest {

    @Size(max = 255, message = "Keep the reason under 255 characters")
    @Schema(example = "Student did not bring their ID card")
    private String reason;
}
