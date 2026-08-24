import { useRef, useState } from "react";

const MAX_PHOTOS = 6;
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.72;

/**
 * Resizes and re-encodes an image client-side before it ever touches the
 * network. A phone camera photo can be 5-10MB raw — six of those per pit
 * entry would make offline sync over venue wifi miserable. This gets each
 * photo down to roughly 100-300KB.
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unsupported"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function PhotoUpload({ photos, onChange }: { photos: string[]; onChange: (p: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`Up to ${MAX_PHOTOS} photos per team.`);
      return;
    }

    setBusy(true);
    try {
      const compressed = await Promise.all(Array.from(files).slice(0, room).map(compressImage));
      onChange([...photos, ...compressed]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't process that photo");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removePhoto(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-300">Photos</span>
        <span className="text-xs text-slate-500">
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>

      {/* capture="environment" opens the rear camera directly on phones; desktop falls back to a file picker. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((src, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-slate-800">
            <img src={src} alt={`Robot photo ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(i)}
              aria-label={`Remove photo ${i + 1}`}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-sm font-bold leading-none text-white"
            >
              ×
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-700 text-slate-400 hover:border-green-600 hover:text-green-400 disabled:opacity-50"
          >
            <span className="text-xl leading-none">{busy ? "…" : "+"}</span>
            <span className="text-[10px]">{busy ? "Processing" : "Add photo"}</span>
          </button>
        )}
      </div>

      {error && <p className="text-xs text-amber-400">{error}</p>}
    </div>
  );
}
