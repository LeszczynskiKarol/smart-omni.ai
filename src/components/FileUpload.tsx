import { useState, useRef, useCallback, type DragEvent } from "react";
import { uploadFiles, type ProcessedFile } from "../lib/api";

const ICONS: Record<string, string> = {
  "application/pdf": "📄",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
  "application/msword": "📝",
  "image/png": "🖼️",
  "image/jpeg": "🖼️",
  "image/gif": "🖼️",
  "image/webp": "🖼️",
  "text/plain": "📃",
  "text/csv": "📊",
  "text/html": "🌐",
  "application/json": "📋",
};

function getIcon(mime: string) {
  return ICONS[mime] || "📎";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  onFilesProcessed: (files: ProcessedFile[]) => void;
  pendingFiles: PendingFile[];
  setPendingFiles: (files: PendingFile[]) => void;
  disabled?: boolean;
}

export interface PendingFile {
  file: File;
  preview?: string; // data URL for images
}

export default function FileUpload({ onFilesProcessed, pendingFiles, setPendingFiles, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter((f) => f.size <= 20 * 1024 * 1024);
    const total = [...pendingFiles.map((p) => p.file), ...valid].slice(0, 5);

    const pending: PendingFile[] = total.map((f) => {
      const existing = pendingFiles.find((p) => p.file === f);
      if (existing) return existing;

      const pf: PendingFile = { file: f };
      if (f.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          setPendingFiles((prev) =>
            prev.map((p) => p.file === f ? { ...p, preview: reader.result as string } : p)
          );
        };
        reader.readAsDataURL(f);
      }
      return pf;
    });

    setPendingFiles(pending);
  }, [pendingFiles, setPendingFiles]);

  const removeFile = (index: number) => {
    setPendingFiles(pendingFiles.filter((_, i) => i !== index));
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFiles(files);
  };

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  // Upload & process all pending files
  const processAll = async (): Promise<ProcessedFile[]> => {
    if (!pendingFiles.length) return [];
    setUploading(true);
    setUploadProgress("Przesyłam pliki...");

    try {
      const result = await uploadFiles(pendingFiles.map((p) => p.file));
      setUploadProgress("");
      setUploading(false);
      return result.files;
    } catch (err: any) {
      setUploadProgress("");
      setUploading(false);
      throw err;
    }
  };

  // Expose processAll via ref-like pattern
  // Parent calls this before sending message
  (FileUpload as any)._processAll = processAll;

  return (
    <>
      {/* Drop overlay — covers the chat area */}
      {dragOver && (
        <div
          className="absolute inset-0 z-50 bg-accent/10 backdrop-blur-sm border-2 border-dashed border-accent/40 rounded-2xl flex items-center justify-center transition-all"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="text-center">
            <div className="text-4xl mb-2">📎</div>
            <div className="text-accent font-medium">Upuść pliki tutaj</div>
            <div className="text-xs text-gray-400 mt-1">PDF, DOCX, obrazy, tekst · max 20MB · max 5 plików</div>
          </div>
        </div>
      )}

      {/* Pending files bar */}
      {pendingFiles.length > 0 && (
        <div className="px-4 py-2 border-t border-surface-3 bg-surface-1/80">
          <div className="max-w-3xl mx-auto flex items-center gap-2 flex-wrap">
            {pendingFiles.map((pf, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-surface-2 border border-surface-4 rounded-lg px-2 py-1.5 group">
                {pf.preview ? (
                  <img src={pf.preview} alt="" className="w-6 h-6 rounded object-cover" />
                ) : (
                  <span className="text-sm">{getIcon(pf.file.type)}</span>
                )}
                <span className="text-xs text-gray-300 max-w-[120px] truncate">{pf.file.name}</span>
                <span className="text-[9px] text-gray-600">{formatSize(pf.file.size)}</span>
                <button
                  onClick={() => removeFile(i)}
                  disabled={disabled || uploading}
                  className="text-gray-600 hover:text-red-400 text-xs ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
            {uploading && (
              <div className="flex items-center gap-2 text-xs text-accent">
                <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                {uploadProgress}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.txt,.csv,.md,.html,.json,.xml,.png,.jpg,.jpeg,.gif,.webp"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) addFiles(files);
          e.target.value = "";
        }}
      />

      {/* Attach button — rendered in parent's input row */}
      {/* Access: fileInputRef.current?.click() */}
    </>
  );
}

// Helper to trigger file picker from parent
export function triggerFilePicker(ref: React.RefObject<HTMLInputElement | null>) {
  ref.current?.click();
}
