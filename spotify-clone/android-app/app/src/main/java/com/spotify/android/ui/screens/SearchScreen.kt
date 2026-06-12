package com.spotify.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.spotify.android.domain.usecase.SearchUseCase
import com.spotify.android.ui.model.SongUiModel
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SearchUiState(
    val query: String = "",
    val loading: Boolean = false,
    val songs: List<SongUiModel> = emptyList(),
    val artists: List<String> = emptyList(),
    val playlists: List<String> = emptyList()
)

sealed interface SearchIntent {
    data class QueryChanged(val query: String) : SearchIntent
}

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val searchUseCase: SearchUseCase
) : ViewModel() {
    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()
    private var debounceJob: Job? = null

    fun onIntent(intent: SearchIntent) {
        when (intent) {
            is SearchIntent.QueryChanged -> onQueryChanged(intent.query)
        }
    }

    private fun onQueryChanged(query: String) {
        _uiState.value = _uiState.value.copy(query = query)
        debounceJob?.cancel()
        debounceJob = viewModelScope.launch {
            delay(300)
            if (query.isBlank()) {
                _uiState.value = _uiState.value.copy(songs = emptyList(), artists = emptyList(), playlists = emptyList())
                return@launch
            }
            _uiState.value = _uiState.value.copy(loading = true)
            searchUseCase(query).collect { result ->
                val data = result.getOrNull()
                _uiState.value = _uiState.value.copy(
                    loading = false,
                    songs = data?.songs?.map { SongUiModel(id = it.id, title = it.title) } ?: emptyList(),
                    artists = data?.artists?.map { it["stage_name"]?.toString().orEmpty() } ?: emptyList(),
                    playlists = data?.playlists?.map { it["title"]?.toString().orEmpty() } ?: emptyList()
                )
            }
        }
    }
}

@Composable
fun SearchScreen(viewModel: SearchViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        OutlinedTextField(
            value = state.query,
            onValueChange = { viewModel.onIntent(SearchIntent.QueryChanged(it)) },
            label = { Text("Search songs, artists, playlists") },
            modifier = Modifier.fillMaxWidth()
        )

        if (state.loading) {
            CircularProgressIndicator()
        }

        if (!state.loading && state.query.isNotBlank() &&
            state.songs.isEmpty() && state.artists.isEmpty() && state.playlists.isEmpty()
        ) {
            Text("No results", style = MaterialTheme.typography.bodyLarge)
        }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (state.songs.isNotEmpty()) {
                item { Text("Songs", style = MaterialTheme.typography.titleMedium) }
                items(state.songs) { Text(it.title) }
            }
            if (state.artists.isNotEmpty()) {
                item { Text("Artists", style = MaterialTheme.typography.titleMedium) }
                items(state.artists) { Text(it) }
            }
            if (state.playlists.isNotEmpty()) {
                item { Text("Playlists", style = MaterialTheme.typography.titleMedium) }
                items(state.playlists) { Text(it) }
            }
        }
    }
}

