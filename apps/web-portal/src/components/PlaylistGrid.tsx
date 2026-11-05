"use client";
export function PlaylistGrid({
  playlists,
  onPlay,
}: {
  playlists: any[];
  onPlay?: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {playlists?.map((p: any) => (
        <div key={p.id} className="rounded-lg border p-4">
          <h3 className="font-semibold">{p.title}</h3>
          <p className="text-sm text-muted-foreground">{p.videos?.length ?? 0} videos</p>
          {onPlay && (
            <button onClick={() => onPlay(p.id)} className="mt-2 text-sm text-primary">
              Play
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
