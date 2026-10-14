package com.api.v1.library.service;

import com.api.v1.library.common.enumerates.RequestStatus;
import com.api.v1.library.model.entity.BorrowRequest;
import com.api.v1.library.model.response.ApproveResponse;
import com.api.v1.library.model.response.BorrowRequestResponse;
import com.api.v1.library.model.response.HandoverResponse;
import com.api.v1.library.model.response.ReviewResponse;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;

public interface CheckoutService {

    BorrowRequestResponse create();

    /** The student's live pending request, or null. */
    BorrowRequestResponse current();

    BorrowRequestResponse mine(Long id);

    BorrowRequestResponse refresh(Long id);

    BorrowRequestResponse cancelMine(Long id);

    Page<BorrowRequestResponse> list(int page, int size, Sort.Direction direction, RequestStatus status);

    /** A request from a scanned pass (LMS-REQ:token) or a typed code (CR-XXXXXX), or null. */
    BorrowRequest findByScan(String text);

    ReviewResponse review(Long id);

    HandoverResponse handover(Long id, String code);

    ApproveResponse approve(Long id);

    BorrowRequestResponse reject(Long id, String reason);
}
