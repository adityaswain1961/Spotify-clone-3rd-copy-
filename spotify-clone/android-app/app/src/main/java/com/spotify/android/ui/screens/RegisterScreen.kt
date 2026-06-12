package com.spotify.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spotify.android.domain.usecase.RegisterUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class RegisterUiState(
    val loading: Boolean = false,
    val error: String? = null
)

sealed interface RegisterIntent {
    data class Submit(val email: String, val password: String, val displayName: String) : RegisterIntent
}

@HiltViewModel
class RegisterViewModel @Inject constructor(
    private val registerUseCase: RegisterUseCase
) : ViewModel() {
    private val _uiState = MutableStateFlow(RegisterUiState())
    val uiState: StateFlow<RegisterUiState> = _uiState.asStateFlow()

    fun onIntent(intent: RegisterIntent) {
        when (intent) {
            is RegisterIntent.Submit -> submit(intent.email, intent.password, intent.displayName)
        }
    }

    private fun submit(email: String, password: String, displayName: String) {
        viewModelScope.launch {
            _uiState.value = RegisterUiState(loading = true)
            registerUseCase(email, password, displayName).collect { result ->
                _uiState.value = RegisterUiState(loading = false, error = result.exceptionOrNull()?.message)
            }
        }
    }
}

@Composable
fun RegisterScreen(
    onRegisterSuccess: () -> Unit,
    onGoToLogin: () -> Unit,
    viewModel: RegisterViewModel = hiltViewModel()
) {
    val state = viewModel.uiState.value
    var displayName by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }

    val displayNameValid = displayName.isNotBlank()
    val emailValid = email.contains("@")
    val passwordValid = password.length >= 8

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Register", style = MaterialTheme.typography.headlineSmall)
        OutlinedTextField(
            value = displayName,
            onValueChange = { displayName = it },
            label = { Text("Display name") },
            isError = displayName.isNotEmpty() && !displayNameValid,
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            isError = email.isNotEmpty() && !emailValid,
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            isError = password.isNotEmpty() && !passwordValid,
            modifier = Modifier.fillMaxWidth()
        )
        if (state.error != null) {
            Text(state.error, color = MaterialTheme.colorScheme.error)
        }
        Button(
            onClick = {
                viewModel.onIntent(RegisterIntent.Submit(email, password, displayName))
                onRegisterSuccess()
            },
            enabled = displayNameValid && emailValid && passwordValid && !state.loading
        ) { Text(if (state.loading) "Creating..." else "Register") }
        Button(onClick = onGoToLogin) { Text("Back to login") }
    }
}

