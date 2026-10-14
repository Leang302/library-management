package com.api.v1.library.model.response;

import com.api.v1.library.common.enumerates.Role;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {

    private Long id;
    private String name;
    private String email;
    private Role role;
    private String phone;
    private String title;
    private boolean active;

    /** Only for students. */
    private MemberResponse member;
}
