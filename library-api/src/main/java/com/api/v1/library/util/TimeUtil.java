package com.api.v1.library.util;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/** Date helpers. Calendar days follow the server's time zone (the library's local day). */
public final class TimeUtil {

    private static final ZoneId ZONE = ZoneId.systemDefault();

    private TimeUtil() {
    }

    public static Instant startOfDay(Instant t) {
        return LocalDate.ofInstant(t, ZONE).atStartOfDay(ZONE).toInstant();
    }

    /** Last moment of that day, so a book "due on the 14th" is due until 23:59:59. */
    public static Instant endOfDay(Instant t) {
        return LocalDate.ofInstant(t, ZONE).plusDays(1).atStartOfDay(ZONE).toInstant().minusSeconds(1);
    }

    public static LocalDate localDate(Instant t) {
        return LocalDate.ofInstant(t, ZONE);
    }

    /** Whole days late (rounded up) when returned / checked at {@code end}; 0 if on time. */
    public static int daysLate(Instant dueAt, Instant end) {
        if (dueAt == null || end == null || !end.isAfter(dueAt)) return 0;
        long seconds = Duration.between(dueAt, end).getSeconds();
        return (int) ((seconds + 86_399) / 86_400);
    }
}
