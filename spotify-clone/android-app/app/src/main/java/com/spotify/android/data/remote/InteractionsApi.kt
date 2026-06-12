package com.spotify.android.data.remote

import retrofit2.http.Body
import retrofit2.http.POST

interface InteractionsApi {
    @POST("/interactions/likes")
    suspend fun toggleLike(@Body request: LikeRequest): ToggleResponse
}

