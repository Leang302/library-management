package com.api.v1.library.service;

import com.api.v1.library.model.response.LibrarianDashboardResponse;
import com.api.v1.library.model.response.ReportsResponse;

public interface DashboardService {

    LibrarianDashboardResponse librarian();

    ReportsResponse reports(int days);
}
