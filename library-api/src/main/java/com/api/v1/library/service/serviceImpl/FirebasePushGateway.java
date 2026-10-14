package com.api.v1.library.service.serviceImpl;

import com.api.v1.library.service.PushGateway;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.ApnsConfig;
import com.google.firebase.messaging.Aps;
import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.Notification;
import com.google.firebase.messaging.SendResponse;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Sends real push notifications through Firebase Cloud Messaging (HTTP v1 API). */
@Slf4j
public class FirebasePushGateway implements PushGateway {

    /** Must match the channel the Flutter app creates. */
    public static final String ANDROID_CHANNEL = "library_default";

    /** FCM allows at most 500 tokens per multicast. */
    private static final int BATCH = 500;

    private static final Set<MessagingErrorCode> DEAD_TOKEN = Set.of(
            MessagingErrorCode.UNREGISTERED, MessagingErrorCode.INVALID_ARGUMENT, MessagingErrorCode.SENDER_ID_MISMATCH);

    private final FirebaseMessaging messaging;

    public FirebasePushGateway(FirebaseApp app) {
        this.messaging = FirebaseMessaging.getInstance(app);
    }

    @Override
    public List<String> send(List<String> tokens, PushMessage message) {
        List<String> invalid = new ArrayList<>();
        for (int from = 0; from < tokens.size(); from += BATCH) {
            List<String> chunk = tokens.subList(from, Math.min(from + BATCH, tokens.size()));
            MulticastMessage multicast = MulticastMessage.builder()
                    .addAllTokens(chunk)
                    .setNotification(Notification.builder().setTitle(message.title()).setBody(message.body()).build())
                    .putAllData(message.data())
                    .setAndroidConfig(AndroidConfig.builder()
                            .setPriority(AndroidConfig.Priority.HIGH)
                            .setNotification(AndroidNotification.builder().setChannelId(ANDROID_CHANNEL).build())
                            .build())
                    .setApnsConfig(ApnsConfig.builder().setAps(Aps.builder().setSound("default").build()).build())
                    .build();
            try {
                BatchResponse result = messaging.sendEachForMulticast(multicast);
                List<SendResponse> responses = result.getResponses();
                for (int i = 0; i < responses.size(); i++) {
                    FirebaseMessagingException error = responses.get(i).getException();
                    if (error != null) {
                        if (DEAD_TOKEN.contains(error.getMessagingErrorCode())) invalid.add(chunk.get(i));
                        else log.warn("Push to one device failed: {}", error.getMessage());
                    }
                }
                log.debug("Push sent: {} ok, {} failed", result.getSuccessCount(), result.getFailureCount());
            } catch (FirebaseMessagingException e) {
                log.warn("Push failed: {}", e.getMessage());
            }
        }
        return invalid;
    }
}
