package com.spotify.android.domain.usecase

import com.spotify.android.data.repository.SearchRepository

class SearchUseCase(private val searchRepository: SearchRepository) {
    operator fun invoke(query: String, type: String = "all") = searchRepository.search(query, type)
}

