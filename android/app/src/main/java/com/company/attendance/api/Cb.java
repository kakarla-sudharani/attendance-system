package com.company.attendance.api;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;

import com.company.attendance.ui.LoginActivity;
import com.company.attendance.util.Prefs;
import com.company.attendance.util.Ui;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Callback that handles errors for you:
 *  - override ok() for success
 *  - override fail() only if you need custom error handling (default = show a toast)
 *  - a 401 (expired session) automatically sends the user back to Login
 */
public abstract class Cb<T> implements Callback<T> {
    private final Context ctx;

    protected Cb(Context ctx) { this.ctx = ctx; }

    public abstract void ok(T body);

    public void fail(int code, String message, JsonObject err) { Ui.toast(ctx, message); }

    private boolean gone() { return ctx instanceof Activity && ((Activity) ctx).isFinishing(); }

    @Override
    public void onResponse(Call<T> call, Response<T> r) {
        if (gone()) return;
        if (r.isSuccessful()) {
            ok(r.body());
            return;
        }
        String msg = "Request failed (" + r.code() + ")";
        JsonObject err = null;
        try {
            if (r.errorBody() != null) {
                err = JsonParser.parseString(r.errorBody().string()).getAsJsonObject();
                if (err.has("error")) msg = err.get("error").getAsString();
            }
        } catch (Exception ignored) { }

        if (r.code() == 401 && Prefs.token() != null) {
            Prefs.clear();
            Intent i = new Intent(ctx, LoginActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            ctx.startActivity(i);
            Ui.toast(ctx, "Session expired. Please log in again.");
            return;
        }
        fail(r.code(), msg, err);
    }

    @Override
    public void onFailure(Call<T> call, Throwable t) {
        if (gone()) return;
        fail(0, "Cannot reach the server. Check the server address and that the backend is running.", null);
    }
}
