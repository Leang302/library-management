package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.exception.CustomException;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.User;
import com.api.v1.library.repository.MemberRepository;
import com.api.v1.library.repository.UserRepository;
import com.api.v1.library.service.CurrentUserService;

import org.springframework.http.HttpStatus;

import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/** Resolves the signed-in user from the JWT (the principal name is the user id). */
@Service
@RequiredArgsConstructor
public class CurrentUserServiceImpl implements CurrentUserService {

    private final UserRepository userRepository;
    private final MemberRepository memberRepository;

    public Long userId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            throw new InsufficientAuthenticationException("Please sign in.");
        }
        try {
            return Long.valueOf(auth.getName());
        } catch (NumberFormatException e) {
            throw new InsufficientAuthenticationException("Please sign in.");
        }
    }

    public User user() {
        return userRepository.findById(userId())
                .filter(User::isActive)
                .orElseThrow(() -> new InsufficientAuthenticationException("Your session has ended. Please sign in again."));
    }

    /** The signed-in student's member record. */
    public Member member() {
        return memberRepository.findByUserId(userId())
                .orElseThrow(() -> new CustomException(HttpStatus.UNPROCESSABLE_ENTITY, "Only library members can do this."));
    }
}
