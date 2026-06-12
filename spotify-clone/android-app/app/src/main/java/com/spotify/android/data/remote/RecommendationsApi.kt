package com.spotify.android.data.remote

import retrofit2.http.GET

interface RecommendationsApi {
    @GET("/recommendations/for-you")
    suspend fun forYou(): RecommendationsResponse

    @GET("/recommendations/trending")
    suspend fun trending(): RecommendationsResponse
}

