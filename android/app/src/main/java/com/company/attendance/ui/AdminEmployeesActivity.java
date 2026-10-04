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

public class AdminEmployeesActivity extends AppCompatActivity {
    private RowAdapter adapter;
    private TextView tvEmpty;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(R.layout.activity_list);
        ((TextView) findViewById(R.id.tvTitle)).setText("Employees");
        findViewById(R.id.monthBar).setVisibility(View.GONE);
        tvEmpty = findViewById(R.id.tvEmpty);
        TextView header = findViewById(R.id.tvHeader);
        header.setVisibility(View.VISIBLE);
        header.setText("Long-press an employee to deactivate.");
        Button btn = findViewById(R.id.btnAction);
        btn.setVisibility(View.VISIBLE);
        btn.setText("Add employee");
        btn.setOnClickListener(v -> addDialog());

        adapter = new RowAdapter(this);
        ListView list = findViewById(R.id.list);
        list.setAdapter(adapter);
        list.setOnItemLongClickListener((p, v, pos, id) -> {
            final Models.User u = (Models.User) adapter.getItem(pos).tag;
            new AlertDialog.Builder(this).setTitle("Deactivate " + u.name + "?")
                    .setMessage("They will no longer be able to log in. Their attendance history is kept.")
                    .setPositiveButton("Deactivate", (d, w) -> Api.get().deactivateEmployee(u.id).enqueue(new Cb<JsonObject>(this) {
                        @Override
                        public void ok(JsonObject r) { load(); }
                    }))
                    .setNegativeButton("Cancel", null).show();
            return true;
        });
        load();
    }

    private void load() {
        Api.get().employees().enqueue(new Cb<List<Models.User>>(this) {
            @Override
            public void ok(List<Models.User> users) {
                List<RowAdapter.Row> rows = new ArrayList<>();
                for (Models.User u : users) {
                    boolean active = u.is_active == 1;
                    rows.add(new RowAdapter.Row(u.name,
                            u.email + "\n" + (u.department == null ? "-" : u.department) + " · " + u.role,
                            active ? "Active" : "Inactive", Ui.color(active ? "present" : "absent"), u));
                }
                adapter.submit(rows, tvEmpty);
            }
        });
    }

    private void addDialog() {
        final EditText name = Ui.field(this, "Full name");
        final EditText email = Ui.field(this, "Email");
        final EditText pass = Ui.field(this, "Password (min 6 characters)");
        final EditText dept = Ui.field(this, "Department");
        final EditText joined = Ui.dateField(this, "Join date");
        final Spinner role = new Spinner(this);
        role.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item,
                new String[]{"employee", "admin"}));

        new AlertDialog.Builder(this).setTitle("Add employee")
                .setView(Ui.form(this, name, email, pass, dept, joined, Ui.caption(this, "Role"), role))
                .setPositiveButton("Add", (d, w) -> {
                    Map<String, Object> body = new HashMap<>();
                    body.put("name", name.getText().toString().trim());
                    body.put("email", email.getText().toString().trim());
                    body.put("password", pass.getText().toString());
                    body.put("department", dept.getText().toString().trim());
                    body.put("join_date", joined.getText().toString());
                    body.put("role", role.getSelectedItem().toString());
                    Api.get().addEmployee(body).enqueue(new Cb<JsonObject>(this) {
                        @Override
                        public void ok(JsonObject r) {
                            Ui.toast(AdminEmployeesActivity.this, "Employee added");
                            load();
                        }
                    });
                })
                .setNegativeButton("Cancel", null).show();
    }
}
