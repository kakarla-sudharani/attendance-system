package com.company.attendance.util;

import android.view.View;
import android.widget.TextView;

import com.company.attendance.R;

import java.util.Calendar;

/** Controls the "‹ September 2026 ›" bar (view_month_bar.xml). */
public class MonthBar {
    public interface Listener { void onChange(int month, int year); }

    private int month, year;
    private final TextView label;

    public MonthBar(View root, final Listener l) {
        Calendar c = Calendar.getInstance();
        month = c.get(Calendar.MONTH) + 1;
        year = c.get(Calendar.YEAR);
        label = root.findViewById(R.id.tvMonth);
        update();
        root.findViewById(R.id.btnPrev).setOnClickListener(v -> {
            month--;
            if (month < 1) { month = 12; year--; }
            update();
            l.onChange(month, year);
        });
        root.findViewById(R.id.btnNext).setOnClickListener(v -> {
            month++;
            if (month > 12) { month = 1; year++; }
            update();
            l.onChange(month, year);
        });
    }

    private void update() { label.setText(Ui.monthTitle(month, year)); }

    public int month() { return month; }
    public int year() { return year; }
}
