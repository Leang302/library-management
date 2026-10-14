package com.api.v1.library.model.request;

import com.api.v1.library.common.enumerates.ItemCondition;

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
public class ReturnRequest {

    @NotBlank(message = "Scan or type the copy ID")
    @Schema(example = "BOOKCOPY-000001")
    private String code;

    @Builder.Default
    private ItemCondition condition = ItemCondition.GOOD;

    private String note;

    @Schema(description = "Receipt id from the previous return in this desk visit, to add this book to the same receipt")
    private Long receiptId;
}
