import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function AnalystJoin() {
  const [info, setInfo] = useState<{ urls: string[]; qrDataUrl: string | null } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .joinInfo("5173")
      .then(setInfo)
      .catch(() => setError(true));
  }, []);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
      <h2 className="font-semibold text-slate-100">Scouts: scan to join</h2>
      <p className="mt-1 text-sm text-slate-400">
        Make sure everyone's on the same wifi as this laptop (a local hotspot works great with no internet at all).
      </p>

      {error && <p className="mt-4 text-red-400">Couldn't reach the server for join info.</p>}

      {info && (
        <div className="mt-4 flex flex-col items-center gap-3">
          {info.qrDataUrl && (
            <img src={info.qrDataUrl} alt="QR code to join" className="rounded-lg bg-white p-2" width={220} height={220} />
          )}
          <div className="flex flex-col gap-1">
            {info.urls.map((url) => (
              <code key={url} className="rounded bg-slate-800 px-2 py-1 text-green-300">
                {url}
              </code>
            ))}
            {info.urls.length === 0 && <p className="text-sm text-slate-500">No local network address found.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
