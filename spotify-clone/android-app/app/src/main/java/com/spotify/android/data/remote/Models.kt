package com.spotify.android.data.remote

data class AuthTokensDto(
    val accessToken: String,
    val refreshToken: String
)

data class LoginRequest(val email: String, val password: String)
data class RegisterRequest(val email: String, val password: String, val displayName: String)
data class RefreshRequest(val refreshToken: String)

data class SongDto(
    val id: String,
    val title: String,
    val duration: Int,
    val coverImageKey: String? = null
)

data class StreamUrlResponse(val streamUrl: String)
data class LikeRequest(val songId: String? = null, val playlistId: String? = null)
data class ToggleResponse(val liked: Boolean? = null, val following: Boolean? = null)
data class SearchResponse(
    val songs: List<SongDto> = emptyList(),
    val artists: List<Map<String, Any?>> = emptyList(),
    val playlists: List<Map<String, Any?>> = emptyList()
)
data class RecommendationsResponse(val songIds: List<String>, val source: String? = null)

