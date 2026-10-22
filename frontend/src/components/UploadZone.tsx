import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import { AlertCircle, CloudUpload, FileText } from "lucide-react";
import { getDocument, uploadDocument } from "../services/api";
import { errorMessage, formatBytes } from "../services/format";
import type { DocumentRead } from "../types";
import { StatusBadge } from "./StatusBadge";

// Keep in sync with MAX_UPLOAD_MB on the backend (default 25).
const MAX_UPLOAD_MB = 25;
const ACCEPTED_EXTENSIONS = [".pdf", ".txt"];
const POLL_INTERVAL_MS = 2000;

interface UploadZoneProps {
  /** Called whenever a document changes to a terminal state, so lists can refresh. */
  onUploaded: () => void;
}

export function UploadZone({ onUploaded }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tracked, setTracked] = useState<DocumentRead | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trackedId = tracked?.id;
  const trackedStatus = tracked?.status;

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const dot = file.name.lastIndexOf(".");
      const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
      if (!ACCEPTED_EXTENSIONS.includes(extension)) {
        setError("Only PDF and TXT files are supported.");
        return;
      }
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setError(`File is larger than the ${MAX_UPLOAD_MB} MB limit.`);
        return;
      }

      setUploading(true);
      setTracked(null);
      try {
        const document = await uploadDocument(file);
        setTracked(document);
        onUploaded();
      } catch (uploadError) {
        setError(errorMessage(uploadError, "Upload failed."));
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  // Poll the tracked document until it reaches COMPLETED or FAILED.
  useEffect(() => {
    if (!trackedId || trackedStatus === "COMPLETED" || trackedStatus === "FAILED") {
      return;
    }
    const timer = window.setInterval(async () => {
      try {
        const latest = await getDocument(trackedId);
        setTracked(latest);
        if (latest.status === "COMPLETED" || latest.status === "FAILED") {
          onUploaded();
        }
      } catch {
        // Transient network error: keep polling on the next tick.
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [trackedId, trackedStatus, onUploaded]);

  const openPicker = () => inputRef.current?.click();

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      void handleFile(file);
    }
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
    event.target.value = "";
  };

  const progressPercent = trackedStatus === "PROCESSING" ? 66 : trackedStatus === "PENDING" ? 33 : 100;
  const progressColor = trackedStatus === "FAILED" ? "bg-red-500" : trackedStatus === "COMPLETED" ? "bg-emerald-500" : "bg-blue-500";

  return (
    <section className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a PDF or TXT document"
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:border-slate-400"
        }`}
      >
        <CloudUpload className="h-10 w-10 text-slate-400" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-slate-900">
            {uploading ? "Uploading..." : "Drag a document here, or click to browse"}
          </p>
          <p className="mt-1 text-xs text-slate-500">PDF or TXT, up to {MAX_UPLOAD_MB} MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={onInputChange}
          onClick={(event) => event.stopPropagation()}
        />
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {tracked && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <FileText className="h-5 w-5 text-slate-500" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{tracked.original_filename}</p>
              <p className="text-xs text-slate-500">{formatBytes(tracked.size_bytes)}</p>
            </div>
            <StatusBadge status={tracked.status} />
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {tracked.status === "PENDING" && "Queued for text extraction..."}
            {tracked.status === "PROCESSING" && "Extracting text and running AI risk analysis..."}
            {tracked.status === "COMPLETED" && "Analysis complete. Open the document to review findings."}
            {tracked.status === "FAILED" && (tracked.error_message ?? "Processing failed.")}
          </p>
        </div>
      )}
    </section>
  );
}
