package com.spotify.android.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.spotify.android.data.repository.PlaylistRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class LibraryUiState(
    val loading: Boolean = false,
    val playlists: List<String> = emptyList()
)

sealed interface LibraryIntent {
    data object Load : LibraryIntent
    data object CreatePlaylist : LibraryIntent
    data class OpenPlaylist(val id: String) : LibraryIntent
}

@HiltViewModel
class LibraryViewModel @Inject constructor(
    private val playlistRepository: PlaylistRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(LibraryUiState())
    val uiState: StateFlow<LibraryUiState> = _uiState.asStateFlow()

    init {
        onIntent(LibraryIntent.Load)
    }

    fun onIntent(intent: LibraryIntent) {
        when (intent) {
            LibraryIntent.Load -> load()
            LibraryIntent.CreatePlaylist -> Unit
            is LibraryIntent.OpenPlaylist -> Unit
        }
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true)
            playlistRepository.myPlaylists().collect { result ->
                val items = (result.getOrNull()?.get("items") as? List<Map<String, Any?>>)
                    ?.mapNotNull { it["title"]?.toString() }
                    ?: emptyList()
                _uiState.value = LibraryUiState(loading = false, playlists = items)
            }
        }
    }
}

@Composable
fun LibraryScreen(
    onOpenPlaylist: (String) -> Unit,
    onCreatePlaylist: () -> Unit,
    viewModel: LibraryViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = onCreatePlaylist) {
                Text("+")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text("My Library", style = MaterialTheme.typography.titleLarge)
            LazyColumn {
                items(state.playlists) { playlist ->
                    Text(
                        text = playlist,
                        modifier = Modifier
                            .padding(8.dp)
                            .clickable { onOpenPlaylist(playlist) }
                    )
                }
            }
        }
    }
}

