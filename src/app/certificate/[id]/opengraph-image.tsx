import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { certificateUrl, qrPng } from "@/lib/certificateLink";
import { getPublicCertificate } from "@/lib/db";

// The certificate as an image, in the same design as its page: the preview
// wherever its link is shared, and the "Image" download. Fraunces (SIL Open
// Font License) is read from public/fonts, which the production image keeps.

export const alt = "A Wondersity certificate of completion";
export const size = { width: 1200, height: 848 };
export const contentType = "image/png";

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const font = (file: string) => readFile(join(process.cwd(), "public/fonts", file));

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c, serif, serifItalic, italic, qr] = await Promise.all([
    getPublicCertificate(id).catch(() => null),
    font("fraunces-latin-600-normal.woff"),
    font("fraunces-latin-600-italic.woff"),
    font("fraunces-latin-400-italic.woff"),
    certificateUrl(id).then(qrPng),
  ]);
  const navy = "#0a2540";
  const muted = "#5b6b7f";
  const scope = c ? `${c.lessons} interactive lessons${c.levels.length ? ` in ${c.levels.length} levels` : ""}` : "";
  const diamond = (s = 10) => <div style={{ width: s, height: s, background: "#635bff", transform: "rotate(45deg)" }} />;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#eef2f8", padding: 36 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            position: "relative",
            background: "#fffdf9",
            backgroundImage: "radial-gradient(ellipse at 50% 50%, rgba(99,91,255,0.08), rgba(99,91,255,0) 65%)",
            boxShadow: "0 24px 60px -20px rgba(10,37,64,0.35)",
            borderRadius: 8,
          }}
        >
          {/* The double rule and its corners. */}
          <div style={{ position: "absolute", top: 16, left: 16, right: 16, bottom: 16, border: `2px solid ${navy}` }} />
          <div style={{ position: "absolute", top: 26, left: 26, right: 26, bottom: 26, border: "1px solid rgba(10,37,64,0.2)" }} />
          {[
            { top: 12, left: 12 },
            { top: 12, right: 12 },
            { bottom: 12, left: 12 },
            { bottom: 12, right: 12 },
          ].map((p, i) => (
            <div key={i} style={{ position: "absolute", ...p, display: "flex" }}>
              {diamond(9)}
            </div>
          ))}

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "62px 80px 56px" }}>
            <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", position: "relative", width: 38, height: 26 }}>
                  <div style={{ position: "absolute", left: 0, top: 0, width: 26, height: 26, borderRadius: 13, background: "#635bff" }} />
                  <div style={{ position: "absolute", left: 12, top: 0, width: 26, height: 26, borderRadius: 13, background: "#3aa0e8", opacity: 0.9 }} />
                </div>
                <div style={{ fontSize: 26, fontWeight: 600, color: navy, letterSpacing: -1 }}>wondersity</div>
              </div>
              <div style={{ fontSize: 16, color: muted }}>{c ? `No. ${c.id}` : ""}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "center" }}>
              <div style={{ fontSize: 17, letterSpacing: 7, color: "#635bff", fontWeight: 700 }}>CERTIFICATE OF COMPLETION</div>
              <div style={{ marginTop: 22, fontSize: 26, color: muted, fontFamily: "FrauncesItalic" }}>This is to certify that</div>
              <div style={{ marginTop: 6, fontSize: 76, color: navy, fontFamily: "Fraunces", textAlign: "center", lineHeight: 1.05 }}>{c?.learner_name ?? "Wondersity"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
                <div style={{ width: 120, height: 1, background: "rgba(10,37,64,0.25)" }} />
                {diamond(8)}
                <div style={{ width: 120, height: 1, background: "rgba(10,37,64,0.25)" }} />
              </div>
              <div style={{ marginTop: 16, fontSize: 26, color: muted, fontFamily: "FrauncesItalic" }}>has successfully completed the course</div>
              <div style={{ marginTop: 8, fontSize: 44, color: navy, fontFamily: "FrauncesSemiItalic", textAlign: "center", maxWidth: 900, lineHeight: 1.2 }}>{c?.course_title ?? ""}</div>
              <div style={{ marginTop: 14, fontSize: 19, color: muted }}>{scope}</div>
            </div>

            <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", width: 300 }}>
                <div style={{ fontSize: 24, color: navy, fontFamily: "Fraunces" }}>{c ? longDate(c.completed_at) : ""}</div>
                <div style={{ marginTop: 8, height: 1, width: 240, background: "rgba(10,37,64,0.3)" }} />
                <div style={{ marginTop: 8, fontSize: 14, letterSpacing: 2, color: muted }}>DATE OF COMPLETION</div>
              </div>
              <div
                style={{
                  display: "flex",
                  width: 118,
                  height: 118,
                  borderRadius: 59,
                  background: "linear-gradient(135deg, #7a5cff, #3aa0e8)",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 10px 24px -8px rgba(99,91,255,0.6)",
                }}
              >
                <div style={{ display: "flex", width: 98, height: 98, borderRadius: 49, border: "1.5px solid rgba(255,255,255,0.6)", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                  <div style={{ display: "flex", position: "relative", width: 34, height: 22 }}>
                    <div style={{ position: "absolute", left: 0, top: 0, width: 22, height: 22, borderRadius: 11, background: "white" }} />
                    <div style={{ position: "absolute", left: 12, top: 0, width: 22, height: 22, borderRadius: 11, background: "white", opacity: 0.6 }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, letterSpacing: 2.5, color: "white", fontWeight: 700 }}>CERTIFIED</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", gap: 18, width: 300 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <div style={{ fontSize: 30, color: navy, fontFamily: "FrauncesSemiItalic" }}>Wondersity</div>
                  <div style={{ marginTop: 8, height: 1, width: 170, background: "rgba(10,37,64,0.3)" }} />
                  <div style={{ marginTop: 8, fontSize: 14, letterSpacing: 2, color: muted }}>SCAN TO VERIFY</div>
                </div>
                <img src={qr} width={84} height={84} alt="" />
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: serif, weight: 600, style: "normal" },
        { name: "FrauncesSemiItalic", data: serifItalic, weight: 600, style: "italic" },
        { name: "FrauncesItalic", data: italic, weight: 400, style: "italic" },
      ],
    }
  );
}
