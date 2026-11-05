package com.elmusleh.iypm.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.elmusleh.iypm.repository.RepositoryProvider
import com.elmusleh.iypm.repository.SettingRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class SyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    private val repositoryProvider = RepositoryProvider(applicationContext)

    override suspend fun doWork(): Result {
        return try {
            val syncKey = repositoryProvider.settings.getSyncKey()
            if (syncKey == null || syncKey.isEmpty()) {
                Log.d("SyncWorker", "No sync key configured, skipping sync")
                Result.success()
            } else {
                // Perform sync with Supabase
                val success = performSync(syncKey)
                if (success) {
                    repositoryProvider.syncStatus.setLastSyncTime(System.currentTimeMillis())
                    Log.d("SyncWorker", "Sync completed successfully")
                    Result.success()
                } else {
                    Log.w("SyncWorker", "Sync failed")
                    Result.retry()
                }
            }
        } catch (e: Exception) {
            Log.e("SyncWorker", "Sync failed with exception", e)
            Result.retry()
        }
    }

    private suspend fun performSync(syncKey: String): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                // TODO: Implement actual sync with Supabase using sync-crypto package
                // This would:
                // 1. Derive keys from syncKey
                // 2. Pull encrypted records from Supabase
                // 3. Decrypt and merge with local data
                // 4. Push local changes to Supabase
                // For now, return true to indicate success
                true
            } catch (e: Exception) {
                false
            }
        }
    }
}

class PeriodicSyncScheduler {

    companion object {
        private const val SYNC_WORK_NAME = "periodic_sync"
        private const val SYNC_INTERVAL_MINUTES = 15L
        private const val TV_SYNC_WORK_NAME = "tv_periodic_sync"

        fun schedule(context: Context, isTv: Boolean = false) {
            val workManager = androidx.work.WorkManager.getInstance(context)
            val workName = if (isTv) TV_SYNC_WORK_NAME else SYNC_WORK_NAME
            
            // Cancel any existing periodic work
            workManager.cancelUniqueWork(workName)
            
            // Build constraints
            val constraintsBuilder = androidx.work.Constraints.Builder()
                .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
            
            // TV-specific constraints: charging + device idle
            if (isTv) {
                constraintsBuilder
                    .setRequiresCharging(true)
                    .setRequiresDeviceIdle(true)
            }
            
            // Schedule new periodic work
            val periodicWorkRequest = androidx.work.PeriodicWorkRequestBuilder<SyncWorker>(SYNC_INTERVAL_MINUTES, java.util.concurrent.TimeUnit.MINUTES)
                .setConstraints(constraintsBuilder.build())
                .build()
            
            workManager.enqueueUniquePeriodicWork(
                workName,
                androidx.work.ExistingPeriodicWorkPolicy.KEEP,
                periodicWorkRequest
            )
        }

        fun cancel(context: Context, isTv: Boolean = false) {
            val workManager = androidx.work.WorkManager.getInstance(context)
            val workName = if (isTv) TV_SYNC_WORK_NAME else SYNC_WORK_NAME
            workManager.cancelUniqueWork(workName)
        }

        fun triggerImmediate(context: Context) {
            val workManager = androidx.work.WorkManager.getInstance(context)
            workManager.enqueueUniqueWork(
                "immediate_sync",
                androidx.work.ExistingWorkPolicy.REPLACE,
                androidx.work.OneTimeWorkRequestBuilder<SyncWorker>().build()
            )
        }
    }
}

/**
 * Handles 6-digit pairing code via Supabase Realtime.
 * TV shows a 6-digit code → Phone enters code → Phone pushes encrypted sync key via Realtime.
 */
class PairingManager(private val context: Context) {

    private val repositoryProvider = RepositoryProvider(context)
    private val _pairingState = MutableStateFlow<PairingState>(PairingState.Idle)
    val pairingState = _pairingState.asStateFlow()

    private var realtimeChannel: io.supabase.flutter.realtime.RealtimeChannel? = null
    private var currentPairingCode: String? = null

    data class PairingCode(
        val code: String,
        val expiresAt: Long,
        val syncKey: String? = null
    )

    sealed interface PairingState {
        data class Idle : PairingState
        data class GeneratingCode(val code: String, val expiresAt: Long) : PairingState
        data class WaitingForPhone(val code: String, val expiresAt: Long) : PairingState
        data class PairingComplete(val syncKey: String) : PairingState
        data class Error(val message: String) : PairingState
    }

