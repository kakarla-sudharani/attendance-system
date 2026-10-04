package com.company.attendance.ui;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ListView;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Admin: review leave requests - approve, or mark unapproved. */
public class AdminLeavesActivity extends AppCompatActivity {
    private static final String[] FILTERS = {"pending", "approved", "unapproved", ""};
    private int filterIdx = 0;
    private RowAdapter adapter;
    private TextView tvEmpty;
    private Button btnFilter;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_list);
        ((TextView) findViewById(R.id.tvTitle)).setText("Leave Management");
        findViewById(R.id.monthBar).setVisibility(View.GONE);
        tvEmpty = findViewById(R.id.tvEmpty);
        TextView header = findViewById(R.id.tvHeader);
        header.setVisibility(View.VISIBLE);
        header.setText("Tap a request to approve or mark it unapproved.");
        btnFilter = findViewById(R.id.btnAction);
        btnFilter.setVisibility(View.VISIBLE);
        btnFilter.setOnClickListener(v -> {
            filterIdx = (filterIdx + 1) % FILTERS.length;
            load();
        });

        adapter = new RowAdapter(this);
        ListView list = findViewById(R.id.list);
        list.setAdapter(adapter);
        list.setOnItemClickListener((p, v, pos, id) -> review((Models.Leave) adapter.getItem(pos).tag));
        load();
    }

    private void load() {
        String f = FILTERS[filterIdx];
        btnFilter.setText("Showing: " + (f.isEmpty() ? "all" : f) + "   (tap to change)");
        Api.get().adminLeaves(f.isEmpty() ? null : f).enqueue(new Cb<List<Models.Leave>>(this) {
            @Override
            public void ok(List<Models.Leave> list) {
                List<RowAdapter.Row> rows = new ArrayList<>();
                for (Models.Leave l : list) {
                    String range = l.date_from.equals(l.date_to) ? l.date_from : l.date_from + " → " + l.date_to;
                    rows.add(new RowAdapter.Row(l.employee_name + "\n" + range,
                            l.leave_type + (l.reason != null ? " · " + l.reason : ""),
                            Ui.label(l.status), Ui.color(l.status), l));
                }
                adapter.submit(rows, tvEmpty);
            }
        });
    }

    private void review(final Models.Leave l) {
        new AlertDialog.Builder(this)
                .setTitle(l.employee_name)
                .setMessage(l.date_from + " → " + l.date_to + "\n" + l.leave_type
                        + (l.reason != null ? "\nReason: " + l.reason : "") + "\nCurrent: " + Ui.label(l.status))
                .setPositiveButton("Approve", (d, w) -> send(l, "approved"))
                .setNegativeButton("Unapproved", (d, w) -> send(l, "unapproved"))
                .setNeutralButton("Close", null)
                .show();
    }

    private void send(Models.Leave l, final String status) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", status);
        Api.get().reviewLeave(l.id, body).enqueue(new Cb<JsonObject>(this) {
            @Override
            public void ok(JsonObject r) {
                Ui.toast(AdminLeavesActivity.this, "Leave marked " + status);
                load();
            }
        });
    }
}
