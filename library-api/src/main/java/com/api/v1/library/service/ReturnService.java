package com.api.v1.library.service;

import com.api.v1.library.model.entity.Receipt;
import com.api.v1.library.model.request.ReturnRequest;
import com.api.v1.library.model.response.ReceiptResponse;
import com.api.v1.library.model.response.ReturnPreviewResponse;
import com.api.v1.library.model.response.ReturnResultResponse;

import java.util.List;
import java.util.Optional;

public interface ReturnService {

    ReturnPreviewResponse preview(String code);

    ReturnResultResponse process(ReturnRequest request);

    List<ReceiptResponse> mine();

    /** Staff scan a receipt QR (or type its number) to check it is genuine. */
    ReceiptResponse verify(String code);

    Optional<Receipt> findByScan(String code);
}
