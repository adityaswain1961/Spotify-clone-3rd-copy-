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
import com.spotify.android.domain.usecase.LoginUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class LoginUiState(
    val loading: Boolean = false,
    val error: String? = null
)

sealed interface LoginIntent {
    data class Submit(val email: String, val password: String) : LoginIntent
}

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val loginUseCase: LoginUseCase
) : ViewModel() {
    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun onIntent(intent: LoginIntent) {
        when (intent) {
            is LoginIntent.Submit -> submit(intent.email, intent.password)
        }
    }

    private fun submit(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = LoginUiState(loading = true)
            loginUseCase(email, password).collect { result ->
                _uiState.value = LoginUiState(loading = false, error = result.exceptionOrNull()?.message)
            }
        }
    }
}

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    onGoToRegister: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel()
) {
    val state = viewModel.uiState.value
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    val emailValid = email.contains("@")
    val passwordValid = password.length >= 8

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Login", style = MaterialTheme.typography.headlineSmall)
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
                viewModel.onIntent(LoginIntent.Submit(email, password))
                onLoginSuccess()
            },
            enabled = emailValid && passwordValid && !state.loading
        ) { Text(if (state.loading) "Logging in..." else "Login") }
        Button(onClick = onGoToRegister) { Text("Create account") }
    }
}

