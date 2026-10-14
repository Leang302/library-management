package com.api.v1.library.service;

import com.api.v1.library.model.entity.Notification;
import com.api.v1.library.model.entity.User;
import com.api.v1.library.model.request.DeviceTokenRequest;
import com.api.v1.library.model.response.CountResponse;
import com.api.v1.library.model.response.NotificationResponse;

import org.springframework.data.domain.Page;

/**
 * In-app notifications. Every notification is also pushed to the devices the user is
 * currently signed in on (see {@link PushService}).
 */
public interface NotificationService {

    Notification notify(User user, String type, String title, String body, String linkTo, Long linkId);

    /** Re-sends an existing notification as a push (e.g. a receipt notification that was updated). */
    void push(Notification notification);

    Page<NotificationResponse> list(int page, int size);

    CountResponse unreadCount();

    void markRead(Long id);

    void markAllRead();

    /** Ties this device's push token to the signed-in user, taking it over from any previous user. */
    void registerDevice(DeviceTokenRequest request);

    /** Same as {@link #registerDevice(DeviceTokenRequest)} for a given user (used at sign-in). */
    void registerDevice(User user, DeviceTokenRequest request);

    /** Stops push notifications to this device token. */
    void unregisterDevice(String token);
}
