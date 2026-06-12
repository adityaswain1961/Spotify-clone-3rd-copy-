package com.spotify.android.data.remote

import retrofit2.http.GET
import retrofit2.http.Query

interface SearchApi {
    @GET("/search")
    suspend fun search(
        @Query("q") q: String,
        @Query("type") type: String = "all",
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 10
    ): SearchResponse
}

