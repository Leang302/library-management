package com.api.v1.library.service;

import com.api.v1.library.model.entity.BookCopy;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.entity.Reservation;
import com.api.v1.library.model.response.CheckResponse;
import com.api.v1.library.model.response.EligibilityResponse;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Single source of truth for "can this member borrow?" and "is this copy borrowable?".
 * Used by the cart, by checkout-request creation AND again by librarian approval.
 */
public interface EligibilityService {

    DateTimeFormatter DATE = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH).withZone(ZoneId.systemDefault());

    /** Result of checking one physical copy for one member. */
    record CopyCheck(boolean ok, String error, Reservation reservation) {
        public static CopyCheck pass(Reservation r) {
            return new CopyCheck(true, null, r);
        }

        public static CopyCheck fail(String error) {
            return new CopyCheck(false, error, null);
        }
    }

    boolean isMembershipValid(Member member);

    /** Can this member borrow {@code extra} more books right now? */
    EligibilityResponse eligibility(Member member, int extra);

    CopyCheck copyCheck(BookCopy copy, Member member, Long ignoreRequestId);

    static CheckResponse check(String key, String label, boolean ok, String detail) {
        return CheckResponse.builder().key(key).label(label).ok(ok).detail(detail).build();
    }

    static String plural(long n, String word) {
        return n + " " + word + (n == 1 ? "" : "s");
    }
}
