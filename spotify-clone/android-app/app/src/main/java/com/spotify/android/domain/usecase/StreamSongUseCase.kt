package com.spotify.android.domain.usecase

import com.spotify.android.data.repository.SongsRepository

class StreamSongUseCase(private val songsRepository: SongsRepository) {
    operator fun invoke(songId: String) = songsRepository.streamSong(songId)
}

