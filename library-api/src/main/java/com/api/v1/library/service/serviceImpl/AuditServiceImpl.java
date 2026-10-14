package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.model.entity.AuditLog;
import com.api.v1.library.model.entity.User;
import com.api.v1.library.model.response.AuditLogResponse;
import com.api.v1.library.repository.AuditLogRepository;
import com.api.v1.library.service.AuditService;
import com.api.v1.library.util.ResponseMapper;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditServiceImpl implements AuditService {

    private final AuditLogRepository auditLogRepository;
    private final ResponseMapper mapper;

    @Transactional
    public void log(String action, String detail, Object entityId, User user) {
        auditLogRepository.save(AuditLog.builder()
                .action(action)
                .detail(detail)
                .entity(entityId == null ? null : String.valueOf(entityId))
                .user(user)
                .build());
    }

    @Transactional(readOnly = true)
    @Override
    public Page<AuditLogResponse> list(int page, int size) {
        return auditLogRepository.findAllBy(PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt", "id")))
                .map(mapper::toAuditLog);
    }
}
