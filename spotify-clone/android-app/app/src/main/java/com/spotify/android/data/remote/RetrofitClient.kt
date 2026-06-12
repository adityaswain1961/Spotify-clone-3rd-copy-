package com.spotify.android.data.remote

import com.spotify.android.data.local.TokenDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class AuthInterceptor(
    private val tokenDataStore: TokenDataStore
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val accessToken = runBlocking { tokenDataStore.getAccessToken().first() }
        val request = if (accessToken.isNotBlank()) {
            chain.request().newBuilder()
                .header("Authorization", "Bearer $accessToken")
                .build()
        } else {
            chain.request()
        }
        return chain.proceed(request)
    }
}

class TokenAuthenticator(
    private val tokenDataStore: TokenDataStore,
    private val authApiProvider: () -> AuthApi
) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) >= 2) return null
        val refreshToken = runBlocking { tokenDataStore.getRefreshToken().first() }
        if (refreshToken.isBlank()) return null

        return try {
            val newTokens = runBlocking { authApiProvider().refresh(RefreshRequest(refreshToken)) }
            runBlocking {
                tokenDataStore.saveTokens(
                    accessToken = newTokens.accessToken,
                    refreshToken = newTokens.refreshToken,
                    userId = "",
                    userRole = ""
                )
            }
            response.request.newBuilder()
                .header("Authorization", "Bearer ${newTokens.accessToken}")
                .build()
        } catch (_: Exception) {
            null
        }
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}

object RetrofitClient {
    private const val BASE_URL = "http://10.0.2.2:3000"

    fun create(tokenDataStore: TokenDataStore, isDebug: Boolean): Retrofit {
        val logging = HttpLoggingInterceptor().apply {
            level = if (isDebug) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
        }

        lateinit var authApi: AuthApi
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenDataStore))
            .addInterceptor(logging)
            .authenticator(TokenAuthenticator(tokenDataStore) { authApi })
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create())
            .build()

        authApi = retrofit.create(AuthApi::class.java)
        return retrofit
    }
}

