package com.spotify.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.spotify.android.domain.usecase.GetRecommendationsUseCase
import com.spotify.android.ui.components.SongCard
import com.spotify.android.ui.model.SongUiModel
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HomeUiState(
    val loading: Boolean = false,
    val forYou: List<SongUiModel> = emptyList(),
    val trending: List<SongUiModel> = emptyList()
)

sealed interface HomeIntent {
    data object Refresh : HomeIntent
    data class PlaySong(val song: SongUiModel) : HomeIntent
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val getRecommendationsUseCase: GetRecommendationsUseCase
) : ViewModel() {
    private val _uiState = MutableStateFlow(HomeUiState(loading = true))
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        onIntent(HomeIntent.Refresh)
    }

    fun onIntent(intent: HomeIntent) {
        when (intent) {
            HomeIntent.Refresh -> refresh()
            is HomeIntent.PlaySong -> Unit
        }
    }

    private fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true)
            val result = getRecommendationsUseCase().collect { outcome ->
                val songs = outcome.getOrNull()?.songIds?.map {
                    SongUiModel(id = it, title = "Song $it")
                } ?: emptyList()
                _uiState.value = HomeUiState(
                    loading = false,
                    forYou = songs,
                    trending = songs
                )
            }
        }
    }
}

@Composable
fun HomeScreen(
    onPlaySong: (SongUiModel) -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        if (state.loading) {
            CircularProgressIndicator()
        }

        Text("For You", style = MaterialTheme.typography.titleLarge)
        LazyRow(contentPadding = PaddingValues(horizontal = 4.dp)) {
            items(state.forYou) { song ->
                SongCard(song = song, onClick = onPlaySong)
            }
        }

        Text("Trending", style = MaterialTheme.typography.titleLarge)
        LazyRow(contentPadding = PaddingValues(horizontal = 4.dp)) {
            items(state.trending) { song ->
                SongCard(song = song, onClick = onPlaySong)
            }
        }
    }
}

