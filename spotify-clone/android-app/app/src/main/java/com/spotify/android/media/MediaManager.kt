package com.spotify.android.media

import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.spotify.android.data.repository.SongsRepository
import com.spotify.android.ui.model.SongUiModel
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Singleton
class MediaManager @Inject constructor(
    private val exoPlayer: ExoPlayer,
    private val songsRepository: SongsRepository
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var progressJob: Job? = null

    private val _playbackState = MutableStateFlow(PlaybackState())
    val playbackState: StateFlow<PlaybackState> = _playbackState.asStateFlow()

    fun player(): ExoPlayer = exoPlayer

    init {
        exoPlayer.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                updateFromPlayer(isBuffering = playbackState == Player.STATE_BUFFERING)
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                updateFromPlayer()
                if (isPlaying) startProgressUpdates() else stopProgressUpdates()
            }

            override fun onPlayerError(error: PlaybackException) {
                updateFromPlayer()
            }
        })
    }

    fun setQueue(songs: List<SongUiModel>) {
        _playbackState.value = _playbackState.value.copy(
            queue = songs,
            queueIndex = if (songs.isNotEmpty()) 0 else -1
        )
    }

    fun playSong(songId: String) {
        scope.launch {
            val streamUrl = songsRepository.streamSong(songId).first().getOrNull() ?: return@launch
            val mediaItem = MediaItem.fromUri(streamUrl)
            exoPlayer.setMediaItem(mediaItem)
            exoPlayer.prepare()
            exoPlayer.playWhenReady = true

            val current = _playbackState.value
            val index = current.queue.indexOfFirst { it.id == songId }
            val song = current.queue.getOrNull(index).let { it ?: SongUiModel(id = songId, title = "Now Playing") }
            _playbackState.value = current.copy(
                currentSong = song,
                queueIndex = if (index >= 0) index else current.queueIndex
            )
            updateFromPlayer()
        }
    }

    fun pause() {
        exoPlayer.pause()
    }

    fun resume() {
        exoPlayer.play()
    }

    fun seekTo(position: Long) {
        exoPlayer.seekTo(position)
        updateFromPlayer()
    }

    fun skipNext() {
        val state = _playbackState.value
        val nextIndex = state.queueIndex + 1
        val next = state.queue.getOrNull(nextIndex) ?: return
        _playbackState.value = state.copy(queueIndex = nextIndex, currentSong = next)
        playSong(next.id)
    }

    fun skipPrevious() {
        val state = _playbackState.value
        val prevIndex = state.queueIndex - 1
        val prev = state.queue.getOrNull(prevIndex) ?: return
        _playbackState.value = state.copy(queueIndex = prevIndex, currentSong = prev)
        playSong(prev.id)
    }

    private fun startProgressUpdates() {
        if (progressJob?.isActive == true) return
        progressJob = scope.launch {
            while (true) {
                updateFromPlayer()
                delay(1000)
            }
        }
    }

    private fun stopProgressUpdates() {
        progressJob?.cancel()
        progressJob = null
    }

    private fun updateFromPlayer(isBuffering: Boolean = exoPlayer.playbackState == Player.STATE_BUFFERING) {
        val state = _playbackState.value
        _playbackState.value = state.copy(
            isPlaying = exoPlayer.isPlaying,
            positionMs = exoPlayer.currentPosition.coerceAtLeast(0L),
            durationMs = exoPlayer.duration.coerceAtLeast(0L),
            isBuffering = isBuffering
        )
    }
}

