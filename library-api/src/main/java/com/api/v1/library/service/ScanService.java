package com.api.v1.library.service;

import com.api.v1.library.model.response.ScanResolveResponse;

/** Backs the librarian's centre Scan button: identifies any code and suggests the next screen. */
public interface ScanService {

    ScanResolveResponse resolve(String code);
}
