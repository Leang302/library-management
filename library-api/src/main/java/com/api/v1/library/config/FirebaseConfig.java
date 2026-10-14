package com.api.v1.library.config;

import com.api.v1.library.service.PushGateway;
import com.api.v1.library.service.serviceImpl.FirebasePushGateway;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;

/**
 * Push notifications through Firebase Cloud Messaging.
 *
 * Set app.firebase.credentials to the path of a Firebase service-account JSON file
 * (Firebase console > Project settings > Service accounts > Generate new private key).
 * When it is empty, pushes are only logged, and in-app notifications still work.
 */
@Slf4j
@Configuration
public class FirebaseConfig {

    @Value("${app.firebase.credentials:}")
    private String credentialsPath;

    @Bean
    public PushGateway pushGateway() {
        if (credentialsPath == null || credentialsPath.isBlank()) {
            log.warn("app.firebase.credentials is not set: push notifications are logged, not sent.");
            return (tokens, message) -> {
                log.info("[push disabled] would send \"{}\" to {} device(s)", message.title(), tokens.size());
                return List.of();
            };
        }
        try (InputStream in = new FileInputStream(credentialsPath)) {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(in))
                    .build();
            FirebaseApp app = FirebaseApp.getApps().stream()
                    .filter(a -> a.getName().equals(FirebaseApp.DEFAULT_APP_NAME))
                    .findFirst()
                    .orElseGet(() -> FirebaseApp.initializeApp(options));
            log.info("Firebase Cloud Messaging enabled (project {}).", app.getOptions().getProjectId());
            return new FirebasePushGateway(app);
        } catch (IOException e) {
            throw new IllegalStateException("Can't read Firebase credentials at " + credentialsPath, e);
        }
    }

    @Bean
    public Boolean pushEnabled() {
        return credentialsPath != null && !credentialsPath.isBlank();
    }

    /** Pushes are sent off the request thread. Set app.push.async=false to send inline (tests). */
    @Bean
    public TaskExecutor pushExecutor(@Value("${app.push.async:true}") boolean async) {
        if (!async) return new SyncTaskExecutor();
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("push-");
        executor.initialize();
        return executor;
    }
}
