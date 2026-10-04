package com.company.attendance.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.RadioButton;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.company.attendance.R;
import com.company.attendance.api.Api;
import com.company.attendance.api.Cb;
import com.company.attendance.model.Models;
import com.company.attendance.util.Prefs;
import com.company.attendance.util.Ui;
import com.google.gson.JsonObject;

import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;

/** Employee home: check in / check out, work mode, today's status, month percentage. */
public class HomeActivity extends AppCompatActivity {
    private TextView tvDate, tvStatus, tvTimes, tvLate, tvPercent, tvSummary;
    private RadioButton rbWfo, rbWfh;
    private Button btnIn, btnOut;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_home);
        ((TextView) findViewById(R.id.tvHello)).setText("Hello, " + Prefs.name());
        tvDate = findViewById(R.id.tvDate);
        tvStatus = findViewById(R.id.tvStatus);
        tvTimes = findViewById(R.id.tvTimes);
        tvLate = findViewById(R.id.tvLate);
        tvPercent = findViewById(R.id.tvPercent);
        tvSummary = findViewById(R.id.tvSummary);
        rbWfo = findViewById(R.id.rbWfo);
        rbWfh = findViewById(R.id.rbWfh);
        btnIn = findViewById(R.id.btnIn);
        btnOut = findViewById(R.id.btnOut);

        btnIn.setOnClickListener(v -> checkIn(null));
        btnOut.setOnClickListener(v -> new AlertDialog.Builder(this)
                .setTitle("Check out?")
                .setMessage("This records your exit time for today.")
                .setPositiveButton("Check out", (d, w) -> checkOut())
                .setNegativeButton("Cancel", null)
                .show());

        findViewById(R.id.btnHistory).setOnClickListener(v -> startActivity(new Intent(this, HistoryActivity.class)));
        findViewById(R.id.btnSummary).setOnClickListener(v -> startActivity(new Intent(this, SummaryActivity.class)));
        findViewById(R.id.btnLeaves).setOnClickListener(v -> startActivity(new Intent(this, LeavesActivity.class)));
        findViewById(R.id.btnHolidays).setOnClickListener(v -> startActivity(new Intent(this, HolidaysActivity.class)));
        findViewById(R.id.btnLate).setOnClickListener(v ->
                startActivity(new Intent(this, HistoryActivity.class).putExtra("late_only", true)));
        findViewById(R.id.btnLogout).setOnClickListener(v -> {
            Prefs.clear();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        load();
    }

    private void load() {
        Api.get().today().enqueue(new Cb<Models.Today>(this) {
            @Override
            public void ok(Models.Today t) { render(t); }
        });
        Calendar c = Calendar.getInstance();
        Api.get().summary(c.get(Calendar.MONTH) + 1, c.get(Calendar.YEAR)).enqueue(new Cb<Models.Summary>(this) {
            @Override
            public void ok(Models.Summary s) {
                tvPercent.setText("Attendance this month: " + s.attendance_percentage + "%");
                tvSummary.setText("Working days " + s.working_days + "  |  Present " + s.present_days
                        + "  |  Absent " + s.absent_days + "\nLeaves " + (s.approved_leaves + s.unapproved_leaves)
                        + "  |  Holidays " + s.holidays + "  |  Late " + s.late_days
                        + "\nWFO " + s.wfo_days + "  |  WFH " + s.wfh_days);
            }
        });
    }

    private void render(Models.Today t) {
        String note = t.is_holiday ? "  •  Holiday: " + t.holiday_name : t.is_weekend ? "  •  Weekend" : t.on_leave ? "  •  On leave" : "";
        tvDate.setText(t.date + note);

        Models.AttRecord r = t.record;
        boolean in = r != null && r.login_time != null && "present".equals(r.status);
        boolean out = in && r.logout_time != null;

        if (in) {
            tvStatus.setText("Present · " + r.work_mode + (r.is_late == 1 ? " · Late" : ""));
            tvTimes.setText("In: " + Ui.hhmm(r.login_time) + "     Out: " + (out ? Ui.hhmm(r.logout_time) : "--:--"));
            if ("WFH".equals(r.work_mode)) rbWfh.setChecked(true); else rbWfo.setChecked(true);
        } else {
            tvStatus.setText("Not checked in");
            tvTimes.setText("");
        }
        rbWfo.setEnabled(!in);
        rbWfh.setEnabled(!in);
        btnIn.setEnabled(!in);
        btnOut.setEnabled(in && !out);

        boolean showLate = !in && t.is_late_now;
        tvLate.setVisibility(showLate ? View.VISIBLE : View.GONE);
        tvLate.setText("It is after " + t.late_after + ". You must give a reason to check in.");
    }

    private void checkIn(String lateReason) {
        Map<String, Object> body = new HashMap<>();
        body.put("work_mode", rbWfh.isChecked() ? "WFH" : "WFO");
        if (lateReason != null) body.put("late_reason", lateReason);

        Api.get().checkIn(body).enqueue(new Cb<JsonObject>(this) {
            @Override
            public void ok(JsonObject r) {
                Ui.toast(HomeActivity.this, "Checked in");
                load();
            }

            @Override
            public void fail(int code, String message, JsonObject err) {
                boolean lateNeeded = err != null && err.has("code")
                        && "LATE_REASON_REQUIRED".equals(err.get("code").getAsString());
                if (lateNeeded) askLateReason(); else super.fail(code, message, err);
            }
        });
    }

    /** Late login: attendance is only recorded after a reason is provided. */
    private void askLateReason() {
        final EditText input = Ui.field(this, "Reason for late login");
        new AlertDialog.Builder(this)
                .setTitle("You are logging in late")
                .setMessage("Please give a reason. Attendance is recorded only after this.")
                .setView(Ui.form(this, input))
                .setCancelable(false)
                .setPositiveButton("Submit", (d, w) -> {
                    String reason = input.getText().toString().trim();
                    if (reason.isEmpty()) {
                        Ui.toast(this, "A reason is required");
                        askLateReason();
                    } else {
                        checkIn(reason);
                    }
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void checkOut() {
        Api.get().checkOut().enqueue(new Cb<JsonObject>(this) {
            @Override
            public void ok(JsonObject r) {
                Ui.toast(HomeActivity.this, "Checked out");
                load();
            }
        });
    }
}
