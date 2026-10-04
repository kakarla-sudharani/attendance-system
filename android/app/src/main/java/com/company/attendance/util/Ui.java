package com.company.attendance.util;

import android.app.DatePickerDialog;
import android.app.TimePickerDialog;
import android.content.Context;
import android.graphics.Color;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Calendar;

public class Ui {
    public static final String[] MONTHS = {"January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"};

    public static void toast(Context c, String m) { Toast.makeText(c, m, Toast.LENGTH_LONG).show(); }

    public static int dp(Context c, int v) { return Math.round(v * c.getResources().getDisplayMetrics().density); }

    public static String pad(int n) { return n < 10 ? "0" + n : String.valueOf(n); }

    /** "2026-09-28 09:15:00" -> "09:15" */
    public static String hhmm(String dt) {
        if (dt == null || dt.length() < 16) return "--:--";
        return dt.substring(11, 16);
    }

    public static String monthTitle(int m, int y) { return MONTHS[m - 1] + " " + y; }

    public static String label(String s) {
        if (s == null) return "";
        switch (s) {
            case "present": return "Present";
            case "absent": return "Absent";
            case "leave": return "Leave";
            case "unapproved_leave": return "Unapproved";
            case "holiday": return "Holiday";
            case "weekend": return "Weekend";
            case "not_marked": return "Not marked";
            case "pending": return "Pending";
            case "approved": return "Approved";
            case "unapproved": return "Unapproved";
            default: return s;
        }
    }

    public static int color(String s) {
        if (s == null) return Color.parseColor("#6E7781");
        switch (s) {
            case "present":
            case "approved": return Color.parseColor("#2DA44E");
            case "absent":
            case "unapproved": return Color.parseColor("#CF222E");
            case "leave": return Color.parseColor("#0969DA");
            case "unapproved_leave": return Color.parseColor("#D9480F");
            case "holiday": return Color.parseColor("#8250DF");
            case "not_marked":
            case "pending": return Color.parseColor("#BF8700");
            default: return Color.parseColor("#6E7781");
        }
    }

    public static EditText field(Context c, String hint) {
        EditText e = new EditText(c);
        e.setHint(hint);
        e.setSingleLine(true);
        return e;
    }

    public static EditText dateField(final Context c, String hint) {
        final EditText e = field(c, hint);
        e.setFocusable(false);
        e.setOnClickListener(v -> {
            Calendar cal = Calendar.getInstance();
            new DatePickerDialog(c, (view, y, m, d) -> e.setText(y + "-" + pad(m + 1) + "-" + pad(d)),
                    cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show();
        });
        return e;
    }

    public static EditText timeField(final Context c, String hint) {
        final EditText e = field(c, hint);
        e.setFocusable(false);
        e.setOnClickListener(v -> {
            Calendar cal = Calendar.getInstance();
            new TimePickerDialog(c, (view, h, min) -> e.setText(pad(h) + ":" + pad(min)),
                    cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE), true).show();
        });
        return e;
    }

    public static TextView caption(Context c, String text) {
        TextView t = new TextView(c);
        t.setText(text);
        t.setPadding(0, dp(c, 8), 0, 0);
        return t;
    }

    public static LinearLayout form(Context c, View... views) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.VERTICAL);
        int p = dp(c, 20);
        l.setPadding(p, dp(c, 8), p, 0);
        for (View v : views) l.addView(v);
        return l;
    }
}
