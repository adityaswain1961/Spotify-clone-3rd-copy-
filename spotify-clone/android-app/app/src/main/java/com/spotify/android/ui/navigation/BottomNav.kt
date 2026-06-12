package com.spotify.android.ui.navigation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.spotify.android.media.PlaybackState

sealed class NavDestination(val route: String, val label: String) {
    data object Home : NavDestination("home", "Home")
    data object Search : NavDestination("search", "Search")
    data object Library : NavDestination("library", "Library")
    data object Player : NavDestination("player", "Player")
}

@Composable
fun BottomNavScaffold(
    currentRoute: String,
    playbackState: PlaybackState,
    onNavigate: (String) -> Unit,
    content: @Composable () -> Unit
) {
    Scaffold(
        bottomBar = {
            Column {
                if (playbackState.currentSong != null) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onNavigate(NavDestination.Player.route) }
                            .padding(12.dp)
                    ) {
                        Text(
                            text = "${playbackState.currentSong.title} • ${playbackState.currentSong.artistName}",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
                NavigationBar {
                    val items = listOf(NavDestination.Home, NavDestination.Search, NavDestination.Library)
                    items.forEach { item ->
                        NavigationBarItem(
                            selected = currentRoute == item.route,
                            onClick = { onNavigate(item.route) },
                            icon = {
                                val icon = when (item) {
                                    NavDestination.Home -> Icons.Default.Home
                                    NavDestination.Search -> Icons.Default.Search
                                    NavDestination.Library -> Icons.Default.LibraryMusic
                                    NavDestination.Player -> Icons.Default.Home
                                }
                                Icon(icon, contentDescription = item.label)
                            },
                            label = { Text(item.label) }
                        )
                    }
                }
            }
        }
    ) { _ ->
        content()
    }
}

