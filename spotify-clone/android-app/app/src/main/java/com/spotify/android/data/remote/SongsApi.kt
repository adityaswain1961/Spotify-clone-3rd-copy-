package com.spotify.android.data.remote

import retrofit2.http.GET
import retrofit2.http.Path

interface SongsApi {
    @GET("/songs/{id}")
    suspend fun getSong(@Path("id") id: String): SongDto

    @GET("/songs/{id}/stream")
    suspend fun getStreamUrl(@Path("id") id: String): StreamUrlResponse
}

