package com.api.v1.library.service;

import com.api.v1.library.model.entity.BookCopy;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.response.CartResponse;

import java.util.List;

public interface CartService {

    CartResponse view();

    /** Student scanned a book QR: validate and add it to the cart (the copy status does not change). */
    CartResponse add(String code);

    CartResponse addBook(Long bookId);

    CartResponse remove(String copyId);

    /** Cart copies that still exist, in cart order. */
    List<BookCopy> copies(Member member);
}
