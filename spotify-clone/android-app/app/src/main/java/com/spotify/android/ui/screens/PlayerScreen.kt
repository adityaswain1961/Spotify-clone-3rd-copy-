package com.spotify.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.spotify.android.media.MediaManager
import com.spotify.android.media.PlaybackState
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.StateFlow

data class PlayerUiState(
    val playbackState: PlaybackState = PlaybackState(),
    val liked: Boolean = false
)

sealed interface PlayerIntent {
    data object PlayPause : PlayerIntent
    data object Next : PlayerIntent
    data object Previous : PlayerIntent
    data class Seek(val position: Long) : PlayerIntent
    data object ToggleLike : PlayerIntent
}

@HiltViewModel
class PlayerViewModel @Inject constructor(
    private val mediaManager: MediaManager
) : ViewModel() {
    val playbackState: StateFlow<PlaybackState> = mediaManager.playbackState

    fun onIntent(intent: PlayerIntent) {
        when (intent) {
            PlayerIntent.PlayPause -> if (playbackState.value.isPlaying) mediaManager.pause() else mediaManager.resume()
            PlayerIntent.Next -> mediaManager.skipNext()
            PlayerIntent.Previous -> mediaManager.skipPrevious()
            is PlayerIntent.Seek -> mediaManager.seekTo(intent.position)
            PlayerIntent.ToggleLike -> Unit
        }
    }
}

@Composable
fun PlayerScreen(viewModel: PlayerViewModel = hiltViewModel()) {
    val playback by viewModel.playbackState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(playback.currentSong?.title ?: "Nothing Playing", style = MaterialTheme.typography.headlineSmall)
        Text(playback.currentSong?.artistName ?: "", style = MaterialTheme.typography.bodyMedium)

        Slider(
            value = playback.positionMs.toFloat(),
            onValueChange = { viewModel.onIntent(PlayerIntent.Seek(it.toLong())) },
            valueRange = 0f..(playback.durationMs.coerceAtLeast(1L).toFloat()),
            modifier = Modifier.fillMaxWidth()
        )

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = { viewModel.onIntent(PlayerIntent.Previous) }) { Text("Prev") }
            Button(onClick = { viewModel.onIntent(PlayerIntent.PlayPause) }) {
                Text(if (playback.isPlaying) "Pause" else "Play")
            }
            Button(onClick = { viewModel.onIntent(PlayerIntent.Next) }) { Text("Next") }
            Button(onClick = { viewModel.onIntent(PlayerIntent.ToggleLike) }) { Text("Like") }
        }
    }
}

