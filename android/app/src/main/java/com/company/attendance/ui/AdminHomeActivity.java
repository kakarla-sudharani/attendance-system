package com.company.attendance.ui;

import android.content.Intent;
import android.os.Bundle;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.company.attendance.R;
import com.company.attendance.api.Api;
import com.company.attendance.api.Cb;
import com.company.attendance.model.Models;
import com.company.attendance.util.Prefs;

/** Admin dashboard: today's numbers + shortcuts to every admin screen. */
public class AdminHomeActivity extends AppCompatActivity {
    private TextView tvStats;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_admin_home);
        ((TextView) findViewById(R.id.tvHello)).setText("Admin: " + Prefs.name());
        tvStats = findViewById(R.id.tvStats);

        findViewById(R.id.btnAttendance).setOnClickListener(v -> startActivity(new Intent(this, AdminAttendanceActivity.class)));
        findViewById(R.id.btnEmployees).setOnClickListener(v -> startActivity(new Intent(this, AdminEmployeesActivity.class)));
        findViewById(R.id.btnLeaves).setOnClickListener(v -> startActivity(new Intent(this, AdminLeavesActivity.class)));
        findViewById(R.id.btnHolidays).setOnClickListener(v -> startActivity(new Intent(this, HolidaysActivity.class)));
        findViewById(R.id.btnReports).setOnClickListener(v -> startActivity(new Intent(this, AdminReportsActivity.class)));
        findViewById(R.id.btnLogout).setOnClickListener(v -> {
            Prefs.clear();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        Api.get().adminStats().enqueue(new Cb<Models.AdminStats>(this) {
            @Override
            public void ok(Models.AdminStats s) {
                String day = s.is_holiday ? "  (Holiday: " + s.holiday_name + ")" : s.is_weekend ? "  (Weekend)" : "";
                tvStats.setText("Today  " + s.date + day
                        + "\n\nEmployees:  " + s.total_employees
                        + "\nPresent:  " + s.present
                        + "\nAbsent / not in yet:  " + s.absent
                        + "\nOn leave:  " + s.on_leave
                        + "\nWork from office:  " + s.wfo
                        + "\nWork from home:  " + s.wfh
                        + "\nLate today:  " + s.late
                        + "\nPending leave requests:  " + s.pending_leaves);
            }
        });
    }
}
