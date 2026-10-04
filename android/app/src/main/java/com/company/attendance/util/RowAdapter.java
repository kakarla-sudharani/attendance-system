package com.company.attendance.util;

import android.content.Context;
import android.graphics.drawable.GradientDrawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.TextView;

import com.company.attendance.R;

import java.util.ArrayList;
import java.util.List;

/** One generic list adapter (title, subtitle, coloured badge) used by every list screen. */
public class RowAdapter extends BaseAdapter {
    public static class Row {
        public String title, subtitle, badge;
        public int badgeColor;
        public Object tag;

        public Row(String title, String subtitle, String badge, int badgeColor, Object tag) {
            this.title = title;
            this.subtitle = subtitle;
            this.badge = badge;
            this.badgeColor = badgeColor;
            this.tag = tag;
        }
    }

    private final Context ctx;
    private final List<Row> rows = new ArrayList<>();

    public RowAdapter(Context ctx) { this.ctx = ctx; }

    /** Replace all rows and show/hide the "Nothing to show" view. */
    public void submit(List<Row> newRows, View emptyView) {
        rows.clear();
        rows.addAll(newRows);
        notifyDataSetChanged();
        if (emptyView != null) emptyView.setVisibility(rows.isEmpty() ? View.VISIBLE : View.GONE);
    }

    @Override public int getCount() { return rows.size(); }
    @Override public Row getItem(int i) { return rows.get(i); }
    @Override public long getItemId(int i) { return i; }

    @Override
    public View getView(int i, View convert, ViewGroup parent) {
        if (convert == null) convert = LayoutInflater.from(ctx).inflate(R.layout.item_row, parent, false);
        Row r = rows.get(i);
        ((TextView) convert.findViewById(R.id.tvTitle)).setText(r.title);
        TextView sub = convert.findViewById(R.id.tvSub);
        sub.setText(r.subtitle == null ? "" : r.subtitle);
        sub.setVisibility(r.subtitle == null || r.subtitle.isEmpty() ? View.GONE : View.VISIBLE);
        TextView badge = convert.findViewById(R.id.tvBadge);
        if (r.badge == null || r.badge.isEmpty()) {
            badge.setVisibility(View.GONE);
        } else {
            badge.setVisibility(View.VISIBLE);
            badge.setText(r.badge);
            GradientDrawable g = new GradientDrawable();
            g.setCornerRadius(Ui.dp(ctx, 12));
            g.setColor(r.badgeColor);
            badge.setBackground(g);
        }
        return convert;
    }
}
