package com.api.v1.library.model.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Result of the librarian's universal scanner: what the code is and where to go next. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScanResolveResponse {

    @Schema(description = "COPY, REQUEST, MEMBER, RECEIPT or UNKNOWN")
    private String type;

    @Schema(description = "Id to open: copy id, request id, member id or receipt id")
    private String id;

    @Schema(example = "Checkout CR-8F3K2A · Alex Morgan")
    private String label;

    @Schema(description = "REVIEW_REQUEST, RETURN, COPY_INFO, MEMBER, RECEIPT or null")
    private String suggestedAction;
}
