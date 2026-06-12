package com.spotify.android.data.repository

import com.spotify.android.data.remote.SongsApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class SongsRepository(
    private val songsApi: SongsApi
) {
    fun streamSong(songId: String): Flow<Result<String>> = flow {
        emit(runCatching { songsApi.getStreamUrl(songId).streamUrl })
    }
}

