"use client";
export function PairingDisplay({ code }: { code?: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-mono">{code ?? "------"}</p>
    </div>
  );
}
