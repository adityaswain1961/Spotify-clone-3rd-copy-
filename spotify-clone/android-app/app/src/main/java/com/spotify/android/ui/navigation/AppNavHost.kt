package com.spotify.android.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.spotify.android.ui.screens.HomeScreen
import com.spotify.android.ui.screens.LibraryScreen
import com.spotify.android.ui.screens.LoginScreen
import com.spotify.android.ui.screens.PlayerScreen
import com.spotify.android.ui.screens.PlayerIntent
import com.spotify.android.ui.screens.PlayerViewModel
import com.spotify.android.ui.screens.RegisterScreen
import com.spotify.android.ui.screens.SearchScreen

@Composable
fun AppNavHost() {
    val navController = rememberNavController()
    val currentRoute = navController.currentBackStackEntryAsState().value?.destination?.route
    val playerViewModel: PlayerViewModel = hiltViewModel()
    val playbackState by playerViewModel.playbackState.collectAsStateWithLifecycle()

    BottomNavScaffold(
        currentRoute = currentRoute ?: NavDestination.Home.route,
        playbackState = playbackState,
        onNavigate = { navController.navigate(it) }
    ) {
        NavHost(
            navController = navController,
            startDestination = "login"
        ) {
            composable("login") {
                LoginScreen(
                    onLoginSuccess = { navController.navigate(NavDestination.Home.route) },
                    onGoToRegister = { navController.navigate("register") }
                )
            }
            composable("register") {
                RegisterScreen(
                    onRegisterSuccess = { navController.navigate(NavDestination.Home.route) },
                    onGoToLogin = { navController.navigate("login") }
                )
            }
            composable(NavDestination.Home.route) {
                HomeScreen(onPlaySong = {
                    playerViewModel.onIntent(PlayerIntent.PlayPause)
                    navController.navigate(NavDestination.Player.route)
                })
            }
            composable(NavDestination.Search.route) { SearchScreen() }
            composable(NavDestination.Library.route) {
                LibraryScreen(
                    onOpenPlaylist = { },
                    onCreatePlaylist = { }
                )
            }
            composable(NavDestination.Player.route) { PlayerScreen() }
        }
    }
}

