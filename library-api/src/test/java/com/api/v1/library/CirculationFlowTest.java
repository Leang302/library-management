package com.api.v1.library;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.annotation.DirtiesContext;
import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end desk flow against the seeded demo data:
 * student scans -> checkout QR -> librarian scans the pass -> hands over a different
 * copy of the same title -> approves -> the book comes back with a receipt.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class CirculationFlowTest extends ApiTestSupport {

    @Test
    void fullCheckoutAndReturnFlow() throws Exception {
        // Priya (STU-10232) has one loan; Clean Code (copies 8 and 9) is on the shelf.
        String student = login("STU-10232", "student123");
        String librarian = login("librarian@library.com", "library123");

        // Student scans copy 8 of Clean Code.
        JsonNode cart = payload(call(post("/api/v1/me/cart"), student, "{\"code\":\"BOOKCOPY-000008\"}").andExpect(status().isOk()));
        assertThat(cart.at("/items/0/book/title").asString()).isEqualTo("Clean Code");
        assertThat(cart.at("/eligibility/ok").asBoolean()).isTrue();

        // Scanning it twice is refused with a readable message.
        call(post("/api/v1/me/cart"), student, "{\"code\":\"8\"}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("This copy is already in your cart."))
                .andExpect(jsonPath("$.code").value(422));

        // Generate the checkout pass.
        JsonNode req = payload(call(post("/api/v1/me/checkout"), student, null).andExpect(status().isCreated()));
        String qr = req.get("qrPayload").asString();
        long requestId = req.get("id").asLong();
        assertThat(qr).startsWith("LMS-REQ:");
        assertThat(req.get("status").asString()).isEqualTo("PENDING_APPROVAL");

        // Librarian's centre Scan button resolves the pass to the request review.
        JsonNode resolved = payload(call(post("/api/v1/scan/resolve"), librarian, "{\"code\":\"" + qr + "\"}").andExpect(status().isOk()));
        assertThat(resolved.get("type").asString()).isEqualTo("REQUEST");
        assertThat(resolved.get("suggestedAction").asString()).isEqualTo("REVIEW_REQUEST");
        assertThat(resolved.get("id").asLong()).isEqualTo(requestId);

        // Can't approve before the book is scanned at the desk.
        call(post("/api/v1/requests/" + requestId + "/approve"), librarian, null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("0 of 1 scanned"));

        // Desk hands over copy 9 instead: the request switches to it.
        JsonNode handover = payload(call(post("/api/v1/requests/" + requestId + "/handover"), librarian,
                "{\"code\":\"BOOKCOPY-000009\"}").andExpect(status().isOk()));
        assertThat(handover.get("swapped").asBoolean()).isTrue();
        assertThat(handover.get("from").asString()).isEqualTo("BOOKCOPY-000008");
        assertThat(handover.at("/review/ok").asBoolean()).isTrue();

        // A book that isn't in the checkout is refused.
        call(post("/api/v1/requests/" + requestId + "/handover"), librarian, "{\"code\":\"BOOKCOPY-000001\"}")
                .andExpect(status().isUnprocessableEntity());

        // Approve: copy 9 is lent, the request can't be approved twice.
        JsonNode approved = payload(call(post("/api/v1/requests/" + requestId + "/approve"), librarian, null).andExpect(status().isOk()));
        assertThat(approved.at("/loans/0/copyId").asString()).isEqualTo("BOOKCOPY-000009");
        assertThat(approved.at("/request/status").asString()).isEqualTo("APPROVED");
        call(post("/api/v1/requests/" + requestId + "/approve"), librarian, null).andExpect(status().isUnprocessableEntity());

        // The student sees the loan and the approval notification.
        call(get("/api/v1/me/loans"), student, null).andExpect(jsonPath("$.payload[?(@.copyId=='BOOKCOPY-000009')]").exists());
        call(get("/api/v1/notifications"), student, null).andExpect(jsonPath("$.payload[0].type").value("CHECKOUT_APPROVED"));

        // Scanning the book at the desk now suggests a return.
        call(post("/api/v1/scan/resolve"), librarian, "{\"code\":\"BOOKCOPY-000009\"}")
                .andExpect(jsonPath("$.payload.suggestedAction").value("RETURN"));

        // Return it: receipt issued, copy back on the shelf, can't be returned twice.
        JsonNode ret = payload(call(post("/api/v1/returns"), librarian, "{\"code\":\"BOOKCOPY-000009\",\"condition\":\"GOOD\"}")
                .andExpect(status().isOk()));
        assertThat(ret.get("copyStatus").asString()).isEqualTo("AVAILABLE");
        String receiptQr = ret.at("/receipt/qrPayload").asString();
        assertThat(receiptQr).startsWith("LMS-RCT:");
        call(post("/api/v1/returns"), librarian, "{\"code\":\"BOOKCOPY-000009\"}").andExpect(status().isUnprocessableEntity());

        // The receipt verifies at the desk and shows in the student's app.
        call(get("/api/v1/receipts/verify").param("code", receiptQr), librarian, null)
                .andExpect(jsonPath("$.payload.lines[0].bookTitle").value("Clean Code"));
        call(get("/api/v1/me/receipts"), student, null).andExpect(jsonPath("$.payload[0].number").exists());
    }

    @Test
    void responsesUseTheEnvelopeAndListsArePaginated() throws Exception {
        String librarian = login("librarian@library.com", "library123");
        call(get("/api/v1/books").param("page", "2").param("size", "10"), librarian, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.page").value(2))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").value(25))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.payload.length()").value(10))
                .andExpect(jsonPath("$.hasNext").value(true));
        call(get("/api/v1/books/9999"), librarian, null)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.path").value("/api/v1/books/9999"));
        call(post("/api/v1/books"), librarian, "{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.title").value("Title is required"));
    }

    @Test
    void rolesAreEnforced() throws Exception {
        String student = login("student@library.com", "student123");
        mvc.perform(get("/api/v1/books")).andExpect(status().isUnauthorized());
        call(get("/api/v1/books"), student, null).andExpect(status().isOk());
        call(get("/api/v1/dashboard/librarian"), student, null).andExpect(status().isForbidden());
        call(get("/api/v1/users"), student, null).andExpect(status().isForbidden());
        call(get("/api/v1/users"), login("librarian@library.com", "library123"), null).andExpect(status().isOk());
        call(get("/api/v1/dashboard/reports"), student, null).andExpect(status().isForbidden());
        call(post("/api/v1/auth/login"), null, "{\"identifier\":\"student@library.com\",\"password\":\"wrong\"}")
                .andExpect(status().isUnauthorized());
    }

    @Test
    void overdueStudentCannotBorrowAndFullTitleCanBeReserved() throws Exception {
        // Marcus (STU-10233) has an overdue loan.
        String marcus = login("STU-10233", "student123");
        call(post("/api/v1/me/cart"), marcus, "{\"code\":\"BOOKCOPY-000007\"}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("1 overdue book must be returned first"));

        // Project Hail Mary (book 7) is fully borrowed: Noah can join the queue behind Alex.
        String noah = login("STU-10235", "student123");
        call(post("/api/v1/me/reservations"), noah, "{\"bookId\":7}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.payload.position").value(2));
    }
}
