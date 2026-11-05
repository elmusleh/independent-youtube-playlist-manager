package com.elmusleh.iypm.db

import androidx.room.TypeConverter
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class Converters {
    private val gson = Gson()
    private val stringListType = TypeToken.getParameterized(List::class.java, String::class.java).type

    @TypeConverter
    fun fromStringList(value: String?): List<String>? {
        return value?.let { gson.fromJson(it, stringListType) }
    }

    @TypeConverter
    fun toStringList(value: List<String>?): String? {
        return value?.let { gson.toJson(it) }
    }

    @TypeConverter
    fun fromLong(value: Long?): java.util.Date? {
        return value?.let { java.util.Date(it) }
    }

    @TypeConverter
    fun toLong(value: java.util.Date?): Long? {
        return value?.time
    }
}