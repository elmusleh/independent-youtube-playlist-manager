package com.elmusleh.iypm.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey
    val id: String,
    val title: String,
    val youtubeId: String?,
    val videoCount: Int,
    val thumbnails: String?, // JSON string of thumbnail URLs
    val updatedAt: Long,
    val syncStatus: Int, // 0 = synced, 1 = pending, 2 = error
    val localOnly: Boolean
)

@Entity(tableName = "playlist_videos")
data class PlaylistVideoEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Int = 0,
    val playlistId: String,
    val videoId: String,
    val title: String,
    val channelTitle: String,
    val duration: String?,
    val thumbnailUrl: String?,
    val position: Int,
    val addedAt: Long
)

@Entity(tableName = "sync_status")
data class SyncStatusEntity(
    @PrimaryKey
    val key: String, // "last_sync", "pending_count", etc.
    val value: String,
    val updatedAt: Long
)

@Entity(tableName = "settings")
data class SettingEntity(
    @PrimaryKey
    val key: String,
    val value: String
)