"use client";
export function SyncKeyEntry({ onKeySubmit, onSave }: { onKeySubmit?: (key: string) => void; onSave?: (key: string) => void }) {
  const handler = onKeySubmit ?? onSave;
  return (
    <div className="space-y-2">
      <input
        type="password"
        placeholder="Enter sync key"
        className="w-full rounded border px-3 py-2"
        onKeyDown={(e) => {
          if (e.key === "Enter") handler?.((e.target as HTMLInputElement).value);
        }}
      />
    </div>
  );
}
