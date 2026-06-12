package com.spotify.android.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.core.Serializer
import androidx.datastore.core.updateData
import androidx.datastore.dataStore
import com.spotify.android.TokenPreferences
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.io.InputStream
import java.io.OutputStream

object TokenPreferencesSerializer : Serializer<TokenPreferences> {
    override val defaultValue: TokenPreferences = TokenPreferences.getDefaultInstance()

    override suspend fun readFrom(input: InputStream): TokenPreferences =
        TokenPreferences.parseFrom(input)

    override suspend fun writeTo(t: TokenPreferences, output: OutputStream) {
        t.writeTo(output)
    }
}

private val Context.tokenDataStore: DataStore<TokenPreferences> by dataStore(
    fileName = "token_preferences.pb",
    serializer = TokenPreferencesSerializer
)

class TokenDataStore(private val context: Context) {
    fun tokenFlow(): Flow<TokenPreferences> = context.tokenDataStore.data

    suspend fun saveTokens(
        accessToken: String,
        refreshToken: String,
        userId: String,
        userRole: String
    ) {
        context.tokenDataStore.updateData { current ->
            current.toBuilder()
                .setAccessToken(accessToken)
                .setRefreshToken(refreshToken)
                .setUserId(userId)
                .setUserRole(userRole)
                .build()
        }
    }

    fun getAccessToken(): Flow<String> = tokenFlow().map { it.accessToken }

    fun getRefreshToken(): Flow<String> = tokenFlow().map { it.refreshToken }

    suspend fun clearTokens() {
        context.tokenDataStore.updateData {
            TokenPreferences.getDefaultInstance()
        }
    }
}

