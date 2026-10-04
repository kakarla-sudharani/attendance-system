package com.company.attendance.ui;

import android.os.Bundle;
import android.view.View;
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

/** Month-wise attendance history. With extra "late_only" it becomes the Late Attendance Report. */
public class HistoryActivity extends AppCompatActivity {
    private RowAdapter adapter;
    private MonthBar bar;
    private TextView tvHeader, tvEmpty;
    private boolean lateOnly;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_list);
        lateOnly = getIntent().getBooleanExtra("late_only", false);
        ((TextView) findViewById(R.id.tvTitle)).setText(lateOnly ? "Late Attendance Report" : "Attendance History");
        tvHeader = findViewById(R.id.tvHeader);
        tvEmpty = findViewById(R.id.tvEmpty);
        tvHeader.setVisibility(View.VISIBLE);
        adapter = new RowAdapter(this);
        ((ListView) findViewById(R.id.list)).setAdapter(adapter);
        bar = new MonthBar(findViewById(R.id.monthBar), (m, y) -> load());
        load();
    }

    private void load() {
        if (lateOnly) {
            Api.get().lateReport(bar.month(), bar.year()).enqueue(new Cb<List<Models.LateRow>>(this) {
                @Override
                public void ok(List<Models.LateRow> list) {
                    List<RowAdapter.Row> rows = new ArrayList<>();
                    for (Models.LateRow r : list) {
                        rows.add(new RowAdapter.Row(r.date,
                                "Login " + Ui.hhmm(r.login_time) + (r.work_mode != null ? " · " + r.work_mode : "")
                                        + "\nReason: " + (r.late_reason == null ? "-" : r.late_reason),
                                "LATE", Ui.color("unapproved_leave"), r));
                    }
                    tvHeader.setText(list.size() + " late arrival(s) in " + Ui.monthTitle(bar.month(), bar.year()));
                    adapter.submit(rows, tvEmpty);
                }
            });
        } else {
            Api.get().history(bar.month(), bar.year()).enqueue(new Cb<Models.MonthRes>(this) {
                @Override
                public void ok(Models.MonthRes res) {
                    List<RowAdapter.Row> rows = new ArrayList<>();
                    for (int i = res.days.size() - 1; i >= 0; i--) { // latest first
                        Models.Day d = res.days.get(i);
                        if ("upcoming".equals(d.status)) continue;
                        String sub = "";
                        if ("present".equals(d.status)) {
                            sub = "In " + Ui.hhmm(d.login_time) + " · Out " + Ui.hhmm(d.logout_time)
                                    + (d.work_mode != null ? " · " + d.work_mode : "");
                            if (d.is_late == 1) sub += "\nLate: " + (d.late_reason == null ? "-" : d.late_reason);
                        } else if ("holiday".equals(d.status) && d.holiday_name != null) {
                            sub = d.holiday_name;
                        } else if (d.leave_type != null) {
                            sub = d.leave_type + " leave";
                        }
                        rows.add(new RowAdapter.Row(d.weekday + "  " + d.date, sub, Ui.label(d.status), Ui.color(d.status), d));
                    }
                    Models.Summary s = res.summary;
                    tvHeader.setText("Present " + s.present_days + "  |  Absent " + s.absent_days + "  |  Leaves "
                            + (s.approved_leaves + s.unapproved_leaves) + "  |  " + s.attendance_percentage + "%");
                    adapter.submit(rows, tvEmpty);
                }
            });
        }
    }
}
