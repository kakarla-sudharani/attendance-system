package com.company.attendance.api;

import com.company.attendance.util.Prefs;

import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

/** Builds the Retrofit client; automatically adds the JWT token to every request. */
public class Api {
    private static ApiService service;
    private static String builtFor;

    public static synchronized ApiService get() {
        String base = Prefs.baseUrl();
        if (service == null || !base.equals(builtFor)) {
            OkHttpClient client = new OkHttpClient.Builder()
                    .connectTimeout(15, TimeUnit.SECONDS)
                    .readTimeout(20, TimeUnit.SECONDS)
                    .addInterceptor(chain -> {
                        Request.Builder b = chain.request().newBuilder();
                        String token = Prefs.token();
                        if (token != null) b.header("Authorization", "Bearer " + token);
                        return chain.proceed(b.build());
                    })
                    .build();
            service = new Retrofit.Builder()
                    .baseUrl(base + "/api/")
                    .client(client)
                    .addConverterFactory(GsonConverterFactory.create())
                    .build()
                    .create(ApiService.class);
            builtFor = base;
        }
        return service;
    }
}
