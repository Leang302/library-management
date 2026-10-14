package com.api.v1.library.service;

import com.api.v1.library.common.enumerates.Role;
import com.api.v1.library.model.request.UserCreateRequest;
import com.api.v1.library.model.response.UserResponse;
import com.api.v1.library.model.update.UserUpdate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;

public interface UserService {

    Page<UserResponse> list(int page, int size, Sort.Direction direction, Role role, String q);

    UserResponse get(Long id);

    UserResponse create(UserCreateRequest request);

    UserResponse update(Long id, UserUpdate request);

    void delete(Long id);
}
