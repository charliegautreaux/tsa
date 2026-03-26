"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const LANE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "precheck", label: "TSA Pre✓" },
  { value: "clear", label: "CLEAR" },
];

const WAIT_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90];

export default function ReportPage() {
  const [airportCode, setAirportCode] = useState("");
  const [checkpoint, setCheckpoint] = useState("");
  const [laneType, setLaneType] = useState("standard");
  const [waitMinutes, setWaitMinutes] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    airportCode.length === 3 &&
    checkpoint.trim().length > 0 &&
    waitMinutes != null &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          airport_code: airportCode.toUpperCase(),
          checkpoint,
          lane_type: laneType,
          wait_minutes: waitMinutes,
          note: note || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? `Server error (${res.status})`);
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <h1 className="mt-4 text-2xl font-bold">Thanks for reporting!</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Your report helps fellow travelers.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Map
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">Report Wait Time</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Share what you see at the checkpoint right now.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium">Airport Code</label>
          <input
            type="text"
            maxLength={3}
            placeholder="ATL"
            value={airportCode}
            onChange={(e) => setAirportCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-lg font-mono uppercase tracking-widest dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Checkpoint Name</label>
          <input
            type="text"
            placeholder="Main, North, Terminal B..."
            value={checkpoint}
            onChange={(e) => setCheckpoint(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Lane Type</label>
          <div className="mt-1 flex gap-2">
            {LANE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLaneType(opt.value)}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  laneType === opt.value
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Wait Time</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {WAIT_PRESETS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setWaitMinutes(mins)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm tabular-nums transition-colors",
                  waitMinutes === mins
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                )}
              >
                {mins}m
              </button>
            ))}
          </div>
          <input
            type="number"
            min={0}
            max={300}
            placeholder="Or type exact minutes..."
            value={waitMinutes ?? ""}
            onChange={(e) => setWaitMinutes(e.target.value ? Number(e.target.value) : null)}
            className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Note (optional)</label>
          <textarea
            maxLength={500}
            rows={2}
            placeholder="Any details about the line..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium text-white transition-colors",
            canSubmit
              ? "bg-blue-600 hover:bg-blue-700"
              : "cursor-not-allowed bg-gray-300 dark:bg-gray-700"
          )}
        >
          <Send className="h-4 w-4" />
          Submit Report
        </button>
      </form>
    </main>
  );
}
