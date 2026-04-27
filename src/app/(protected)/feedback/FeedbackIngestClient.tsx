"use client";

import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import {
  TRAINING_FEEDBACK_CATEGORIES,
  TRAINING_FEEDBACK_CROP_EXAMPLES
} from "@/lib/constants/training-feedback-ui";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function FeedbackIngestClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [plantName, setPlantName] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [comment, setComment] = useState("");
  const [modelPrediction, setModelPrediction] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const clearFile = useCallback(() => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (inputRef.current) inputRef.current.value = "";
  }, [previewUrl]);

  const pickFile = useCallback((f: File | null) => {
    setMessage(null);
    if (!f) {
      clearFile();
      return;
    }
    if (!ACCEPT.split(",").includes(f.type)) {
      setMessage({
        type: "err",
        text: "Use JPG, PNG, or WebP only."
      });
      return;
    }
    if (f.size > MAX_BYTES) {
      setMessage({
        type: "err",
        text: `File too large (max ${formatBytes(MAX_BYTES)}).`
      });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }, [clearFile, previewUrl]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) pickFile(f);
    },
    [pickFile]
  );

  async function submit() {
    setMessage(null);
    if (!file) {
      setMessage({ type: "err", text: "Choose an image to upload." });
      return;
    }
    const crop = plantName.trim();
    const cat = category.trim();
    const tagParts = tags
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const com = comment.trim();
    const hasTrainingSignal =
      (crop.length > 0 && cat.length > 0) ||
      cat.length > 0 ||
      tagParts.length > 0 ||
      com.length >= 3;
    if (!hasTrainingSignal) {
      setMessage({
        type: "err",
        text: "Add crop + category, select a condition, add tags, or enter a comment (3+ characters)."
      });
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      if (crop) fd.append("feedbackCrop", crop);
      if (cat) fd.append("feedbackCategory", cat);
      if (tagParts.length) fd.append("tags", JSON.stringify(tagParts));
      if (com) fd.append("comment", com);
      const mp = modelPrediction.trim();
      if (mp) fd.append("modelPrediction", mp);

      const res = await fetch("/api/feedback/ingest", {
        method: "POST",
        body: fd,
        credentials: "include"
      });
      const json = (await res.json()) as {
        data?: { id: string };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? `Upload failed (${res.status})`);
      }
      setMessage({
        type: "ok",
        text: `Thanks — feedback saved${json.data?.id ? ` (${json.data.id})` : ""}.`
      });
      clearFile();
      setPlantName("");
      setCategory("");
      setTags("");
      setComment("");
      setModelPrediction("");
    } catch (e) {
      setMessage({
        type: "err",
        text: e instanceof Error ? e.message : "Something went wrong."
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Image & feedback
        </h1>
        <p className="mt-1 text-sm text-ink/50">
          Upload a crop photo and tell us the correct label, tags, or notes so we can improve models.
        </p>
      </div>

      {message && (
        <div
          role="status"
          className={
            message.type === "ok"
              ? "rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100"
              : "rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100"
          }
        >
          {message.text}
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed transition-colors ${
            dragOver ? "border-leaf/50 bg-lime/10" : "border-ink/10 bg-white/50"
          }`}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center gap-3 px-6 py-12 text-center"
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Selected upload preview"
                className="max-h-48 max-w-full rounded-2xl object-contain ring-1 ring-ink/10"
              />
            ) : (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-leaf to-moss text-white shadow-fab">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                </span>
                <p className="text-sm font-semibold text-ink/70">
                  Drag & drop an image, or tap to browse
                </p>
                <p className="text-xs text-ink/35">
                  JPEG, PNG, WebP · max {formatBytes(MAX_BYTES)}
                </p>
              </>
            )}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={busy}
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        {file && (
          <div className="flex items-center justify-between border-t border-ink/5 px-4 py-3">
            <p className="truncate text-xs text-ink/50">
              {file.name} · {formatBytes(file.size)}
            </p>
            <button
              type="button"
              onClick={() => clearFile()}
              className="text-xs font-semibold text-rose-600 hover:underline"
            >
              Remove
            </button>
          </div>
        )}
      </Card>

      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Card className="space-y-4 p-5">
        <div className="block text-sm">
          <label
            htmlFor="feedback-crop"
            className="text-xs font-semibold uppercase tracking-wider text-ink/40"
          >
            Name (crop or plant)
          </label>
          <p className="mt-0.5 text-[11px] text-ink/35">
            Together with the condition below, training images are stored as
            Name___Condition (e.g. Tomato___Early_blight) when a dataset
            directory is configured.
          </p>
          <input
            id="feedback-crop"
            name="feedbackCrop"
            value={plantName}
            onChange={(e) => setPlantName(e.target.value)}
            disabled={busy}
            list="feedback-crop-suggestions"
            maxLength={120}
            autoComplete="off"
            placeholder="e.g. Tomato"
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
          />
          <datalist id="feedback-crop-suggestions">
            {TRAINING_FEEDBACK_CROP_EXAMPLES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <label className="block text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">
            Condition (optional if tags or comment are provided)
          </span>
          <select
            name="feedbackCategory"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={busy}
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
          >
            {TRAINING_FEEDBACK_CATEGORIES.map((c) => (
              <option key={c || "empty"} value={c}>
                {c || "— Select —"}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">
            Tags
          </span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            disabled={busy}
            placeholder="e.g. tomato, greenhouse, week-4"
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
          />
          <span className="mt-1 block text-[11px] text-ink/35">
            Separate with commas.
          </span>
        </label>

        <label className="block text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">
            Comments
          </span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={busy}
            rows={3}
            maxLength={4000}
            placeholder="What should the model have predicted? Any context?"
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
          />
        </label>

        <label className="block text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">
            Model prediction (optional)
          </span>
          <input
            value={modelPrediction}
            onChange={(e) => setModelPrediction(e.target.value)}
            disabled={busy}
            placeholder="What the UI or API suggested before your correction"
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
            maxLength={120}
          />
        </label>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={busy}
        >
          {busy ? "Uploading…" : "Submit feedback"}
        </Button>
        </Card>
      </form>
    </div>
  );
}
