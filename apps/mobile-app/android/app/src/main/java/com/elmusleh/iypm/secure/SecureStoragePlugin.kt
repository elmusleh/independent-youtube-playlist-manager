package com.elmusleh.iypm.secure

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.security.GeneralSecurityException

@CapacitorPlugin(name = "SecureStorage")
class SecureStoragePlugin : Plugin() {

    private lateinit var encryptedPrefs: SharedPreferences

    override fun load() {
        try {
            val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
            encryptedPrefs = EncryptedSharedPreferences.create(
                "iypm_secure_prefs",
                masterKeyAlias,
                context,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: GeneralSecurityException) {
            e.printStackTrace()
            // Fallback to regular SharedPreferences if encryption fails
            encryptedPrefs = context.getSharedPreferences("iypm_fallback_prefs", Context.MODE_PRIVATE)
        } catch (e: Exception) {
            e.printStackTrace()
            encryptedPrefs = context.getSharedPreferences("iypm_fallback_prefs", Context.MODE_PRIVATE)
        }
    }

    @PluginMethod
    fun set(call: PluginCall) {
        val key = call.getString("key") ?: return call.reject("Key is required")
        val value = call.getString("value") ?: return call.reject("Value is required")

        try {
            encryptedPrefs.edit().putString(key, value).apply()
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to save value", e)
        }
    }

    @PluginMethod
    fun get(call: PluginCall) {
        val key = call.getString("key") ?: return call.reject("Key is required")

        try {
            val value = encryptedPrefs.getString(key, null)
            val result = JSObject()
            result.put("value", value)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to get value", e)
        }
    }

    @PluginMethod
    fun remove(call: PluginCall) {
        val key = call.getString("key") ?: return call.reject("Key is required")

        try {
            encryptedPrefs.edit().remove(key).apply()
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to remove value", e)
        }
    }

    @PluginMethod
    fun clear(call: PluginCall) {
        try {
            encryptedPrefs.edit().clear().apply()
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to clear storage", e)
        }
    }

    @PluginMethod
    fun contains(call: PluginCall) {
        val key = call.getString("key") ?: return call.reject("Key is required")

        try {
            val exists = encryptedPrefs.contains(key)
            val result = JSObject()
            result.put("exists", exists)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to check key", e)
        }
    }
}