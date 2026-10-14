package com.api.v1.library.model.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookDetailResponse {

    private BookResponse book;
    private List<CopyResponse> copies;
    private int queueLength;

    /** The signed-in student's active reservation for this title, if any. */
    private ReservationResponse myReservation;
}
