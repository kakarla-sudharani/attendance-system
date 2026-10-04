package com.company.attendance.ui;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.company.attendance.R;
import com.company.attendance.api.Api;
import com.company.attendance.api.Cb;
import com.company.attendance.model.Models;
import com.company.attendance.util.MonthBar;
import com.company.attendance.util.Prefs;
import com.company.attendance.util.RowAdapter;
import com.company.attendance.util.Ui;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Holidays per month (+ per-month counts for the whole year). Admins can add / delete. */
public class HolidaysActivity extends AppCompatActivity {
    private RowAdapter adapter;
    private MonthBar bar;
    private TextView tvHeader, tvEmpty;
    private boolean admin;
    private String countLine = "", yearLine = "";

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_list);
        admin = "admin".equals(Prefs.role());
        ((TextView) findViewById(R.id.tvTitle)).setText("Holidays");
        tvHeader = findViewById(R.id.tvHeader);
        tvEmpty = findViewById(R.id.tvEmpty);
        tvHeader.setVisibility(View.VISIBLE);

        adapter = new RowAdapter(this);
        ListView list = findViewById(R.id.list);
        list.setAdapter(adapter);

        if (admin) {
            Button btn = findViewById(R.id.btnAction);
            btn.setVisibility(View.VISIBLE);
            btn.setText("Add holiday");
            btn.setOnClickListener(v -> addDialog());
            list.setOnItemLongClickListener((p, v, pos, id) -> {
                final Models.Holiday h = (Models.Holiday) adapter.getItem(pos).tag;
                new AlertDialog.Builder(this).setTitle("Delete \"" + h.name + "\"?")
                        .setPositiveButton("Delete", (d, w) -> Api.get().deleteHoliday(h.id).enqueue(new Cb<JsonObject>(this) {
                            @Override
                            public void ok(JsonObject r) { load(); }
                        }))
                        .setNegativeButton("Cancel", null).show();
                return true;
            });
        }
        bar = new MonthBar(findViewById(R.id.monthBar), (m, y) -> load());
        load();
    }

    private void refreshHeader() { tvHeader.setText(countLine + (yearLine.isEmpty() ? "" : "\n" + yearLine)); }

    private void load() {
        final int m = bar.month(), y = bar.year();
        Api.get().holidays(m, y).enqueue(new Cb<Models.HolidayRes>(this) {
            @Override
            public void ok(Models.HolidayRes res) {
                List<RowAdapter.Row> rows = new ArrayList<>();
                for (Models.Holiday h : res.holidays) {
                    rows.add(new RowAdapter.Row(h.name, h.holiday_date, null, 0, h));
                }
                countLine = res.count + " holiday(s) in " + Ui.monthTitle(m, y);
                refreshHeader();
                adapter.submit(rows, tvEmpty);
            }
        });
        Api.get().monthlyCounts(y).enqueue(new Cb<List<Models.MonthCount>>(this) {
            @Override
            public void ok(List<Models.MonthCount> counts) {
                StringBuilder sb = new StringBuilder(y + ":  ");
                for (Models.MonthCount c : counts) {
                    sb.append(Ui.MONTHS[c.month - 1], 0, 3).append(' ').append(c.count);
                    if (c.month < 12) sb.append(" · ");
                }
                yearLine = sb.toString();
                refreshHeader();
            }
        });
    }

    private void addDialog() {
        final EditText date = Ui.dateField(this, "Date");
        final EditText name = Ui.field(this, "Holiday name");
        new AlertDialog.Builder(this).setTitle("Add holiday")
                .setView(Ui.form(this, date, name))
                .setPositiveButton("Add", (d, w) -> {
                    Map<String, Object> body = new HashMap<>();
                    body.put("holiday_date", date.getText().toString());
                    body.put("name", name.getText().toString().trim());
                    Api.get().addHoliday(body).enqueue(new Cb<JsonObject>(this) {
                        @Override
                        public void ok(JsonObject r) { load(); }
                    });
                })
                .setNegativeButton("Cancel", null).show();
    }
}
