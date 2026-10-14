package com.api.v1.library.common.event;

/**
 * Published when an in-app notification is created or updated. The push is sent only
 * after the surrounding transaction commits, so a rolled-back action never notifies anyone.
 */
public record NotificationCreatedEvent(Long userId, Long notificationId, String type, String title, String body,
                                       String linkTo, Long linkId) {
}
