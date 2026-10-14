package com.api.v1.library.model.request;

import com.api.v1.library.common.enumerates.Role;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Create a user. Students also need the number on their physical ID card.")
public class UserCreateRequest {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Enter a valid email")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "At least 6 characters")
    private String password;

    @NotNull(message = "Choose a role")
    private Role role;

    private String phone;

    private String title;

    @Schema(description = "Required for STUDENT", example = "STU-10240")
    @Pattern(regexp = "^$|^[A-Za-z0-9][A-Za-z0-9-]{3,19}$", message = "4-20 letters, digits or dashes")
    private String studentId;

    private String program;

    @Min(value = 1, message = "Year must be 1-8")
    @Max(value = 8, message = "Year must be 1-8")
    private Integer year;
}
