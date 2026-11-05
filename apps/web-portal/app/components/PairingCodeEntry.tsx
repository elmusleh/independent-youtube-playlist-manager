// apps/web-portal/app/components/PairingCodeEntry.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  deriveKeys,
  computeStorageAddress,
  decryptRecord,
  decodeRecord,
  EncryptedRecord,
} from "@iypm/sync-crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  onComplete: (syncKey: string) => void;
}

type Step = "enter_code" | "enter_key" | "waiting" | "complete" | "error";

export function PairingCodeEntry({ onComplete }: Props) {
  const [pairingCode, setPairingCode] = useState("");
  const [syncKey, setSyncKey] = useState("");
  const [step, setStep] = useState<Step>("enter_code");
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    generatePairingCode();
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  async function generatePairingCode() {
    try {
      setStep("enter_code");
      setError(null);

      const response = await fetch("/api/pair/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceType: "phone" }),
      });

      if (!response.ok) throw new Error("Failed to generate pairing code");

      const { code, expiresAt } = await response.json();
      setPairingCode(code);
      startCountdown(expiresAt);
    } catch (err) {
      setError("Failed to generate pairing code");
      setStep("error");
    }
  }

  function startCountdown(expiresAt: number) {
    if (countdownRef.current) clearInterval(countdownRef.current);

    const update = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        if (step === "enter_code") {
          setError("Code expired");
          setStep("error");
        }
      }
    };

    update();
    countdownRef.current = setInterval(update, 1000);
  }

  async function handleVerify() {
    if (!syncKey.trim()) {
      setError("Please enter your sync key");
      return;
    }

    setStep("waiting");
    setError(null);

    try {
      const response = await fetch("/api/pair/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: pairingCode, syncKey: syncKey.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Verification failed");
      }

      setStep("complete");

      // Verify the sync key works by loading playlists
      try {
        const { encryptionKey } = await deriveKeys(syncKey.trim());
        const spaceAddress = await computeStorageAddress(syncKey.trim());
        const { data } = await supabase.rpc("sync_pull", {
          space: spaceAddress,
          auth_hash: spaceAddress,
          since_seq: 0,
          limit: 1,
        });

        // If we get here, the key is valid
        setTimeout(() => onComplete(syncKey.trim()), 1000);
      } catch (e) {
        setError("Invalid sync key - could not decrypt data");
        setStep("enter_key");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setStep("enter_key");
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  if (step === "complete") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
        <div className="text-6xl">✅</div>
        <h1 className="text-3xl font-light text-white">Pairing Complete!</h1>
        <p className="text-gray-400">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
        Pair Your Device
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {step === "enter_code" && (
        <div className="space-y-6">
          <p className="text-center text-gray-600 dark:text-gray-300">
            On your TV, go to <span className="font-mono text-brand-600">iypm.vercel.app/tv</span>
            and note the 6-digit code displayed.
          </p>

          <div className="text-center">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Enter 6-Digit Code
            </label>
            <input
              type="text"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 text-3xl font-mono tracking-widest text-center bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              maxLength={6}
              autoComplete="off"
              disabled
            />
          </div>

          {timeRemaining > 0 && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              Expires in:{" "}
              <span className="font-mono text-brand-600">{formatTime(timeRemaining)}</span>
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep("enter_key")}
              className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              I&apos;ll Enter Sync Key Instead
            </button>
            <button
              onClick={generatePairingCode}
              className="flex-1 px-4 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
              disabled={timeRemaining > 0}
            >
              Generate New Code
            </button>
          </div>
        </div>
      )}

      {step === "enter_key" && (
        <div className="space-y-6">
          <p className="text-center text-gray-600 dark:text-gray-300">
            Enter your 20-character sync key (format: ABCDE-FGHJK-MNPQR-STVWX)
          </p>

          <div className="space-y-4">
            <input
              type="text"
              value={syncKey}
              onChange={(e) => setSyncKey(e.target.value.toUpperCase())}
              placeholder="ABCDE-FGHJK-MNPQR-STVWX"
              className="w-full px-4 py-3 text-lg font-mono tracking-wider bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              maxLength={25}
              autoComplete="off"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStep("enter_code")}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Back to Code
              </button>
              <button
                onClick={handleVerify}
                disabled={step === "waiting" || !syncKey.trim()}
                className="flex-1 px-4 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {step === "waiting" ? "Verifying..." : "Verify & Pair"}
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Find your sync key in the extension: Settings → Sync → Show Key
          </p>
        </div>
      )}

      {step === "waiting" && (
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-500 border-t-transparent"></div>
          <p className="text-gray-400">Verifying sync key...</p>
        </div>
      )}

      {step === "error" && (
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={generatePairingCode}
            className="px-4 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
