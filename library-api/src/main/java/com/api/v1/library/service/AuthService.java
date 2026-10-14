package com.api.v1.library.service;

import com.api.v1.library.model.request.LoginRequest;
import com.api.v1.library.model.request.LogoutRequest;
import com.api.v1.library.model.response.AuthResponse;
import com.api.v1.library.model.response.UserResponse;

public interface AuthService {

    /** Sign in with an email or a student ID card number; registers the device for push when a token is given. */
    AuthResponse login(LoginRequest request);

    /** Signs out this device: its push token stops receiving this user's notifications. */
    void logout(LogoutRequest request);

    UserResponse me();
}
