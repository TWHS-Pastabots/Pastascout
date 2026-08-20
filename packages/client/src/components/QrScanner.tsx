import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * Live camera view that decodes QR codes from every frame via jsQR. Calls
 * `onScan` for each newly-read code (debounced so a code sitting in frame
 * doesn't fire repeatedly, but a genuinely different code always fires).
 *
 * `onScan` is read through a ref rather than being a `useEffect` dependency —
 * otherwise a parent re-render (state update on every scan, typically) would
 * pass a new function each time and restart the camera on every single scan.
 */
export function QrScanner({ onScan, active = true }: { onScan: (text: string) => void; active?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState("");

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let rafId: number;
    let cancelled = false;
    let lastText = "";
    let lastTime = 0;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            const now = Date.now();
            if (code.data !== lastText || now - lastTime > 1200) {
              lastText = code.data;
              lastTime = now;
              onScanRef.current(code.data);
            }
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        rafId = requestAnimationFrame(tick);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't access the camera");
      }
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  return (
    <div className="flex flex-col gap-2">
      <video ref={videoRef} className="w-full rounded-lg bg-black" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      {error && (
        <p className="text-sm text-amber-400">
          {error}. Make sure this page has camera permission (check your browser's site settings).
        </p>
      )}
    </div>
  );
}
