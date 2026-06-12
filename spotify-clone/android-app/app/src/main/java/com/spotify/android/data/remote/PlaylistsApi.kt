package com.spotify.android.data.remote

import retrofit2.http.GET
import retrofit2.http.Query

interface PlaylistsApi {
    @GET("/playlists/me")
    suspend fun getMyPlaylists(
        @Query("page") page: Int,
        @Query("size") size: Int
    ): Map<String, Any?>
}

