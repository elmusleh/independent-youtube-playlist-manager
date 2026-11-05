package com.elmusleh.iypm.repository

import android.content.Context
import com.elmusleh.iypm.db.AppDatabase
import com.elmusleh.iypm.db.PlaylistEntity
import com.elmusleh.iypm.db.PlaylistVideoEntity
import com.elmusleh.iypm.db.SyncStatusEntity
import com.elmusleh.iypm.db.SettingEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.tasks.await

class PlaylistRepository(private val db: AppDatabase) {

    suspend fun savePlaylists(playlists: List<PlaylistEntity>) {
        db.playlistDao().insertAll(playlists)
    }

    suspend fun savePlaylist(playlist: PlaylistEntity) {
        db.playlistDao().insert(playlist)
    }

    suspend fun deletePlaylist(id: String) {
        db.playlistDao().deleteById(id)
        db.playlistVideoDao().deleteByPlaylistId(id)
    }

    fun getAllPlaylists(): Flow<List<PlaylistEntity>> {
        return db.playlistDao().getAll()
    }

    suspend fun getPlaylist(id: String): PlaylistEntity? {
        return db.playlistDao().getById(id)
    }

    suspend fun getPendingSyncPlaylists() = db.playlistDao().getPendingSync()

    suspend fun getPendingCount() = db.playlistDao().getPendingCount()

    suspend fun savePlaylistVideos(playlistId: String, videos: List<PlaylistVideoEntity>) {
        db.playlistVideoDao().deleteByPlaylistId(playlistId)
        db.playlistVideoDao().insertAll(videos)
    }

    fun getPlaylistVideos(playlistId: String): Flow<List<PlaylistVideoEntity>> {
        return db.playlistVideoDao().getByPlaylistId(playlistId)
    }

    suspend fun getPlaylistVideosSync(playlistId: String) = db.playlistVideoDao().getByPlaylistIdSync(playlistId)

    suspend fun cleanupLocalOnlySynced() {
        db.playlistDao().cleanupLocalOnlySynced()
    }
}

class SyncStatusRepository(private val db: AppDatabase) {

    suspend fun setLastSyncTime(timestamp: Long) {
        db.syncStatusDao().upsert(SyncStatusEntity("last_sync", timestamp.toString(), System.currentTimeMillis()))
    }

    suspend fun getLastSyncTime(): Long? {
        return db.syncStatusDao().getValue("last_sync")?.toLongOrNull()
    }

    suspend fun setPendingCount(count: Int) {
        db.syncStatusDao().upsert(SyncStatusEntity("pending_count", count.toString(), System.currentTimeMillis()))
    }

    suspend fun getPendingCount(): Int {
        return db.syncStatusDao().getValue("pending_count")?.toIntOrNull() ?: 0
    }

    suspend fun setLastError(error: String) {
        db.syncStatusDao().upsert(SyncStatusEntity("last_error", error, System.currentTimeMillis()))
    }

    suspend fun getLastError(): String? {
        return db.syncStatusDao().getValue("last_error")
    }
}

class SettingRepository(private val db: AppDatabase) {

    suspend fun setSyncKey(key: String) {
        db.settingDao().upsert(SettingEntity("sync_key", key))
    }

    suspend fun getSyncKey(): String? {
        return db.settingDao().getValue("sync_key")
    }

    suspend fun setSetting(key: String, value: String) {
        db.settingDao().upsert(SettingEntity(key, value))
    }

    suspend fun getSetting(key: String): String? {
        return db.settingDao().getValue(key)
    }

    suspend fun removeSetting(key: String) {
        db.settingDao().delete(key)
    }
}

class RepositoryProvider(private val context: Context) {
    private val database by lazy { AppDatabase.getInstance(context) }
    val playlists = PlaylistRepository(database)
    val syncStatus = SyncStatusRepository(database)
    val settings = SettingRepository(database)
}