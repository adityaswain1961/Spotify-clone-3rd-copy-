package com.spotify.android.data.repository

import com.spotify.android.data.remote.SearchApi
import com.spotify.android.data.remote.SearchResponse
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class SearchRepository(
    private val searchApi: SearchApi
) {
    fun search(query: String, type: String = "all"): Flow<Result<SearchResponse>> = flow {
        emit(runCatching { searchApi.search(query, type = type) })
    }
}

