package com.api.v1.library.model.update;

import com.api.v1.library.common.enumerates.Role;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserUpdate {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Enter a valid email")
    private String email;

    private String phone;

    private String title;

    @NotNull(message = "Choose a role")
    private Role role;

    @Builder.Default
    private boolean active = true;

    @Schema(description = "Leave empty to keep the current password")
    @Size(min = 6, message = "At least 6 characters")
    private String password;
}
