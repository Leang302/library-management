package com.api.v1.library;

import com.api.v1.library.service.PushGateway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.annotation.DirtiesContext;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pushes reach exactly the devices the recipient is signed in on: never a device that
 * signed out, and never a phone that someone else has since signed in on.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class PushNotificationTest extends ApiTestSupport {

    /** One push as the gateway received it. */
    record Sent(List<String> tokens, String title, String type) {
    }

    @TestConfiguration
    static class RecordingGatewayConfig {
        static final List<Sent> SENT = new CopyOnWriteArrayList<>();

        @Bean
        @Primary
        PushGateway recordingGateway() {
            return (tokens, message) -> {
                SENT.add(new Sent(List.copyOf(tokens), message.title(), message.data().get("type")));
                return List.of();
            };
        }
    }

    private String librarian;

    @BeforeEach
    void setUp() throws Exception {
        RecordingGatewayConfig.SENT.clear();
        librarian = login("librarian@library.com", "library123");
    }

    @Test
    void pushGoesOnlyToTheSignedInUsersDevice() throws Exception {
        long alex = memberId("STU-10231");
        long priya = memberId("STU-10232");

        // Alex signs in on phone A and gets his notification there.
        login("student@library.com", "student123", "phone-A");
        setStatus(alex, "SUSPENDED");
        assertThat(RecordingGatewayConfig.SENT).containsExactly(new Sent(List.of("phone-A"), "Membership suspended", "SYSTEM"));

        // Priya, who isn't signed in anywhere, gets the in-app notification but no push.
        RecordingGatewayConfig.SENT.clear();
        setStatus(priya, "SUSPENDED");
        assertThat(RecordingGatewayConfig.SENT).isEmpty();
    }

    @Test
    void phoneTakenOverByAnotherUserNoLongerReceivesThePreviousUsersPushes() throws Exception {
        long alex = memberId("STU-10231");
        long priya = memberId("STU-10232");

        login("student@library.com", "student123", "shared-phone");
        login("STU-10232", "student123", "shared-phone"); // Priya signs in on the same phone

        setStatus(alex, "SUSPENDED");
        assertThat(RecordingGatewayConfig.SENT).as("Alex's notice must not appear on Priya's phone").isEmpty();

        setStatus(priya, "SUSPENDED");
        assertThat(RecordingGatewayConfig.SENT).containsExactly(new Sent(List.of("shared-phone"), "Membership suspended", "SYSTEM"));
    }

    @Test
    void signedOutDeviceReceivesNothing() throws Exception {
        long alex = memberId("STU-10231");
        login("student@library.com", "student123", "phone-A");

        call(post("/api/v1/auth/logout"), null, "{\"deviceToken\":\"phone-A\"}").andExpect(status().isOk());

        setStatus(alex, "SUSPENDED");
        assertThat(RecordingGatewayConfig.SENT).isEmpty();
        // The in-app notification is still there for when Alex signs back in.
        String alexToken = login("student@library.com", "student123");
        call(get("/api/v1/notifications"), alexToken, null)
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.payload[0].title")
                        .value("Membership suspended"));
    }

    @Test
    void userSignedInOnTwoPhonesGetsItOnBoth() throws Exception {
        long alex = memberId("STU-10231");
        login("student@library.com", "student123", "phone-A");
        login("student@library.com", "student123", "tablet-B");

        setStatus(alex, "SUSPENDED");
        assertThat(RecordingGatewayConfig.SENT).hasSize(1);
        assertThat(RecordingGatewayConfig.SENT.get(0).tokens()).containsExactlyInAnyOrder("phone-A", "tablet-B");
    }

    @Test
    void checkoutApprovalIsPushedToTheStudent() throws Exception {
        String priya = login("STU-10232", "student123", "priya-phone");
        call(post("/api/v1/me/cart"), priya, "{\"code\":\"BOOKCOPY-000008\"}").andExpect(status().isOk());
        long requestId = payload(call(post("/api/v1/me/checkout"), priya, null)).get("id").asLong();
        call(post("/api/v1/requests/" + requestId + "/handover"), librarian, "{\"code\":\"BOOKCOPY-000008\"}").andExpect(status().isOk());

        RecordingGatewayConfig.SENT.clear();
        call(post("/api/v1/requests/" + requestId + "/approve"), librarian, null).andExpect(status().isOk());

        assertThat(RecordingGatewayConfig.SENT).containsExactly(new Sent(List.of("priya-phone"), "Checkout approved", "CHECKOUT_APPROVED"));
    }

    @Test
    void failedActionSendsNoPush() throws Exception {
        String priya = login("STU-10232", "student123", "priya-phone");
        call(post("/api/v1/me/cart"), priya, "{\"code\":\"BOOKCOPY-000008\"}").andExpect(status().isOk());
        long requestId = payload(call(post("/api/v1/me/checkout"), priya, null)).get("id").asLong();

        RecordingGatewayConfig.SENT.clear();
        // Not scanned at the desk yet: approval is refused, so nothing is pushed.
        call(post("/api/v1/requests/" + requestId + "/approve"), librarian, null).andExpect(status().isUnprocessableEntity());
        assertThat(RecordingGatewayConfig.SENT).isEmpty();
    }

    private long memberId(String studentId) throws Exception {
        return payload(call(get("/api/v1/members").param("q", studentId), librarian, null)).get(0).get("id").asLong();
    }

    private void setStatus(long memberId, String status) throws Exception {
        call(patch("/api/v1/members/" + memberId + "/status"), librarian, "{\"status\":\"" + status + "\"}")
                .andExpect(status().isOk());
    }
}
