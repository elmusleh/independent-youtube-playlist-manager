package com.elmusleh.iypm.qr

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.util.Log
import androidx.activity.result.contract.ActivityResultContracts
import com.elmusleh.iypm.repository.RepositoryProvider
import com.elmusleh.iypm.sync.PairingManager
import com.elmusleh.iypm.sync.PeriodicSyncScheduler
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "QRScanner")
class QRScannerPlugin : Plugin() {

    private var barcodeScanner: BarcodeScanner? = null
    private var pendingCall: PluginCall? = null
    private val pairingManager by lazy { PairingManager(context) }

    override fun load() {
        barcodeScanner = BarcodeScanning.getClient()
    }

    @PluginMethod
    fun scan(call: PluginCall) {
        pendingCall = call
        
        // Check camera permission
        if (context.checkSelfPermission(android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Camera permission required")
            return
        }
        
        // Start camera intent for barcode scanning
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        startActivityForResult(call, intent, 1001)
    }

    @PluginMethod
    fun scanFromGallery(call: PluginCall) {
        pendingCall = call
        
        val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
        intent.type = "image/*"
        startActivityForResult(call, intent, 1002)
    }

    @PluginMethod
    fun generateTvPairingCode(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val state = pairingManager.generatePairingCode()
                when (state) {
                    is PairingManager.PairingState.GeneratingCode -> {
                        val result = JSObject()
                            .put("success", true)
                            .put("code", state.code)
                            .put("expiresAt", state.expiresAt)
                        call.resolve(result)
                    }
                    is PairingManager.PairingState.Error -> {
                        call.reject(state.message)
                    }
                    else -> {
                        call.reject("Unexpected state")
                    }
                }
            } catch (e: Exception) {
                call.reject("Failed to generate pairing code", e)
            }
        }
    }

    @PluginMethod
    fun getPairingState(call: PluginCall) {
        val state = pairingManager.pairingState.value
        val result = JSObject().put("state", state.toString())
        call.resolve(result)
    }

    override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.handleOnActivityResult(requestCode, resultCode, data)
        
        if (resultCode == Activity.RESULT_OK && data != null) {
            when (requestCode) {
                1001 -> {
                    // Camera capture - process the image
                    data.extras?.get("data")?.let { bitmap ->
                        processBitmap(bitmap as android.graphics.Bitmap)
                    }
                }
                1002 -> {
                    // Gallery pick - process the selected image
                    data.data?.let { uri ->
                        processUri(uri)
                    }
                }
            }
        } else {
            pendingCall?.reject("Scan cancelled or failed")
            pendingCall = null
        }
    }

    private fun processBitmap(bitmap: android.graphics.Bitmap) {
        val image = InputImage.fromBitmap(bitmap, 0)
        scanBarcode(image)
    }

    private fun processUri(uri: Uri) {
        try {
            val image = InputImage.fromFilePath(context, uri)
            scanBarcode(image)
        } catch (e: Exception) {
            pendingCall?.reject("Failed to process image", e)
            pendingCall = null
        }
    }

    private fun scanBarcode(image: InputImage) {
        barcodeScanner?.process(image)
            .addOnSuccessListener { barcodes ->
                for (barcode in barcodes) {
                    barcode.rawValue?.let { value ->
                        CoroutineScope(Dispatchers.IO).launch {
                            val result = processPairingCode(value)
                            pendingCall?.resolve(JSObject().put("success", result))
                            pendingCall = null
                        }
                        return@addOnSuccessListener
                    }
                }
                pendingCall?.reject("No valid pairing code found")
                pendingCall = null
            }
            .addOnFailureListener { e ->
                pendingCall?.reject("Failed to scan barcode", e)
                pendingCall = null
            }
    }

    private suspend fun processPairingCode(code: String): Boolean {
        return kotlinx.coroutines.withContext(Dispatchers.IO) {
            try {
                // Parse the pairing code (could be QR data or 6-digit code)
                val repositoryProvider = RepositoryProvider(context)
                
                if (code.length == 6 && code.all { it.isDigit() || it.isLetter() }) {
                    // 6-digit pairing code - this is for PHONE to scan TV's code
                    // Phone should call verifyPhonePairingCode instead
                    Log.d("QRScanner", "Scanned 6-digit code on phone: $code - phone should use verifyPhonePairingCode")
                    return@withContext false
                } else if (code.startsWith("iypm://pair/")) {
                    // QR code with full pairing data
                    val syncKey = code.substringAfter("iypm://pair/")
                    return@withContext saveSyncKeyAndSync(syncKey)
                } else if (code.length == 20 || code.length == 25) { // 20 chars or 25 with dashes
                    // Direct sync key
                    return@withContext saveSyncKeyAndSync(code)
                }
                
                false
            }
        }
    }

    @PluginMethod
    fun verifyPhonePairingCode(call: PluginCall) {
        val code = call.getString("code") ?: return call.reject("Code is required")
        val syncKey = call.getString("syncKey") ?: return call.reject("Sync key is required")
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val success = pairingManager.verifyPhoneCode(code, syncKey)
                if (success) {
                    call.resolve(JSObject().put("success", true))
                } else {
                    call.reject("Failed to verify pairing code")
                }
            } catch (e: Exception) {
                call.reject("Failed to verify pairing code", e)
            }
        }
    }

    private suspend fun saveSyncKeyAndSync(syncKey: String): Boolean {
        return kotlinx.coroutines.withContext(Dispatchers.IO) {
            try {
                val repositoryProvider = RepositoryProvider(context)
                
                // Save sync key securely
                repositoryProvider.settings.setSyncKey(syncKey)
                
                // Trigger immediate sync
                PeriodicSyncScheduler.triggerImmediate(context)
                
                true
            } catch (e: Exception) {
                false
            }
        }
    }
}