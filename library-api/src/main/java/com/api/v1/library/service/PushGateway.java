package com.api.v1.library.service;

import java.util.List;
import java.util.Map;

/**
 * Low-level push transport. The real implementation calls Firebase Cloud Messaging;
 * without credentials a logging implementation is used (see FirebaseConfig).
 */
public interface PushGateway {

    /** A push message: the visible title/body plus data the app uses to open the right screen. */
    record PushMessage(String title, String body, Map<String, String> data) {
    }

    /**
     * Sends one message to many device tokens.
     *
     * @return the tokens Firebase reported as invalid (uninstalled app, expired token), to be deleted
     */
    List<String> send(List<String> tokens, PushMessage message);
}
