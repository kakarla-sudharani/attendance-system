package com.company.attendance.api;

import com.company.attendance.model.Models;
import com.google.gson.JsonObject;

import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.PUT;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface ApiService {

    // ---- auth ----
    @POST("auth/login")
    Call<Models.LoginRes> login(@Body Map<String, Object> body);

    // ---- employee ----
    @GET("attendance/today")
    Call<Models.Today> today();

    @POST("attendance/checkin")
    Call<JsonObject> checkIn(@Body Map<String, Object> body);

    @POST("attendance/checkout")
    Call<JsonObject> checkOut();

    @GET("attendance/history")
    Call<Models.MonthRes> history(@Query("month") int month, @Query("year") int year);

    @GET("attendance/late-report")
    Call<List<Models.LateRow>> lateReport(@Query("month") int month, @Query("year") int year);

    @GET("summary/monthly")
    Call<Models.Summary> summary(@Query("month") int month, @Query("year") int year);

    @POST("leaves/apply")
    Call<JsonObject> applyLeave(@Body Map<String, Object> body);

    @GET("leaves/mine")
    Call<List<Models.Leave>> myLeaves();

    @DELETE("leaves/{id}")
    Call<JsonObject> cancelLeave(@Path("id") int id);

    // ---- holidays ----
    @GET("holidays")
    Call<Models.HolidayRes> holidays(@Query("month") int month, @Query("year") int year);

    @GET("holidays/monthly-counts")
    Call<List<Models.MonthCount>> monthlyCounts(@Query("year") int year);

    @POST("holidays")
    Call<JsonObject> addHoliday(@Body Map<String, Object> body);

    @DELETE("holidays/{id}")
    Call<JsonObject> deleteHoliday(@Path("id") int id);

    // ---- admin ----
    @GET("admin/stats")
    Call<Models.AdminStats> adminStats();

    @GET("admin/employees")
    Call<List<Models.User>> employees();

    @POST("admin/employees")
    Call<JsonObject> addEmployee(@Body Map<String, Object> body);

    @DELETE("admin/employees/{id}")
    Call<JsonObject> deactivateEmployee(@Path("id") int id);

    @GET("admin/attendance")
    Call<List<Models.AdminAttRow>> adminAttendance(@Query("date") String date);

    @PUT("admin/attendance")
    Call<JsonObject> adminSetAttendance(@Body Map<String, Object> body);

    @GET("admin/leaves")
    Call<List<Models.Leave>> adminLeaves(@Query("status") String status);

    @PUT("admin/leaves/{id}/review")
    Call<JsonObject> reviewLeave(@Path("id") int id, @Body Map<String, Object> body);

    @GET("admin/reports/monthly")
    Call<List<Models.Summary>> reportMonthly(@Query("month") int month, @Query("year") int year);

    @GET("admin/reports/late")
    Call<List<Models.LateRow>> reportLate(@Query("month") int month, @Query("year") int year);
}
