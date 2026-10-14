package com.api.v1.library.service;

import com.api.v1.library.model.entity.LibrarySettings;
import com.api.v1.library.model.response.SettingsResponse;
import com.api.v1.library.model.update.SettingsUpdate;

public interface SettingsService {

    /** The single settings row, created with defaults on first use. */
    LibrarySettings settings();

    SettingsResponse get();

    SettingsResponse update(SettingsUpdate request);

    /** Allocates the next physical-copy identifier, e.g. BOOKCOPY-000053. */
    String nextCopyId();
}
