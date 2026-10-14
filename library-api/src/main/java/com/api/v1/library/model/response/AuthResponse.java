package com.api.v1.library.model.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {

    /** JWT to send as "Authorization: Bearer &lt;token&gt;". */
    private String token;

    private UserResponse user;
}
