package com.api.v1.library.service;

import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.User;

/** The signed-in user, resolved from the JWT (the principal name is the user id). */
public interface CurrentUserService {

    Long userId();

    User user();

    /** The signed-in student's member record. */
    Member member();
}
