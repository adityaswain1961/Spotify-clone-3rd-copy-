package com.spotify.android.media

import com.spotify.android.ui.model.SongUiModel

data class PlaybackState(
    val currentSong: SongUiModel? = null,
    val isPlaying: Boolean = false,
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val isBuffering: Boolean = false,
    val queue: List<SongUiModel> = emptyList(),
    val queueIndex: Int = -1
)