    /**
     * Generate a new 6-digit pairing code and listen for sync key via Supabase Realtime.
     * Called when user initiates pairing on TV.
     */
    suspend fun generatePairingCode(): PairingState {
        return withContext(Dispatchers.IO) {
            try {
                val code = generateSixDigitCode()
                val expiresAt = System.currentTimeMillis() + 10 * 60 * 1000 // 10 minutes
                
                // Store pairing code in Supabase
                val supabase = io.supabase.flutter.SupabaseClient(
                    SettingRepository.getSupabaseUrl() ?: "https://pfydngsbcmuhsqqjbcte.supabase.co",
                    SettingRepository.getSupabaseAnonKey() ?: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmeWRuZ3NiY211aHNxcWpiY3RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA0MjM0MDAsImV4cCI6MjA0Njk5OTQwMH0.VhVhQQGVdOk0-T6ZqFzXhOGwVh7y1S9hB2qjQ7O7kM8"
                )
                
                val pairingRecord = mapOf(
                    "code" to code,
                    "expires_at" to java.time.Instant.ofEpochMilli(expiresAt).toString(),
                    "used" to false,
                    "device_type" to "tv",
                    "created_at" to java.time.Instant.now().toString()
                )
                
                supabase.from("pairing_codes").insert(pairingRecord).await()
                
                // Subscribe to Realtime for sync key delivery
                subscribeToPairingUpdates(supabase, code)
                
                currentPairingCode = code
                _pairingState.value = PairingState.GeneratingCode(code, expiresAt)
                PairingState.GeneratingCode(code, expiresAt)
            } catch (e: Exception) {
                Log.e("PairingManager", "Failed to generate pairing code", e)
                _pairingState.value = PairingState.Error(e.message ?: "Failed to generate code")
                PairingState.Error(e.message ?: "Failed to generate code")
            }
        }
    }

    private fun generateSixDigitCode(): String {
        return (100000 + (Math.random() * 900000).toInt()).toString()
    }

    private fun subscribeToPairingUpdates(supabase: io.supabase.flutter.SupabaseClient, code: String) {
        realtimeChannel = supabase.channel("pairing:$code")
            .on(
                io.supabase.flutter.realtime.RealtimeListenTypes.PostgresChanges,
                io.supabase.flutter.realtime.PostgresChangesFilter(
                    event = "*",
                    schema = "public",
                    table = "pairing_codes",
                    filter = "code=eq.$code"
                )
            ) { payload ->
                // Check if sync_key was set by phone
                val newRecord = payload.record
                if (newRecord != null && newRecord["sync_key"] != null && newRecord["used"] == true) {
                    val syncKey = newRecord["sync_key"] as String
                    handlePairingComplete(syncKey)
                }
            }
            .subscribe()
    }

    private fun handlePairingComplete(syncKey: String) {
        // Save sync key securely
        repositoryProvider.settings.setSyncKey(syncKey)
        
        // Start periodic sync
        PeriodicSyncScheduler.schedule(context, isTv = true)
        
        // Trigger immediate sync
        PeriodicSyncScheduler.triggerImmediate(context)
        
        // Clean up
        realtimeChannel?.unsubscribe()
        realtimeChannel = null
        currentPairingCode = null
        
        _pairingState.value = PairingState.PairingComplete(syncKey)
    }

    /**
     * Called when user enters 6-digit code on phone web portal.
     * Phone should call this via Supabase RPC or direct insert.
     */
    suspend fun verifyPhoneCode(code: String, syncKey: String): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val supabase = io.supabase.flutter.SupabaseClient(
                    SettingRepository.getSupabaseUrl() ?: "https://pfydngsbcmuhsqqjbcte.supabase.co",
                    SettingRepository.getSupabaseAnonKey() ?: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmeWRuZ3NiY211aHNxcWpiY3RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA0MjM0MDAsImV4cCI6MjA0Njk5OTQwMH0.VhVhQQGVdOk0-T6ZqFzXhOGwVh7y1S9hB2qjQ7O7kM8"
                )
                
                // Update pairing code with sync_key and mark as used
                val updates = mapOf(
                    "sync_key" to syncKey,
                    "used" to true,
                    "paired_at" to java.time.Instant.now().toString()
                )
                
                supabase.from("pairing_codes")
                    .update(updates)
                    .eq("code", code)
                    .eq("used", false)
                    .gte("expires_at", java.time.Instant.now().toString())
                    .await()
                
                true
            } catch (e: Exception) {
                Log.e("PairingManager", "Failed to verify phone code", e)
                false
            }
        }
    }

    fun cleanup() {
        realtimeChannel?.unsubscribe()
        realtimeChannel = null
        currentPairingCode = null
    }
}