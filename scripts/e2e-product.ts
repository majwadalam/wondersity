// The everyday product features end to end, through the running app's HTTP
// API, with a throwaway learner who is deleted afterwards: the course's cast
// and voiced dialogues (one real staging and a few spoken lines, about $0.10),
// recasting, archiving and starting over, lesson ratings, Review, bookmarks,
// the data download, Help messages, the avatar, and the shared /start link.
//
//   node --env-file=.env.local --import tsx scripts/e2e-product.ts
//   E2E_BASE_URL=https://… to run against a deployment. --no-stage skips the paid steps.
//   The Help form allows 5 messages per 10 minutes per IP, so run it at most once per 10 minutes.

import { createClient, type Session } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const ref = new URL(url).hostname.split(".")[0];
const paid = !process.argv.includes("--no-stage");

function sessionCookie(session: Session) {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${ref}-auth-token`;
  if (value.length <= 3180) return `${name}=${value}`;
  return value.match(/.{1,3180}/g)!.map((p, i) => `${name}.${i}=${p}`).join("; ");
}

const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = "") => {
  results.push([name, ok, detail]);
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` (${detail})` : ""}`);
};

const level = { id: "level-1", title: "The examined life", description: "What Socrates asked, and why.", objective: "Explain the Socratic method." };
const modules = [
  { id: "level-1-module-1", title: "Asking what justice is", goal: "Follow a Socratic exchange.", description: "A dialogue.", level },
  { id: "level-1-module-2", title: "Knowing that you don't know", goal: "Explain Socratic ignorance.", description: "The oracle.", level },
];
const lesson = {
  version: 2,
  title: "Asking what justice is",
  objective: "Follow how Socrates tests a definition with questions.",
  estimatedMinutes: 7,
  approach: "socratic",
  approachReason: "The method is best seen in action.",
  blocks: [
    { kind: "explain", heading: "A question in the agora", body: "In Athens, Socrates asked people to define the things they claimed to know, then tested each answer with examples." },
    {
      kind: "dialogue",
      heading: "Glaucon tries a definition",
      turns: [
        { speaker: "Socrates", text: "Tell me, Glaucon, what do you say justice is?" },
        { speaker: "Glaucon", text: "Justice is giving each person what they are owed." },
        { speaker: "Socrates", text: "Then if a friend lends you a sword and later, in a rage, asks for it back, is it just to return it?" },
        { speaker: "Glaucon", text: "No, I suppose that would not be just at all." },
      ],
    },
    { kind: "check", ref: 0, hints: ["What did the sword example do to the definition?"], retry: "Think about what a counterexample does: it shows a definition is too broad." },
    { kind: "check", ref: 1, hints: [], retry: "Socrates kept asking rather than telling." },
    { kind: "summary", points: ["Socrates tests definitions with cases.", "A single counterexample can sink a definition."] },
  ],
  activities: [],
  questions: [
    {
      question: "Glaucon's friend lends him a sword, then asks for it back in a rage. What does this case do to Glaucon's definition of justice?",
      options: ["It shows the definition is too broad", "It proves justice cannot be defined", "It supports the definition", "It changes the subject"],
      correctAnswer: "It shows the definition is too broad",
      explanation: "A case the definition calls just but which plainly isn't shows the definition covers too much.",
    },
    {
      question: "How does Socrates move the conversation forward?",
      options: ["By asking a question that tests the answer", "By giving his own definition", "By quoting the law", "By ending the talk"],
      correctAnswer: "By asking a question that tests the answer",
      explanation: "He tests answers with questions instead of supplying his own.",
    },
  ],
};

