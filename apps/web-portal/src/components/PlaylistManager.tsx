"use client";
export function PlaylistManager({ playlists, onCreate, onDelete }: any) {
  return (
    <div className="space-y-4">
      <button onClick={onCreate} className="rounded bg-primary px-4 py-2 text-primary-foreground">
        Create Playlist
      </button>
      <ul className="space-y-2">
        {playlists?.map((p: any) => (
          <li key={p.id} className="flex items-center justify-between rounded border p-3">
            <span>{p.title}</span>
            <button onClick={() => onDelete?.(p.id)} className="text-destructive">
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
