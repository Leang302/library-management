package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.common.event.NotificationCreatedEvent;
import com.api.v1.library.model.entity.DeviceToken;
import com.api.v1.library.model.entity.Notification;
import com.api.v1.library.repository.DeviceTokenRepository;
import com.api.v1.library.service.PushGateway;
import com.api.v1.library.service.PushService;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Delivers notifications as pushes to the devices a user is signed in on.
 *
 * Who receives it is decided when the push is sent (after the transaction commits),
 * from the device_tokens table: a device is linked to exactly one user — the last one
 * who signed in on it — and is unlinked when that user signs out. So a signed-out
 * phone, or a phone now used by someone else, never shows another user's notification.
 */
@Slf4j
@Service
public class PushServiceImpl implements PushService {

    private final DeviceTokenRepository deviceTokenRepository;
    private final PushGateway gateway;
    private final ApplicationEventPublisher events;
    private final TaskExecutor executor;
    private final TransactionTemplate tx;
    private final boolean enabled;

    public PushServiceImpl(DeviceTokenRepository deviceTokenRepository, PushGateway gateway,
                           ApplicationEventPublisher events, @Qualifier("pushExecutor") TaskExecutor executor,
                           TransactionTemplate tx, @Qualifier("pushEnabled") Boolean enabled) {
        this.deviceTokenRepository = deviceTokenRepository;
        this.gateway = gateway;
        this.events = events;
        this.executor = executor;
        this.tx = tx;
        this.enabled = enabled;
    }

    @Override
    public void sendToUser(Long userId, Notification n) {
        events.publishEvent(new NotificationCreatedEvent(userId, n.getId(), n.getType(), n.getTitle(), n.getBody(),
                n.getLinkTo(), n.getLinkId()));
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    /** Runs after commit (or immediately when there is no transaction), off the request thread. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onNotification(NotificationCreatedEvent event) {
        executor.execute(() -> deliver(event));
    }

    void deliver(NotificationCreatedEvent e) {
        try {
            List<String> tokens = tx.execute(s -> deviceTokenRepository.findByUserId(e.userId()).stream()
                    .map(DeviceToken::getToken).toList());
            if (tokens == null || tokens.isEmpty()) return; // signed out everywhere: nothing to send
            Map<String, String> data = new HashMap<>();
            data.put("type", e.type());
            data.put("notificationId", String.valueOf(e.notificationId()));
            if (e.linkTo() != null) data.put("linkTo", e.linkTo());
            if (e.linkId() != null) data.put("linkId", String.valueOf(e.linkId()));
            List<String> invalid = gateway.send(tokens, new PushGateway.PushMessage(e.title(), e.body(), data));
            if (!invalid.isEmpty()) {
                tx.executeWithoutResult(s -> deviceTokenRepository.deleteByTokenIn(invalid));
                log.info("Removed {} expired push token(s)", invalid.size());
            }
        } catch (RuntimeException ex) {
            // A push failure must never break the library action that triggered it.
            log.warn("Push delivery failed for user {}: {}", e.userId(), ex.getMessage());
        }
    }
}
