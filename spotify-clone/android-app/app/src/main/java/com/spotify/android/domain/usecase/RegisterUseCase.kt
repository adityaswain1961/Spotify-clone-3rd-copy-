package com.spotify.android.domain.usecase

import com.spotify.android.data.repository.AuthRepository

class RegisterUseCase(private val authRepository: AuthRepository) {
    operator fun invoke(email: String, password: String, displayName: String) =
        authRepository.register(email, password, displayName)
}

