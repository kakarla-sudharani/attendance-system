package com.company.attendance.ui;

import android.os.Bundle;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.company.attendance.R;
import com.company.attendance.api.Api;
import com.company.attendance.api.Cb;
import com.company.attendance.model.Models;
import com.company.attendance.util.MonthBar;

public class SummaryActivity extends AppCompatActivity {
    private MonthBar bar;
    private TextView tvPercent, tvDetails;
    private ProgressBar progress;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_summary);
        tvPercent = findViewById(R.id.tvPercent);
        tvDetails = findViewById(R.id.tvDetails);
        progress = findViewById(R.id.progress);
        bar = new MonthBar(findViewById(R.id.monthBar), (m, y) -> load());
        load();
    }

    private void load() {
        Api.get().summary(bar.month(), bar.year()).enqueue(new Cb<Models.Summary>(this) {
            @Override
            public void ok(Models.Summary s) {
                tvPercent.setText(s.attendance_percentage + "%");
                progress.setProgress((int) Math.round(s.attendance_percentage));
                tvDetails.setText("Working days:  " + s.working_days
                        + "\nPresent days:  " + s.present_days
                        + "\nAbsent days:  " + s.absent_days
                        + "\nApproved leaves:  " + s.approved_leaves
                        + "\nUnapproved leaves:  " + s.unapproved_leaves
                        + "\nHolidays:  " + s.holidays
                        + "\nWork from office:  " + s.wfo_days + " days"
                        + "\nWork from home:  " + s.wfh_days + " days"
                        + "\nLate arrivals:  " + s.late_days);
            }
        });
    }
}
