package com.api.v1.library.model.update;

import com.api.v1.library.common.enumerates.MemberStatus;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberStatusUpdate {

    @NotNull(message = "status is required")
    private MemberStatus status;
}
