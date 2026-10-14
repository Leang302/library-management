package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.common.enumerates.DevicePlatform;
import com.api.v1.library.common.enumerates.Role;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.User;
import com.api.v1.library.model.request.DeviceTokenRequest;
import com.api.v1.library.model.request.LoginRequest;
import com.api.v1.library.model.request.LogoutRequest;
import com.api.v1.library.model.response.AuthResponse;
import com.api.v1.library.model.response.UserResponse;
import com.api.v1.library.repository.MemberRepository;
import com.api.v1.library.repository.UserRepository;
import com.api.v1.library.service.AuditService;
import com.api.v1.library.service.AuthService;
import com.api.v1.library.service.CurrentUserService;
import com.api.v1.library.service.NotificationService;
import com.api.v1.library.util.JwtUtil;
import com.api.v1.library.util.ResponseMapper;

import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final CurrentUserService currentUser;
    private final ResponseMapper mapper;

    @Override
    @Transactional
    public AuthResponse login(LoginRequest request) {
        String id = request.getIdentifier().trim();
        User user = userRepository.findByEmailIgnoreCase(id)
                .or(() -> memberRepository.findByStudentIdIgnoreCase(id).map(Member::getUser))
                .orElse(null);
        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Incorrect email/student ID or password.");
        }
        if (!user.isActive()) {
            throw new DisabledException("This account has been deactivated. Contact the library.");
        }
        boolean student = user.getRole() == Role.STUDENT;
        auditService.log(student ? "VISIT" : "LOGIN",
                student ? "Signed in to the library app" : user.getName() + " signed in", null, user);

        // This device now receives this user's pushes (and no longer anyone else's).
        if (request.getDeviceToken() != null && !request.getDeviceToken().isBlank()) {
            notificationService.registerDevice(user, DeviceTokenRequest.builder()
                    .token(request.getDeviceToken())
                    .platform(request.getPlatform() == null ? DevicePlatform.ANDROID : request.getPlatform())
                    .build());
        }
        return AuthResponse.builder().token(jwtUtil.issue(user)).user(mapper.toUser(user)).build();
    }

    @Override
    @Transactional
    public void logout(LogoutRequest request) {
        if (request != null) notificationService.unregisterDevice(request.getDeviceToken());
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse me() {
        return mapper.toUser(currentUser.user());
    }
}
