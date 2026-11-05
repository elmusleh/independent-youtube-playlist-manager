package com.elmusleh.iypm

import android.os.Bundle
import androidx.leanback.app.BrowseFragment
import com.getcapacitor.BridgeActivity

class TvMainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Set the browse fragment as the main content
        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(android.R.id.content, com.elmusleh.iypm.tv.PlaylistBrowseFragment())
                .commit()
        }
    }
}