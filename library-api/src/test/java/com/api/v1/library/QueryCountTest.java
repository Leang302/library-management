package com.api.v1.library;

import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Guards against N+1 queries: a list endpoint must run the same number of SQL statements
 * whether the page holds 3 rows or 9 (both full pages, so both run the count query).
 */
@SpringBootTest
@AutoConfigureMockMvc
class QueryCountTest extends ApiTestSupport {

    @Autowired
    private EntityManagerFactory emf;

    private Statistics stats;
    private String librarian;
    private String student;

    @BeforeEach
    void setUp() throws Exception {
        stats = emf.unwrap(SessionFactory.class).getStatistics();
        librarian = login("librarian@library.com", "library123");
        student = login("student@library.com", "student123");
    }

    @Test
    void bookListIsNotNPlusOne() throws Exception {
        assertConstant("/api/v1/books", student);
    }

    @Test
    void loanListIsNotNPlusOne() throws Exception {
        assertConstant("/api/v1/loans", librarian);
    }

    @Test
    void memberListIsNotNPlusOne() throws Exception {
        assertConstant("/api/v1/members", librarian);
    }

    @Test
    void userListIsNotNPlusOne() throws Exception {
        assertConstant("/api/v1/users", librarian);
    }

    @Test
    void auditLogIsNotNPlusOne() throws Exception {
        for (int i = 0; i < 10; i++) login("librarian@library.com", "library123"); // each sign-in is logged
        assertConstant("/api/v1/audit-logs", librarian);
    }

    private void assertConstant(String url, String token) throws Exception {
        long small = statements(url, token, 3);
        long large = statements(url, token, 9);
        assertThat(large).as("SQL statements for %s: 3 rows -> %d, 9 rows -> %d", url, small, large).isEqualTo(small);
        assertThat(large).as("SQL statements for %s", url).isLessThanOrEqualTo(6);
    }

    private long statements(String url, String token, int size) throws Exception {
        stats.clear();
        call(get(url).param("size", String.valueOf(size)), token, null).andExpect(status().isOk());
        return stats.getPrepareStatementCount();
    }
}
