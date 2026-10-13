// A certificate's public address and its QR code (scanned to verify it).
// Server only: reads the request's host when NEXT_PUBLIC_SITE_URL isn't set.

import { headers } from "next/headers";
import QRCode from "qrcode";

/** The site's origin: NEXT_PUBLIC_SITE_URL, else the host this request came to. */
export async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const certificateUrl = async (id: string) => `${await siteOrigin()}/certificate/${id}`;

const QR_OPTIONS = { margin: 0, errorCorrectionLevel: "M" as const, color: { dark: "#0a2540", light: "#0000" } };

/** The QR code as SVG markup (for the page). */
export const qrSvg = (url: string) => QRCode.toString(url, { ...QR_OPTIONS, type: "svg" });

/** The QR code as a PNG data URL (for the share image, whose renderer takes images, not inline SVG). */
export const qrPng = (url: string) => QRCode.toDataURL(url, { ...QR_OPTIONS, width: 240 });
