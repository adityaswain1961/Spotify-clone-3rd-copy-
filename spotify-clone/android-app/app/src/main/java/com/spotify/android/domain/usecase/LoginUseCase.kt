package com.spotify.android.domain.usecase

import com.spotify.android.data.repository.AuthRepository

class LoginUseCase(private val authRepository: AuthRepository) {
    operator fun invoke(email: String, password: String) = authRepository.login(email, password)
}

