package com.api.v1.library.model.update;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "New borrowing policy")
public class SettingsUpdate {

    @NotBlank(message = "Library name is required")
    private String libraryName;

    @Min(value = 1, message = "1-20 books")
    @Max(value = 20, message = "1-20 books")
    private int maxBorrow;

    @Min(value = 1, message = "1-90 days")
    @Max(value = 90, message = "1-90 days")
    private int loanDays;

    @Min(value = 1, message = "1-60 minutes")
    @Max(value = 60, message = "1-60 minutes")
    private int requestExpiryMin;

    private boolean blockOnOverdue;

    private boolean requireHandoverScan;

    @Min(value = 1, message = "1-14 days")
    @Max(value = 14, message = "1-14 days")
    private int reservationHoldDays;

    @Min(value = 0, message = "0-14 days")
    @Max(value = 14, message = "0-14 days")
    private int dueSoonDays;
}