async function main() {
  const email = `product-${Date.now()}@wondersity.test`;
  const password = `Prod-${crypto.randomUUID()}`;
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const id = created.user.id;
  const signed = await createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } }).auth.signInWithPassword({ email, password });
  const cookie = sessionCookie(signed.data.session!);
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(BASE + path, { method, headers: { cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, headers: res.headers, data: await res.json().catch(() => null) };
  };
  let supportIds: number[] = [];

  try {
    // A course with one finished lesson: a wrong first answer, finished yesterday.
    const { data: course, error: ce } = await admin
      .from("courses")
      .insert({ learner_id: id, topic: "Socrates", topic_key: "socrates", title: "Socrates and his questions", description: "How one man's questions changed philosophy.", modules, current_module: 1 })
      .select("id")
      .single();
    if (ce) throw ce;
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const { data: row, error: le } = await admin
      .from("lessons")
      .insert({ learner_id: id, topic: "Socrates", lesson_data: lesson, score: 8.5, course_id: course.id, module_index: 0, completed_at: yesterday })
      .select("id")
      .single();
    if (le) throw le;
    const lessonId = row.id as number;
    await admin.from("attempts").insert([
      { learner_id: id, lesson_id: lessonId, question_index: 0, chosen: "It supports the definition", correct: false },
      { learner_id: id, lesson_id: lessonId, question_index: 1, chosen: "By asking a question that tests the answer", correct: true },
    ]);

    // Profile: sign-in method and avatar.
    const profile = await call("PATCH", "/api/profile", { avatar: "owl" });
    check("profile saves the avatar and says how they sign in", profile.data?.profile?.avatarUrl === "/art/avatars/owl.webp" && profile.data.profile.signIn?.includes("email"), JSON.stringify(profile.data?.profile?.signIn));

    if (paid) {
      // Staging casts the guide and the dialogue's other speaker into the course.
      const staged = await call("POST", "/api/stage", { lessonId, topic: "Socrates" });
      check("lesson stages", staged.status === 200 && !!staged.data?.staging, `HTTP ${staged.status}`);
      const st = staged.data?.staging;
      check("staging names the dialogue's other speaker in its cast", !!st?.cast?.some((c: { name: string }) => /glaucon/i.test(c.name)), JSON.stringify(st?.cast));
      let courses = (await call("GET", "/api/courses")).data?.courses ?? [];
      let view = courses.find((c: { id: number }) => c.id === course.id);
      const cast = view?.cast ?? [];
      check("the course's cast has the guide and Glaucon, in different voices", cast.length >= 2 && new Set(cast.map((m: { voice: string }) => m.voice)).size === cast.length, JSON.stringify(cast.map((m: { name: string; voice: string }) => `${m.name}:${m.voice}`)));
      check("the guide's staged voice is the course's", cast.some((m: { name: string; voice: string }) => m.name === st?.guide?.name && m.voice === st?.guide?.voice));

      // Spoken lines: the guide's intro, and two dialogue turns by different speakers.
      const intro = await call("GET", `/api/voice?lessonId=${lessonId}&step=0`);
      check("the guide's line is voiced", intro.status === 200 && /\.wav$/.test(intro.data?.url ?? ""), `HTTP ${intro.status}`);
      const turn0 = await call("GET", `/api/voice?lessonId=${lessonId}&block=1&turn=0`);
      const turn1 = await call("GET", `/api/voice?lessonId=${lessonId}&block=1&turn=1`);
      check("each dialogue turn is voiced", turn0.status === 200 && turn1.status === 200, `HTTP ${turn0.status}, ${turn1.status}`);
      const audio = await fetch(turn1.data?.url ?? "x").catch(() => null);
      check("a turn's audio is a playable WAV", !!audio?.ok && (audio.headers.get("content-type") ?? "").includes("audio"), audio?.headers.get("content-type") ?? "no response");
      const notDialogue = await call("GET", `/api/voice?lessonId=${lessonId}&block=0&turn=0`);
      check("a block that isn't a dialogue has nothing to voice", notDialogue.status === 404);

      // Recasting changes the voice the next line is spoken in.
      const guideKey = cast.find((m: { name: string }) => m.name === st?.guide?.name)?.key;
      const other = ["ash", "verse", "cedar"].find((v) => v !== cast.find((m: { key: string }) => m.key === guideKey)?.voice)!;
      const recast = await call("PATCH", `/api/courses/${course.id}`, { action: "recast", key: guideKey, voice: other });
      const recastMember = recast.data?.course?.cast?.find((m: { key: string }) => m.key === guideKey);
      check("recasting the guide saves the learner's choice", recastMember?.voice === other && recastMember.chosen === true, JSON.stringify(recastMember));
      const intro2 = await call("GET", `/api/voice?lessonId=${lessonId}&step=0`);
      check("the guide's next line uses the new voice (a new recording)", intro2.status === 200 && intro2.data?.url !== intro.data?.url);
      const badRecast = await call("PATCH", `/api/courses/${course.id}`, { action: "recast", key: "nobody", voice: "ash" });
      check("recasting someone who isn't in the course is refused", badRecast.status === 404);
      courses = (await call("GET", "/api/courses")).data?.courses ?? [];
      view = courses.find((c: { id: number }) => c.id === course.id);
    }

    // Archive and unarchive.
    const archived = await call("PATCH", `/api/courses/${course.id}`, { action: "archive", archived: true });
    check("archiving marks the course archived", archived.data?.course?.archived === true);
    const unarchived = await call("PATCH", `/api/courses/${course.id}`, { action: "archive", archived: false });
    check("unarchiving lists it again", unarchived.data?.course?.archived === false);

    // Rating the lesson.
    const down = await call("POST", "/api/ratings", { lessonId, rating: -1 });
    const withWords = await call("POST", "/api/ratings", { lessonId, rating: -1, comment: "The sword example went by too fast." });
    const rating = await call("GET", `/api/ratings?lessonId=${lessonId}`);
    check("a thumbs down and its comment are saved (one rating per lesson)", down.status === 200 && withWords.status === 200 && rating.data?.rating?.comment === "The sword example went by too fast.");
    check("rating someone else's lesson is refused", (await call("POST", "/api/ratings", { lessonId: 1, rating: 1 })).status === 404);

    // Review: the missed check, without its answer until cleared.
    let review = await call("GET", "/api/review");
    const item = review.data?.items?.[0];
    check("Review lists the missed check only", review.data?.items?.length === 1 && item?.questionIndex === 0 && item.chosen === "It supports the definition");
    check("Review doesn't send the answer before it's cleared", item?.answer === null && !JSON.stringify(review.data).includes("covers too much"));
    const wrong = await call("POST", "/api/review", { lessonId, questionIndex: 0, chosen: "It changes the subject" });
    check("a wrong retry gets the other explanation, not the answer", wrong.data?.correct === false && /counterexample/.test(wrong.data?.retry ?? "") && wrong.data?.answer === null);
    const right = await call("POST", "/api/review", { lessonId, questionIndex: 0, chosen: "It shows the definition is too broad" });
    check("a right retry clears it", right.data?.correct === true && !!right.data?.answer);
    review = await call("GET", "/api/review");
    check("a cleared check shows as cleared, with why", !!review.data?.items?.[0]?.clearedAt && !!review.data.items[0].answer);
    const { data: attempt } = await admin.from("attempts").select("correct").eq("lesson_id", lessonId).eq("question_index", 0).single();
    check("the first answer keeps its grade", attempt?.correct === false);

    // Bookmarks with the account.
    await call("POST", "/api/bookmarks", { topics: ["Socrates", "Black holes"] });
    await call("DELETE", "/api/bookmarks", { key: "black holes" });
    const marks = await call("GET", "/api/bookmarks");
    check("bookmarks are saved with the account", JSON.stringify(marks.data?.bookmarks) === JSON.stringify([{ key: "socrates", topic: "Socrates" }]), JSON.stringify(marks.data?.bookmarks));

    // Help: signed in, and signed out with an email.
    const helpIn = await call("POST", "/api/support", { kind: "idea", message: "E2E test message, please ignore.", page: "/settings" });
    const helpOut = await fetch(`${BASE}/api/support`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "question", message: "E2E signed-out test, please ignore.", email }) });
    const helpNoEmail = await fetch(`${BASE}/api/support`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "question", message: "No email given here." }) });
    const { data: msgs } = await admin.from("support_messages").select("id, learner_id").eq("email", email);
    supportIds = (msgs ?? []).map((m) => m.id);
    check("Help messages are saved signed in and signed out", helpIn.status === 200 && helpOut.status === 200 && msgs?.length === 2 && msgs.some((m) => m.learner_id === id) && msgs.some((m) => !m.learner_id));
    check("a signed-out message needs an email", helpNoEmail.status === 400);

    // Data download.
    const exported = await call("GET", "/api/account/export");
    const missing = Object.entries(exported.data ?? {}).filter(([, v]) => (v as { unavailable?: boolean })?.unavailable).map(([k]) => k);
    check("Download my data is a JSON attachment", exported.status === 200 && /attachment/.test(exported.headers.get("content-disposition") ?? ""));
    check("it holds every table, readable", missing.length === 0 && exported.data?.lessons?.length === 1 && exported.data?.lesson_ratings?.length === 1 && exported.data?.bookmarks?.length === 1, missing.join(", "));

    // Starting over keeps the history.
    const reset = await call("PATCH", `/api/courses/${course.id}`, { action: "reset" });
    const after = reset.data?.course;
    check("starting over goes back to lesson 1 with no lessons on the path", after?.currentModule === 0 && after.modules.every((m: { lesson: unknown }) => !m.lesson));
    check("the lesson finished before still counts for the streak", after?.pastCompletions?.length === 1);
    const { data: kept } = await admin.from("lessons").select("id, module_index").eq("id", lessonId).single();
    check("the old lesson is kept, off the path", kept?.module_index === null);
    review = await call("GET", "/api/review");
    check("Review still has the old mistake", review.data?.items?.length === 1);

    // Pages.
    const start = await fetch(`${BASE}/start?topic=${encodeURIComponent("The Silk Road")}`);
    check("a shared /start link opens and names the course", start.status === 200 && (await start.text()).includes("Learn The Silk Road"));
    const help = await fetch(`${BASE}/help`);
    check("/help is public", help.status === 200);
    const reviewPage = await fetch(`${BASE}/review`, { redirect: "manual" });
    check("/review asks a signed-out visitor to sign in", reviewPage.status === 307 || reviewPage.status === 302);
    const voiceSample = await fetch(`${BASE}/audio/voices/ash.wav`, { method: "HEAD" });
    check("voice samples are served", voiceSample.ok);

    // Deleting everything includes the new tables.
    const del = await call("DELETE", "/api/account/claim");
    const { count: leftMarks } = await admin.from("bookmarks").select("*", { count: "exact", head: true }).eq("learner_id", id);
    const { count: leftMsgs } = await admin.from("support_messages").select("*", { count: "exact", head: true }).eq("learner_id", id);
    check("Delete my data removes bookmarks and their messages too", del.status === 200 && leftMarks === 0 && leftMsgs === 0);
  } finally {
    if (supportIds.length) await admin.from("support_messages").delete().in("id", supportIds);
    await admin.from("courses").delete().eq("learner_id", id);
    await admin.from("profiles").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id);
    console.log("Deleted the throwaway learner.");
  }

  const failed = results.filter(([, ok]) => !ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
