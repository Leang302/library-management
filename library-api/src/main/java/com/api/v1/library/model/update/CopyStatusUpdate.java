package com.api.v1.library.model.update;

import com.api.v1.library.common.enumerates.CopyStatus;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CopyStatusUpdate {

    @NotNull(message = "status is required")
    @Schema(description = "AVAILABLE, MAINTENANCE or LOST")
    private CopyStatus status;

    private String note;
}
