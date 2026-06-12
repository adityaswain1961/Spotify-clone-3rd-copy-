package com.spotify.android.ui.model

data class SongUiModel(
    val id: String,
    val title: String,
    val artistName: String = "",
    val artworkUrl: String? = null
)

