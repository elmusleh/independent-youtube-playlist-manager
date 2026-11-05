package com.elmusleh.iypm.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.elmusleh.iypm.repository.RepositoryProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

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

        fun schedule(context: Context) {
            val workManager = androidx.work.WorkManager.getInstance(context)
            
            // Cancel any existing periodic work
            workManager.cancelUniqueWork(SYNC_WORK_NAME)
            
            // Schedule new periodic work
            val periodicWorkRequest = androidx.work.PeriodicWorkRequestBuilder<SyncWorker>(SYNC_INTERVAL_MINUTES, java.util.concurrent.TimeUnit.MINUTES)
                .setConstraints(
                    androidx.work.Constraints.Builder()
                        .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                        .build()
                )
                .build()
            
            workManager.enqueueUniquePeriodicWork(
                SYNC_WORK_NAME,
                androidx.work.ExistingPeriodicWorkPolicy.KEEP,
                periodicWorkRequest
            )
        }

        fun cancel(context: Context) {
            val workManager = androidx.work.WorkManager.getInstance(context)
            workManager.cancelUniqueWork(SYNC_WORK_NAME)
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