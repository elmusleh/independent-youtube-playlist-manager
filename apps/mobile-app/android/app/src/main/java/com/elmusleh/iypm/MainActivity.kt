package com.elmusleh.iypm

import android.os.Bundle
import com.elmusleh.iypm.secure.SecureStoragePlugin
import com.elmusleh.iypm.qr.QRScannerPlugin
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(SecureStoragePlugin::class.java)
        registerPlugin(QRScannerPlugin::class.java)
    }
}