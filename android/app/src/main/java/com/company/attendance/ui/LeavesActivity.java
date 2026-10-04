package com.company.attendance.ui;

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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Employee: apply for leave, see approved / unapproved / pending leaves. */
public class LeavesActivity extends AppCompatActivity {
    private RowAdapter adapter;
    private TextView tvEmpty;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_list);
        ((TextView) findViewById(R.id.tvTitle)).setText("My Leaves");
        findViewById(R.id.monthBar).setVisibility(View.GONE);
        tvEmpty = findViewById(R.id.tvEmpty);
        Button btn = findViewById(R.id.btnAction);
        btn.setVisibility(View.VISIBLE);
        btn.setText("Apply for leave");
        btn.setOnClickListener(v -> applyDialog());

        adapter = new RowAdapter(this);
        ListView list = findViewById(R.id.list);
        list.setAdapter(adapter);
        list.setOnItemLongClickListener((p, v, pos, id) -> {
            final Models.Leave l = (Models.Leave) adapter.getItem(pos).tag;
            if (!"pending".equals(l.status)) {
                Ui.toast(this, "Only pending leaves can be cancelled");
                return true;
            }
            new AlertDialog.Builder(this).setTitle("Cancel this leave request?")
                    .setPositiveButton("Yes, cancel", (d, w) -> Api.get().cancelLeave(l.id).enqueue(new Cb<JsonObject>(this) {
                        @Override
                        public void ok(JsonObject r) { load(); }
                    }))
                    .setNegativeButton("No", null).show();
            return true;
        });
        load();
    }

    private void load() {
        Api.get().myLeaves().enqueue(new Cb<List<Models.Leave>>(this) {
            @Override
            public void ok(List<Models.Leave> list) {
                List<RowAdapter.Row> rows = new ArrayList<>();
                for (Models.Leave l : list) {
                    String range = l.date_from.equals(l.date_to) ? l.date_from : l.date_from + "  →  " + l.date_to;
                    rows.add(new RowAdapter.Row(range,
                            l.leave_type + (l.reason != null ? " · " + l.reason : ""),
                            Ui.label(l.status), Ui.color(l.status), l));
                }
                adapter.submit(rows, tvEmpty);
            }
        });
    }

    private void applyDialog() {
        final EditText from = Ui.dateField(this, "From date");
        final EditText to = Ui.dateField(this, "To date");
        final Spinner type = new Spinner(this);
        type.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item,
                new String[]{"casual", "sick", "earned", "other"}));
        final EditText reason = Ui.field(this, "Reason");

        new AlertDialog.Builder(this).setTitle("Apply for leave")
                .setView(Ui.form(this, from, to, Ui.caption(this, "Type"), type, reason))
                .setPositiveButton("Apply", (d, w) -> {
                    Map<String, Object> body = new HashMap<>();
                    body.put("date_from", from.getText().toString());
                    body.put("date_to", to.getText().toString());
                    body.put("leave_type", type.getSelectedItem().toString());
                    body.put("reason", reason.getText().toString().trim());
                    Api.get().applyLeave(body).enqueue(new Cb<JsonObject>(this) {
                        @Override
                        public void ok(JsonObject r) {
                            Ui.toast(LeavesActivity.this, "Leave request sent");
                            load();
                        }
                    });
                })
                .setNegativeButton("Cancel", null).show();
    }
}
