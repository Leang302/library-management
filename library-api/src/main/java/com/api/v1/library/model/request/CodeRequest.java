package com.api.v1.library.model.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Raw text from a QR scan or typed by hand. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CodeRequest {

    @NotBlank(message = "Scan or type a code")
    @Schema(example = "BOOKCOPY-000004")
    private String code;
}
