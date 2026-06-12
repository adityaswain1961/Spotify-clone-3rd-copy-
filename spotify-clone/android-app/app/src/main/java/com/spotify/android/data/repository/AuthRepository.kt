package com.spotify.android.data.repository

import com.spotify.android.data.local.TokenDataStore
import com.spotify.android.data.remote.AuthApi
import com.spotify.android.data.remote.LoginRequest
import com.spotify.android.data.remote.RegisterRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class AuthRepository(
    private val authApi: AuthApi,
    private val tokenDataStore: TokenDataStore
) {
    fun login(email: String, password: String): Flow<Result<Unit>> = flow {
        emit(
            runCatching {
                val tokens = authApi.login(LoginRequest(email, password))
                tokenDataStore.saveTokens(tokens.accessToken, tokens.refreshToken, "", "")
            }
        )
    }

    fun register(email: String, password: String, displayName: String): Flow<Result<Unit>> = flow {
        emit(
            runCatching {
                val tokens = authApi.register(RegisterRequest(email, password, displayName))
                tokenDataStore.saveTokens(tokens.accessToken, tokens.refreshToken, "", "")
            }
        )
    }
}

