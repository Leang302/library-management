package com.api.v1.library.model.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddCopiesRequest {

    @Min(value = 1, message = "Between 1 and 50 copies")
    @Max(value = 50, message = "Between 1 and 50 copies")
    private int count;
}
