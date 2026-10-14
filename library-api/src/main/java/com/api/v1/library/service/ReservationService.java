package com.api.v1.library.service;

import com.api.v1.library.common.enumerates.ReservationStatus;
import com.api.v1.library.model.entity.BookCopy;
import com.api.v1.library.model.entity.Member;
import com.api.v1.library.model.response.ReservationResponse;

import java.util.List;
import org.springframework.data.domain.Page;

public interface ReservationService {

    List<ReservationStatus> LIVE = List.of(ReservationStatus.WAITING, ReservationStatus.READY);

    /** Holds a newly available copy for the next member in the queue. Returns that member, or null. */
    Member assignToQueue(BookCopy copy);

    ReservationResponse reserve(Long bookId);

    void cancelMine(Long id);

    void cancelAny(Long id);

    List<ReservationResponse> mine();

    Page<ReservationResponse> list(int page, int size, ReservationStatus status);
}
