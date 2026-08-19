import { Router } from "express";
import { networkInterfaces } from "node:os";
import QRCode from "qrcode";

export const networkRouter = Router();

function getLocalIps(): string[] {
  const nets = networkInterfaces();
  const ips: string[] = [];
  for (const iface of Object.values(nets)) {
    for (const addr of iface ?? []) {
      if (addr.family === "IPv4" && !addr.internal) ips.push(addr.address);
    }
  }
  return ips;
}

// GET /api/network/join-info?port=5174&clientPort=5173
// Returns local-network URLs scouts' phones can open, plus a QR code for the first one.
networkRouter.get("/join-info", async (req, res) => {
  const clientPort = req.query.clientPort ?? "5173";
  const ips = getLocalIps();
  const urls = ips.map((ip) => `http://${ip}:${clientPort}`);
  const qrDataUrl = urls[0] ? await QRCode.toDataURL(urls[0]) : null;
  res.json({ urls, qrDataUrl });
});
