package com.company.attendance;

import android.app.Application;

import com.company.attendance.util.Prefs;

public class App extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        Prefs.init(this);
    }
}
