package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.exception.CustomException;
import com.api.v1.library.model.entity.DeviceToken;
import com.api.v1.library.model.entity.Notification;
import com.api.v1.library.model.entity.User;
import com.api.v1.library.model.request.DeviceTokenRequest;
import com.api.v1.library.model.response.CountResponse;
import com.api.v1.library.model.response.NotificationResponse;
import com.api.v1.library.repository.DeviceTokenRepository;
import com.api.v1.library.repository.NotificationRepository;
import com.api.v1.library.service.CurrentUserService;
import com.api.v1.library.service.NotificationService;
import com.api.v1.library.service.PushService;
import com.api.v1.library.util.ResponseMapper;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final PushService pushService;
    private final CurrentUserService currentUser;
    private final ResponseMapper mapper;

    /** Saves the in-app notification and pushes it to the user's signed-in devices after commit. */
    @Override
    @Transactional
    public Notification notify(User user, String type, String title, String body, String linkTo, Long linkId) {
        Notification n = notificationRepository.save(Notification.builder()
                .user(user)
                .type(type)
                .title(title)
                .body(body)
                .linkTo(linkTo)
                .linkId(linkId)
                .read(false)
                .createdAt(Instant.now())
                .build());
        pushService.sendToUser(user.getId(), n);
        return n;
    }

    @Override
    public void push(Notification n) {
        pushService.sendToUser(n.getUser().getId(), n);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NotificationResponse> list(int page, int size) {
        PageRequest pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        return notificationRepository.findByUserId(currentUser.userId(), pageable).map(mapper::toNotification);
    }

    @Override
    @Transactional(readOnly = true)
    public CountResponse unreadCount() {
        return new CountResponse(notificationRepository.countByUserIdAndReadFalse(currentUser.userId()));
    }

    @Override
    @Transactional
    public void markRead(Long id) {
        Long userId = currentUser.userId();
        Notification n = notificationRepository.findById(id)
                .filter(x -> x.getUser().getId().equals(userId))
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND, "Notification not found with id: " + id));
        n.setRead(true);
    }

    @Override
    @Transactional
    public void markAllRead() {
        notificationRepository.markAllRead(currentUser.userId());
    }

    /**
     * A token belongs to one device. If another account used this device before, the token
     * is moved to the account signing in now, so the previous account stops receiving pushes here.
     */
    @Override
    @Transactional
    public void registerDevice(DeviceTokenRequest request) {
        registerDevice(currentUser.user(), request);
    }

    @Override
    @Transactional
    public void registerDevice(User user, DeviceTokenRequest request) {
        String token = request.getToken().trim();
        DeviceToken device = deviceTokenRepository.findByToken(token)
                .orElseGet(() -> DeviceToken.builder().token(token).build());
        device.setUser(user);
        device.setPlatform(request.getPlatform());
        device.setUpdatedAt(Instant.now());
        deviceTokenRepository.save(device);
    }

    @Override
    @Transactional
    public void unregisterDevice(String token) {
        if (token != null && !token.isBlank()) deviceTokenRepository.deleteByToken(token.trim());
    }
}
