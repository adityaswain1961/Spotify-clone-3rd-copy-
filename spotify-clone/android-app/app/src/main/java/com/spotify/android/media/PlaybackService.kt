package com.spotify.android.media

import android.app.Notification
import androidx.core.app.NotificationCompat
import androidx.media3.session.MediaNotification
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class PlaybackService : MediaSessionService() {
    @Inject lateinit var mediaManager: MediaManager

    private var mediaSession: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        mediaSession = MediaSession.Builder(this, mediaManager.player()).build()
        setMediaNotificationProvider(PlaybackNotificationProvider())
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

    override fun onDestroy() {
        mediaSession?.release()
        mediaSession = null
        super.onDestroy()
    }

    private class PlaybackNotificationProvider : MediaNotification.Provider {
        override fun createNotification(
            mediaSession: MediaSession,
            customLayout: MutableList<MediaNotification.Action>,
            actionFactory: MediaNotification.ActionFactory,
            onNotificationChangedCallback: MediaNotification.Provider.Callback
        ): MediaNotification {
            val notification: Notification = NotificationCompat.Builder(mediaSession.context, "playback")
                .setContentTitle("Spotify Clone")
                .setContentText("Playback in progress")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setOngoing(mediaSession.player.isPlaying)
                .build()
            return MediaNotification(1001, notification)
        }

        override fun handleCustomCommand(
            session: MediaSession,
            action: String,
            extras: android.os.Bundle
        ): Boolean = false
    }
}

