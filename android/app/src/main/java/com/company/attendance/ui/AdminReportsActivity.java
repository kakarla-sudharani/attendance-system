package com.company.attendance.ui;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ListView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.company.attendance.R;
import com.company.attendance.api.Api;
import com.company.attendance.api.Cb;
import com.company.attendance.model.Models;
import com.company.attendance.util.MonthBar;
import com.company.attendance.util.RowAdapter;
import com.company.attendance.util.Ui;

import java.util.ArrayList;
import java.util.List;

/** Admin reports: monthly summary for every employee, and the late attendance report. */
public class AdminReportsActivity extends AppCompatActivity {
    private RowAdapter adapter;
    private MonthBar bar;
    private TextView tvHeader, tvEmpty;
    private Button btnMode;
    private boolean lateMode = false;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_list);
        ((TextView) findViewById(R.id.tvTitle)).setText("Reports");
        tvHeader = findViewById(R.id.tvHeader);
        tvEmpty = findViewById(R.id.tvEmpty);
        tvHeader.setVisibility(View.VISIBLE);
        btnMode = findViewById(R.id.btnAction);
        btnMode.setVisibility(View.VISIBLE);
        btnMode.setOnClickListener(v -> {
            lateMode = !lateMode;
            load();
        });

        adapter = new RowAdapter(this);
        ((ListView) findViewById(R.id.list)).setAdapter(adapter);
        bar = new MonthBar(findViewById(R.id.monthBar), (m, y) -> load());
        load();
    }

    private void load() {
        btnMode.setText(lateMode ? "Showing: Late attendance report (tap for summary)" : "Showing: Monthly summary (tap for late report)");
        if (lateMode) {
            Api.get().reportLate(bar.month(), bar.year()).enqueue(new Cb<List<Models.LateRow>>(this) {
                @Override
                public void ok(List<Models.LateRow> list) {
                    List<RowAdapter.Row> rows = new ArrayList<>();
                    for (Models.LateRow r : list) {
                        rows.add(new RowAdapter.Row(r.employee_name + " · " + r.date,
                                "Login " + Ui.hhmm(r.login_time) + (r.work_mode != null ? " · " + r.work_mode : "")
                                        + "\nReason: " + (r.late_reason == null ? "-" : r.late_reason),
                                "LATE", Ui.color("unapproved_leave"), r));
                    }
                    tvHeader.setText(list.size() + " late arrival(s) in " + Ui.monthTitle(bar.month(), bar.year()));
                    adapter.submit(rows, tvEmpty);
                }
            });
        } else {
            Api.get().reportMonthly(bar.month(), bar.year()).enqueue(new Cb<List<Models.Summary>>(this) {
                @Override
                public void ok(List<Models.Summary> list) {
                    List<RowAdapter.Row> rows = new ArrayList<>();
                    for (Models.Summary s : list) {
                        double p = s.attendance_percentage;
                        int color = p >= 90 ? Color.parseColor("#2DA44E") : p >= 75 ? Color.parseColor("#BF8700") : Color.parseColor("#CF222E");
                        rows.add(new RowAdapter.Row(s.name,
                                "Present " + s.present_days + " · Absent " + s.absent_days + " · Leave "
                                        + (s.approved_leaves + s.unapproved_leaves) + " · Holidays " + s.holidays
                                        + "\nWFO " + s.wfo_days + " · WFH " + s.wfh_days + " · Late " + s.late_days
                                        + " · Working days " + s.working_days,
                                Math.round(p) + "%", color, s));
                    }
                    tvHeader.setText("Attendance summary for " + Ui.monthTitle(bar.month(), bar.year()));
                    adapter.submit(rows, tvEmpty);
                }
            });
        }
    }
}
