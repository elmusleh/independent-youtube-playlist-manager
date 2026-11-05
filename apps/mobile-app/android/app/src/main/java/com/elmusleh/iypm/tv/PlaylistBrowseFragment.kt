package com.elmusleh.iypm.tv

import android.os.Bundle
import android.util.Log
import androidx.leanback.app.BrowseFragment
import androidx.leanback.widget.ArrayObjectAdapter
import androidx.leanback.widget.HeaderItem
import androidx.leanback.widget.ListRow
import androidx.leanback.widget.ListRowPresenter
import androidx.leanback.widget.Presenter
import androidx.leanback.widget.Row
import androidx.leanback.widget.RowPresenter
import com.elmusleh.iypm.repository.RepositoryProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class PlaylistBrowseFragment : BrowseFragment() {

    private val repositoryProvider by lazy { RepositoryProvider(requireContext()) }
    private val adapter = ArrayObjectAdapter(ListRowPresenter())
    private var currentPlaylistRow: ListRow? = null

    override fun onActivityCreated(savedInstanceState: Bundle?) {
        super.onActivityCreated(savedInstanceState)
        setupUI()
        loadPlaylists()
    }

    private fun setupUI() {
        setTitle("IYPM - My Playlists")
        setHeadersState(HEADERS_ENABLED)
        setHeadersTransitionOnBackEnabled(true)
        setBrandColor(resources.getColor(com.elmusleh.iypm.R.color.colorPrimary))
        setSearchAffordanceColor(resources.getColor(com.elmusleh.iypm.R.color.colorAccent))
        adapter.clear()
    }

    private fun loadPlaylists() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val playlists = repositoryProvider.playlists.getAllPlaylists().first()
                requireActivity().runOnUiThread {
                    updateAdapter(playlists)
                }
            } catch (e: Exception) {
                Log.e("PlaylistBrowseFragment", "Failed to load playlists", e)
            }
        }
    }

    private fun updateAdapter(playlists: List<com.elmusleh.iypm.db.PlaylistEntity>) {
        if (playlists.isEmpty()) {
            showEmptyState()
            return
        }

        val cardPresenter = PlaylistCardPresenter(requireContext())
        val rowAdapter = ArrayObjectAdapter(cardPresenter)
        
        playlists.forEach { playlist ->
            rowAdapter.add(playlist)
        }

        val header = HeaderItem(0, "My Playlists")
        val row = ListRow(header, rowAdapter)
        adapter.add(row)
        currentPlaylistRow = row
    }

    private fun showEmptyState() {
        // Could add a "No playlists synced yet" row
        val emptyRow = object : Row(HeaderItem(0, "No Playlists")) {
            override fun getAdapter(): ArrayObjectAdapter? = null
        }
        adapter.add(emptyRow)
    }

    override fun onDestroy() {
        super.onDestroy()
        // Cleanup if needed
    }
}

class PlaylistCardPresenter(context: android.content.Context) : Presenter() {

    private val ctx = context
    private val cardWidth = ctx.resources.getDimensionPixelSize(com.elmusleh.iypm.R.dimen.tb_card_width)
    private val cardHeight = ctx.resources.getDimensionPixelSize(com.elmusleh.iypm.R.dimen.tb_card_height)

    override fun onCreateViewHolder(parent: android.view.ViewGroup): ViewHolder {
        val view = android.view.LayoutInflater.from(ctx).inflate(
            com.elmusleh.iypm.R.layout.tv_playlist_card, parent, false
        )
        return ViewHolder(view)
    }

    override fun onBindViewHolder(viewHolder: ViewHolder, item: Any) {
        val playlist = item as com.elmusleh.iypm.db.PlaylistEntity
        val view = viewHolder.view
        
        view.findViewById<android.widget.TextView>(com.elmusleh.iypm.R.id.tv_playlist_title).text = playlist.title
        view.findViewById<android.widget.TextView>(com.elmusleh.iypm.R.id.tv_video_count).text = "${playlist.videoCount} videos"
        
        // Load thumbnail if available
        playlist.thumbnails?.let { thumbJson ->
            // TODO: Parse JSON and load image with Glide/Coil
        }
        
        view.setOnClickListener {
            playPlaylistOnYouTube(playlist.youtubeId)
        }
        
        // Focus handling for D-pad navigation
        view.setOnFocusChangeListener { _, hasFocus ->
            view.findViewById<android.view.View>(com.elmusleh.iypm.R.id.card_background)?.let { bg ->
                bg.isSelected = hasFocus
            }
        }
    }

    override fun onUnbindViewHolder(viewHolder: ViewHolder) {
        // Cleanup if needed
    }

    private fun playPlaylistOnYouTube(youtubeId: String?) {
        youtubeId?.let { id ->
            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("vnd.youtube://playlist?list=$id"))
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            try {
                ctx.startActivity(intent)
            } catch (e: Exception) {
                // Fallback to web URL
                val fallbackIntent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("https://youtube.com/playlist?list=$id"))
                fallbackIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                ctx.startActivity(fallbackIntent)
            }
        }
    }
}