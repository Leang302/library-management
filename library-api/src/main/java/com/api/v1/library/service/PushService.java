package com.api.v1.library.service;

import com.api.v1.library.model.entity.Notification;

/**
 * Sends push notifications (Firebase Cloud Messaging) to the devices a user is signed in on.
 * Pushes go out only after the transaction that created the notification commits.
 */
public interface PushService {

    /** Queues a push to every device currently registered to this user. */
    void sendToUser(Long userId, Notification notification);

    /** True when Firebase credentials are configured and pushes are really sent. */
    boolean isEnabled();
}
