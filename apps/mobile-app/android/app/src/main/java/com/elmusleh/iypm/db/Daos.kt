package com.elmusleh.iypm.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import androidx.room.Delete
import kotlinx.coroutines.flow.Flow

@Dao
interface PlaylistDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(playlists: List<PlaylistEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(playlist: PlaylistEntity)

    @Update
    suspend fun update(playlist: PlaylistEntity)

    @Delete
    suspend fun delete(playlist: PlaylistEntity)

    @Query("DELETE FROM playlists WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("SELECT * FROM playlists ORDER BY updatedAt DESC")
    fun getAll(): Flow<List<PlaylistEntity>>

    @Query("SELECT * FROM playlists WHERE id = :id")
    suspend fun getById(id: String): PlaylistEntity?

    @Query("SELECT * FROM playlists WHERE syncStatus != 0")
    suspend fun getPendingSync(): List<PlaylistEntity>

    @Query("SELECT COUNT(*) FROM playlists WHERE syncStatus = 1")
    suspend fun getPendingCount(): Int

    @Query("DELETE FROM playlists WHERE localOnly = 1 AND syncStatus = 0")
    suspend fun cleanupLocalOnlySynced()
}

@Dao
interface PlaylistVideoDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(videos: List<PlaylistVideoEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(video: PlaylistVideoEntity)

    @Query("SELECT * FROM playlist_videos WHERE playlistId = :playlistId ORDER BY position ASC")
    fun getByPlaylistId(playlistId: String): Flow<List<PlaylistVideoEntity>>

    @Query("SELECT * FROM playlist_videos WHERE playlistId = :playlistId ORDER BY position ASC")
    suspend fun getByPlaylistIdSync(playlistId: String): List<PlaylistVideoEntity>

    @Query("DELETE FROM playlist_videos WHERE playlistId = :playlistId")
    suspend fun deleteByPlaylistId(playlistId: String)

    @Query("DELETE FROM playlist_videos WHERE playlistId = :playlistId AND videoId = :videoId")
    suspend fun deleteVideo(playlistId: String, videoId: String)
}

@Dao
interface SyncStatusDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(status: SyncStatusEntity)

    @Query("SELECT * FROM sync_status WHERE key = :key")
    suspend fun get(key: String): SyncStatusEntity?

    @Query("SELECT value FROM sync_status WHERE key = :key")
    suspend fun getValue(key: String): String?

    @Query("DELETE FROM sync_status WHERE key = :key")
    suspend fun delete(key: String)
}

@Dao
interface SettingDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(setting: SettingEntity)

    @Query("SELECT * FROM settings WHERE key = :key")
    suspend fun get(key: String): SettingEntity?

    @Query("SELECT value FROM settings WHERE key = :key")
    suspend fun getValue(key: String): String?

    @Query("DELETE FROM settings WHERE key = :key")
    suspend fun delete(key: String)
}