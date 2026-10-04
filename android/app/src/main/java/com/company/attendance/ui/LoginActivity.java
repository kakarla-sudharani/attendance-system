package com.company.attendance.ui;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;

import androidx.appcompat.app.AppCompatActivity;

import com.company.attendance.R;
import com.company.attendance.api.Api;
import com.company.attendance.api.Cb;
import com.company.attendance.model.Models;
import com.company.attendance.util.Prefs;
import com.company.attendance.util.Ui;
import com.google.gson.JsonObject;

import java.util.HashMap;
import java.util.Map;

public class LoginActivity extends AppCompatActivity {
    private EditText etServer, etEmail, etPassword;
    private Button btnLogin;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Prefs.token() != null) { // already logged in
            goHome();
            return;
        }
        setContentView(R.layout.activity_login);
        etServer = findViewById(R.id.etServer);
        etEmail = findViewById(R.id.etEmail);
        etPassword = findViewById(R.id.etPassword);
        btnLogin = findViewById(R.id.btnLogin);
        etServer.setText(Prefs.baseUrl());
        btnLogin.setOnClickListener(v -> login());
    }

    private void goHome() {
        Class<?> target = "admin".equals(Prefs.role()) ? AdminHomeActivity.class : HomeActivity.class;
        startActivity(new Intent(this, target));
        finish();
    }

    private void login() {
        String email = etEmail.getText().toString().trim();
        String pass = etPassword.getText().toString();
        if (email.isEmpty() || pass.isEmpty()) {
            Ui.toast(this, "Enter email and password");
            return;
        }
        Prefs.setBaseUrl(etServer.getText().toString());
        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("password", pass);
        btnLogin.setEnabled(false);
        Api.get().login(body).enqueue(new Cb<Models.LoginRes>(this) {
            @Override
            public void ok(Models.LoginRes r) {
                btnLogin.setEnabled(true);
                Prefs.save(r.token, r.employee.role, r.employee.name);
                goHome();
            }

            @Override
            public void fail(int code, String message, JsonObject err) {
                btnLogin.setEnabled(true);
                super.fail(code, message, err);
            }
        });
    }
}
