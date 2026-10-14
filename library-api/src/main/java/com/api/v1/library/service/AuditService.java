package com.api.v1.library.service;

import com.api.v1.library.model.entity.User;
import com.api.v1.library.model.response.AuditLogResponse;

import org.springframework.data.domain.Page;

public interface AuditService {

    void log(String action, String detail, Object entityId, User user);

    Page<AuditLogResponse> list(int page, int size);
}
