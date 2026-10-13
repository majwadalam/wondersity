import { NextResponse } from "next/server";
import { asLearner } from "@/lib/auth";
import { listCertificates, listCourses } from "@/lib/db";
import { issueCertificate } from "@/lib/milestones";
import { serverError } from "@/lib/requestGuards";

// The learner's certificates. A course completed before certificates existed
// (or whose certificate wasn't issued) gets one here.

export async function GET() {
  return asLearner(async (learnerId) => {
    try {
      const [certificates, courses] = await Promise.all([listCertificates(learnerId), listCourses(learnerId)]);
      const have = new Set(certificates.map((c) => c.course_id));
      const missing = courses.filter((c) => c.status === "completed" && !have.has(c.id));
      for (const c of missing) await issueCertificate(learnerId, c.id).catch((e) => console.error("issue certificate:", e));
      return NextResponse.json({ certificates: missing.length ? await listCertificates(learnerId) : certificates });
    } catch (error) {
      return serverError(error, "Couldn't load your certificates.");
    }
  });
}
