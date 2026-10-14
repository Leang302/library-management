package com.api.v1.library.service;

import com.api.v1.library.model.response.LoanResponse;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;

public interface LoanService {

    /** Staff transaction list. status: ALL, ACTIVE (open, incl. overdue), OVERDUE or RETURNED. */
    Page<LoanResponse> list(int page, int size, Sort.Direction direction, String status, String q);

    /** The student's loans. scope=current or history. */
    List<LoanResponse> mine(String scope);
}
