package com.spotify.android.data.repository

import com.spotify.android.data.remote.PlaylistsApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class PlaylistRepository(
    private val playlistsApi: PlaylistsApi
) {
    fun myPlaylists(page: Int = 1, size: Int = 20): Flow<Result<Map<String, Any?>>> = flow {
        emit(runCatching { playlistsApi.getMyPlaylists(page, size) })
    }
}

