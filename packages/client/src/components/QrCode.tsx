import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Verified empirically against jsQR (see qrTransfer.ts) — smaller renders of a
// dense code failed to decode even in a clean, noise-free test. Real camera
// capture off a screen (glare, motion, angle) needs more headroom than that.
export function QrCode({ text, size = 480 }: { text: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    // margin (the quiet zone around the code) matters more than it looks like
    // it should — too tight and real decoders (jsQR included) can fail to
    // even locate the finder patterns, especially off a photographed screen
    // rather than a print. 4 modules is the QR spec's own recommendation.
    QRCode.toDataURL(text, { width: size, margin: 4, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [text, size]);

  if (!dataUrl) {
    return <div style={{ width: size, height: size }} className="animate-pulse rounded-lg bg-slate-800" />;
  }
  return (
    <img
      src={dataUrl}
      alt="QR code"
      width={size}
      height={size}
      className="rounded-lg bg-white p-2"
    />
  );
}

/**
 * Displays a sequence of QR codes one at a time — for entries too large for a
 * single code. Auto-advances so a scout can just hold the phone steady while
 * an analyst scans, but stays manually steppable in case the cadence doesn't
 * match how fast the other phone can actually scan.
 */
export function QrCodeCarousel({ chunks, autoAdvanceMs = 2200 }: { chunks: string[]; autoAdvanceMs?: number }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    setIndex(0);
  }, [chunks]);

  useEffect(() => {
    if (!playing || chunks.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % chunks.length), autoAdvanceMs);
    return () => clearInterval(id);
  }, [playing, chunks.length, autoAdvanceMs]);

  return (
    <div className="flex flex-col items-center gap-3">
      <QrCode text={chunks[index]} />
      {chunks.length > 1 && (
        <>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + chunks.length) % chunks.length)}
              className="rounded-lg bg-slate-800 px-3 py-1 text-slate-200"
            >
              ‹
            </button>
            <span>
              {index + 1} / {chunks.length}
            </span>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % chunks.length)}
              className="rounded-lg bg-slate-800 px-3 py-1 text-slate-200"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="rounded-lg bg-slate-800 px-3 py-1 text-slate-200"
            >
              {playing ? "Pause" : "Auto-play"}
            </button>
          </div>
          <div className="flex gap-1">
            {chunks.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-green-400" : "bg-slate-700"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
