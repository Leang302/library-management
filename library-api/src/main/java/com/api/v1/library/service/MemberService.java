package com.api.v1.library.service;

import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.response.MemberCardResponse;
import com.api.v1.library.model.response.MemberDetailResponse;
import com.api.v1.library.model.response.MemberResponse;
import com.api.v1.library.model.update.MemberStatusUpdate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;

public interface MemberService {

    Page<MemberResponse> list(int page, int size, Sort.Direction direction, String q);

    MemberDetailResponse get(Long id);

    MemberResponse updateStatus(Long id, MemberStatusUpdate request);

    MemberResponse renew(Long id);

    MemberCardResponse myCard();

    /** A member from a scanned card (LMS-MEM:token) or a typed student id, or null. */
    Member findByScan(String code);
}
