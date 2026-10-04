package com.company.attendance.util;

import android.content.Context;
import android.content.SharedPreferences;

public class Prefs {
    private static SharedPreferences sp;

    public static void init(Context c) {
        sp = c.getApplicationContext().getSharedPreferences("attendance", Context.MODE_PRIVATE);
    }

    public static String token() { return sp.getString("token", null); }
    public static String role() { return sp.getString("role", null); }
    public static String name() { return sp.getString("name", ""); }

    public static void save(String token, String role, String name) {
        sp.edit().putString("token", token).putString("role", role).putString("name", name).apply();
    }

    /** Logs out but remembers the server address. */
    public static void clear() {
        String url = baseUrl();
        sp.edit().clear().putString("url", url).apply();
    }

    public static String baseUrl() { return sp.getString("url", Config.DEFAULT_SERVER); }

    public static void setBaseUrl(String u) {
        u = u == null ? "" : u.trim();
        while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
        if (u.endsWith("/api")) u = u.substring(0, u.length() - 4);
        if (u.isEmpty()) u = Config.DEFAULT_SERVER;
        if (!u.startsWith("http")) u = "http://" + u;
        sp.edit().putString("url", u).apply();
    }
}
