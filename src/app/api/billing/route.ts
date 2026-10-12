import { NextResponse } from "next/server";
import { asLearner } from "@/lib/auth";
import { getPartner, getReferral, getSubscription, getUsageSince } from "@/lib/db";
import {
  FREE_COURSES_PER_WINDOW,
  FREE_LESSONS_PER_COURSE,
  PAID_LESSONS_PER_WINDOW,
  PAINTED_LESSONS_PER_WINDOW,
  WINDOW_DAYS,
  billingEnabled,
  planFrom,
  windowStart,
} from "@/lib/plans";
import { refFromCookieHeader } from "@/lib/referrals";
import { serverError } from "@/lib/requestGuards";

// The learner's plan, what they've used in the last 30 days, and the creator
// who referred them (whose discount applies at checkout).

export async function GET(request: Request) {
  return asLearner(async (learnerId) => {
    try {
      const [subscription, usage, referredBy] = await Promise.all([
        getSubscription(learnerId),
        getUsageSince(learnerId, windowStart()),
        getReferral(learnerId),
      ]);
      // The saved referral wins; otherwise a referral link followed since signing up.
      const code = referredBy ?? refFromCookieHeader(request.headers.get("cookie"));
      const partner = code ? await getPartner(code) : null;
      return NextResponse.json({
        billingEnabled: billingEnabled(),
        plan: planFrom(subscription),
        usage,
        referral: partner ? { code: partner.code, name: partner.name, discountCode: partner.discount_code } : null,
        limits: {
          windowDays: WINDOW_DAYS,
          freeLessonsPerCourse: FREE_LESSONS_PER_COURSE,
          freeCourses: FREE_COURSES_PER_WINDOW,
          paidLessons: PAID_LESSONS_PER_WINDOW,
          paintedLessons: PAINTED_LESSONS_PER_WINDOW,
        },
      });
    } catch (error) {
      return serverError(error, "Couldn't load your plan.");
    }
  });
}
