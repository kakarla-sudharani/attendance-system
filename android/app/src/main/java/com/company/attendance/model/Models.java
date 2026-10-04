package com.company.attendance.model;

import java.util.List;

/** JSON shapes returned by the backend (field names match the API exactly). */
public class Models {

    public static class User {
        public int id;
        public String name, email, role, department, join_date;
        public int is_active;
    }

    public static class LoginRes {
        public String token;
        public User employee;
    }

    public static class AttRecord {
        public String status, work_mode, login_time, logout_time, late_reason;
        public int is_late;
    }

    public static class Today {
        public String date, holiday_name, late_after, status;
        public AttRecord record;
        public boolean is_holiday, is_weekend, on_leave, is_late_now;
    }

    public static class Day {
        public String date, weekday, status, work_mode, login_time, logout_time, late_reason, holiday_name, leave_type;
        public int is_late;
    }

    /** Monthly summary. name/department/employee_id are filled only in admin reports. */
    public static class Summary {
        public int employee_id;
        public String name, department;
        public int month, year;
        public int working_days, working_days_till_date, present_days, absent_days;
        public int approved_leaves, unapproved_leaves, holidays, weekends;
        public int wfo_days, wfh_days, late_days, extra_days_worked;
        public double attendance_percentage;
    }

    public static class MonthRes {
        public List<Day> days;
        public Summary summary;
    }

    public static class LateRow {
        public String date, employee_name, department, work_mode, login_time, late_reason;
    }

    public static class Leave {
        public int id, employee_id;
        public String employee_name, date_from, date_to, leave_type, reason, status;
    }

    public static class Holiday {
        public int id;
        public String holiday_date, name;
    }

    public static class HolidayRes {
        public int count;
        public List<Holiday> holidays;
    }

    public static class MonthCount {
        public int month, count;
    }

    public static class AdminStats {
        public String date, holiday_name;
        public int total_employees, present, absent, on_leave, wfo, wfh, late, pending_leaves;
        public boolean is_holiday, is_weekend;
    }

    public static class AdminAttRow {
        public int employee_id;
        public String name, department, status, work_mode, login_time, logout_time, late_reason, holiday_name, leave_type;
        public int is_late;
    }
}
