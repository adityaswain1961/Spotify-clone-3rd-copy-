package com.spotify.android.data.remote

import retrofit2.http.Body
import retrofit2.http.POST

interface AuthApi {
    @POST("/auth/login")
    suspend fun login(@Body request: LoginRequest): AuthTokensDto

    @POST("/auth/register")
    suspend fun register(@Body request: RegisterRequest): AuthTokensDto

    @POST("/auth/refresh")
    suspend fun refresh(@Body request: RefreshRequest): AuthTokensDto
}

