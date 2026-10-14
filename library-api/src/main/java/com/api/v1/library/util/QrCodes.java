package com.api.v1.library.util;

import java.security.SecureRandom;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * QR payload formats. Only opaque random tokens / copy ids are encoded —
 * never names, emails or other personal data.
 */
public final class QrCodes {

    public static final String REQUEST_PREFIX = "LMS-REQ:";
    public static final String MEMBER_PREFIX = "LMS-MEM:";
    public static final String RECEIPT_PREFIX = "LMS-RCT:";

    public enum Type { COPY, REQUEST, REQUEST_CODE, MEMBER, STUDENT_ID, RECEIPT, RECEIPT_NO, UNKNOWN }

    /** A scanned code: its type and the value to look up (copy id, token, code...). */
    public record Parsed(Type type, String value) { }

    private static final Pattern COPY = Pattern.compile("^BOOKCOPY-?(\\d{1,6})$");
    private static final Pattern DIGITS = Pattern.compile("^\\d{1,6}$");
    private static final Pattern REQUEST_CODE = Pattern.compile("^CR-[A-Z0-9]{6}$");
    private static final Pattern RECEIPT_NO = Pattern.compile("^RT-[A-Z0-9]{6}$");
    private static final Pattern STUDENT_ID = Pattern.compile("^STU-\\d+$");

    // No 0/O/1/I so codes are easy to read out at the desk.
    private static final char[] ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private QrCodes() {
    }

    /** Turns any scanned or typed text into a typed payload. */
    public static Parsed parse(String text) {
        String t = text == null ? "" : text.trim();
        String up = t.toUpperCase(Locale.ROOT);
        Matcher m = COPY.matcher(up);
        if (m.matches()) return new Parsed(Type.COPY, copyIdFor(Long.parseLong(m.group(1))));
        if (DIGITS.matcher(up).matches()) return new Parsed(Type.COPY, copyIdFor(Long.parseLong(up)));
        if (up.startsWith(REQUEST_PREFIX)) return new Parsed(Type.REQUEST, t.substring(REQUEST_PREFIX.length()).trim());
        if (up.startsWith(MEMBER_PREFIX)) return new Parsed(Type.MEMBER, t.substring(MEMBER_PREFIX.length()).trim());
        if (up.startsWith(RECEIPT_PREFIX)) return new Parsed(Type.RECEIPT, t.substring(RECEIPT_PREFIX.length()).trim());
        if (REQUEST_CODE.matcher(up).matches()) return new Parsed(Type.REQUEST_CODE, up);
        if (RECEIPT_NO.matcher(up).matches()) return new Parsed(Type.RECEIPT_NO, up);
        if (STUDENT_ID.matcher(up).matches()) return new Parsed(Type.STUDENT_ID, up);
        return new Parsed(Type.UNKNOWN, t);
    }

    /** Normalises a scanned / typed copy id ("4", "bookcopy4") to BOOKCOPY-000004, or returns it upper-cased. */
    public static String normalizeCopyId(String text) {
        Parsed p = parse(text);
        return p.type() == Type.COPY ? p.value() : (text == null ? "" : text.trim().toUpperCase(Locale.ROOT));
    }

    public static String copyIdFor(long n) {
        return String.format("BOOKCOPY-%06d", n);
    }

    public static String randomToken(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
        }
        return sb.toString();
    }
}
