package com.spotify.android.domain.usecase

import com.spotify.android.data.remote.InteractionsApi
import com.spotify.android.data.remote.LikeRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class LikeSongUseCase(private val interactionsApi: InteractionsApi) {
    operator fun invoke(songId: String): Flow<Result<Boolean>> = flow {
        emit(runCatching { interactionsApi.toggleLike(LikeRequest(songId = songId)).liked ?: false })
    }
}

