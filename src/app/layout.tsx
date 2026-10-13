import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app/AppShell";
import "katex/dist/katex.min.css";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Share images and other URL fields need an absolute base: the site's own address,
// else the production address Vercel provides, else the local dev server. `||`, not `??`:
// the Dockerfile declares the build arg, so an unset one arrives as "".
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

const DESCRIPTION = "Courses for what nobody teaches: too niche, too new or too scattered. Name a topic, for work or for curiosity; Wondersity plans a course, teaches it hands-on, and remembers where you left off.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Wondersity — courses for what nobody teaches",
  description: DESCRIPTION,
  // The images come from app/opengraph-image.jpg and app/twitter-image.jpg.
  openGraph: { type: "website", siteName: "Wondersity", title: "Wondersity — courses for what nobody teaches", description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: "Wondersity — courses for what nobody teaches", description: DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      style={{ colorScheme: "light" }}
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
