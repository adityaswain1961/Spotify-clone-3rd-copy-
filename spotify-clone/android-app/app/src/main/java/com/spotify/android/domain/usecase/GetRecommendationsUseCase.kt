package com.spotify.android.domain.usecase

import com.spotify.android.data.remote.RecommendationsApi
import com.spotify.android.data.remote.RecommendationsResponse
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class GetRecommendationsUseCase(
    private val recommendationsApi: RecommendationsApi
) {
    operator fun invoke(): Flow<Result<RecommendationsResponse>> = flow {
        emit(runCatching { recommendationsApi.forYou() })
    }
}

