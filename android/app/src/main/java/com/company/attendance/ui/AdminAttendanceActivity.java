package com.company.attendance.ui;

import android.app.DatePickerDialog;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.Spinner;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.company.attendance.R;
import com.company.attendance.api.Api;
import com.company.attendance.api.Cb;
import com.company.attendance.model.Models;
import com.company.attendance.util.RowAdapter;
import com.company.attendance.util.Ui;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Admin: attendance of every employee for a chosen date; tap a row to edit status / WFO-WFH / times. */
public class AdminAttendanceActivity extends AppCompatActivity {
    private RowAdapter adapter;
    private TextView tvEmpty;
    private Button btnDate;
    private String date;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_list);
        ((TextView) findViewById(R.id.tvTitle)).setText("Employee Attendance");
        findViewById(R.id.monthBar).setVisibility(View.GONE);
        tvEmpty = findViewById(R.id.tvEmpty);
        TextView header = findViewById(R.id.tvHeader);
        header.setVisibility(View.VISIBLE);
        header.setText("Tap an employee to edit their attendance for the day.");

        Calendar c = Calendar.getInstance();
        date = c.get(Calendar.YEAR) + "-" + Ui.pad(c.get(Calendar.MONTH) + 1) + "-" + Ui.pad(c.get(Calendar.DAY_OF_MONTH));
        btnDate = findViewById(R.id.btnAction);
        btnDate.setVisibility(View.VISIBLE);
        btnDate.setOnClickListener(v -> pickDate());

        adapter = new RowAdapter(this);
        ListView list = findViewById(R.id.list);
        list.setAdapter(adapter);
        list.setOnItemClickListener((p, v, pos, id) -> edit((Models.AdminAttRow) adapter.getItem(pos).tag));
        load();
    }

    private void pickDate() {
        Calendar c = Calendar.getInstance();
        new DatePickerDialog(this, (view, y, m, d) -> {
            date = y + "-" + Ui.pad(m + 1) + "-" + Ui.pad(d);
            load();
        }, c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH)).show();
    }

    private void load() {
        btnDate.setText("Date: " + date + "   (tap to change)");
        Api.get().adminAttendance(date).enqueue(new Cb<List<Models.AdminAttRow>>(this) {
            @Override
            public void ok(List<Models.AdminAttRow> list) {
                List<RowAdapter.Row> rows = new ArrayList<>();
                for (Models.AdminAttRow r : list) {
                    String sub = r.department == null ? "" : r.department;
                    if ("present".equals(r.status)) {
                        sub += "\nIn " + Ui.hhmm(r.login_time) + " · Out " + Ui.hhmm(r.logout_time)
                                + (r.work_mode != null ? " · " + r.work_mode : "");
                        if (r.is_late == 1) sub += "\nLate: " + (r.late_reason == null ? "-" : r.late_reason);
                    } else if ("holiday".equals(r.status) && r.holiday_name != null) {
                        sub += "\n" + r.holiday_name;
                    } else if (r.leave_type != null) {
                        sub += "\n" + r.leave_type + " leave";
                    }
                    rows.add(new RowAdapter.Row(r.name, sub, Ui.label(r.status), Ui.color(r.status), r));
                }
                adapter.submit(rows, tvEmpty);
            }
        });
    }

    private void edit(final Models.AdminAttRow r) {
        final Spinner status = new Spinner(this);
        status.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new String[]{"present", "absent"}));
        final Spinner mode = new Spinner(this);
        mode.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new String[]{"WFO", "WFH"}));
        final EditText in = Ui.timeField(this, "Login time");
        final EditText out = Ui.timeField(this, "Logout time");
        final EditText reason = Ui.field(this, "Late reason (optional)");

        if ("absent".equals(r.status)) status.setSelection(1);
        if ("WFH".equals(r.work_mode)) mode.setSelection(1);
        if (r.login_time != null) in.setText(Ui.hhmm(r.login_time));
        if (r.logout_time != null) out.setText(Ui.hhmm(r.logout_time));
        if (r.late_reason != null) reason.setText(r.late_reason);

        new AlertDialog.Builder(this).setTitle(r.name + " · " + date)
                .setView(Ui.form(this, Ui.caption(this, "Status"), status, Ui.caption(this, "Work mode"), mode, in, out, reason))
                .setPositiveButton("Save", (d, w) -> {
                    Map<String, Object> body = new HashMap<>();
                    body.put("employee_id", r.employee_id);
                    body.put("date", date);
                    body.put("status", status.getSelectedItem().toString());
                    body.put("work_mode", mode.getSelectedItem().toString());
                    String li = in.getText().toString(), lo = out.getText().toString();
                    if (!li.isEmpty()) body.put("login_time", li);
                    if (!lo.isEmpty()) body.put("logout_time", lo);
                    body.put("late_reason", reason.getText().toString().trim());
                    Api.get().adminSetAttendance(body).enqueue(new Cb<JsonObject>(this) {
                        @Override
                        public void ok(JsonObject res) {
                            Ui.toast(AdminAttendanceActivity.this, "Saved");
                            load();
                        }
                    });
                })
                .setNegativeButton("Cancel", null).show();
    }
}
