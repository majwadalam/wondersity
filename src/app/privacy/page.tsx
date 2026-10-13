import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection, Mail } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy — Wondersity",
  description: "What Wondersity stores, who it shares lesson content with, and how to get or delete your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      intro={
        <p>
          Wondersity is a tutor that turns a topic into a course of short lessons. This page explains, in plain English, what we keep, where it goes and how to remove it. The short
          version: we keep what the app needs to teach you, we don&rsquo;t show ads, and we don&rsquo;t sell your data.
        </p>
      }
    >
      <LegalSection title="Your account">
        <p>
          Accounts are handled by <strong>Supabase Auth</strong>. You can sign in with your email and a password (Supabase keeps only a secure hash of it; we never see it) or with <strong>Google</strong>. If you use Google,
          we receive your email address and, if your Google profile has one, your name.
        </p>
      </LegalSection>

      <LegalSection title="What we store">
        <p>We store the following in our Supabase database:</p>
        <LegalList
          items={[
            "Your email address, and your name if you gave one",
            "The courses you start, and the lessons written for them",
            "Your answers to the questions inside lessons, and whether they were right",
            "Your progress through each course, and your streaks",
            "Your settings, and when you confirmed you're 13 or older",
            "Mistakes you report in a lesson, with what you wrote",
            "How you rate a lesson (thumbs up or down) and anything you add",
            "Checks you missed that you later got right on the Review page",
            "The avatar you pick, the courses you star and archive, and the voices you choose for a course's guides",
            "Messages you send us from the Help page, with the page you sent it from (and your email, if you weren't signed in)",
            "How far you get in each lesson, to see where lessons lose people",
            "If you buy Pro: which plan, its status and renewal date, and Paddle's ids for you and your plan (not your card)",
          ]}
        />
        <p>
          <strong>Bookmarks</strong> (starred courses) are stored only in your browser, not on our servers. Clearing your browser&rsquo;s site data removes them.
        </p>
      </LegalSection>

      <LegalSection title="AI providers">
        <p>
          Lessons, pictures and voices are made by AI models, reached through <strong>OpenRouter</strong>. To make them, we send the topic you named and the lesson content to these
          providers. We don&rsquo;t send your email address or name.
        </p>
        <LegalList
          items={[
            <>
              <strong>Lesson text</strong>: written and reviewed by OpenAI models (GPT-6.1 Sol; the guide&rsquo;s script by GPT-6 Luna).
            </>,
            <>
              <strong>Fact checks</strong>: short factual claims from your lessons are sent as web searches (through OpenRouter&rsquo;s search, by default Exa) so they can be
              checked against sources.
            </>,
            <>
              <strong>Images</strong> (course worlds, covers and lesson scenes): painted by Google Gemini.
            </>,
            <>
              <strong>Voice</strong>: the guide&rsquo;s lines are spoken by OpenAI&rsquo;s gpt-audio-mini.
            </>,
          ]}
        />
        <p>Each provider handles that content under its own terms and privacy policy.</p>
      </LegalSection>

      <LegalSection title="Creator referrals">
        <p>
          If you arrive through a creator&rsquo;s link or companion page, we keep a small cookie with their partner code for 30 days. If you sign up, we save which creator
          referred you, and if you buy Pro the code goes with the checkout, so we can pay them their share. They don&rsquo;t see who you are; they see only how many people
          they referred.
        </p>
      </LegalSection>

      <LegalSection title="Payments">
        <p>
          If you buy Pro, <strong>Paddle</strong> processes the payment as our merchant of record. You give your payment details to Paddle, not to us, and Paddle handles them
          under its own privacy policy. Paddle tells us your plan&rsquo;s status so we can unlock it.
        </p>
      </LegalSection>

      <LegalSection title="Images and voice clips">
        <p>
          Generated images and voice clips are kept in a <strong>public storage bucket</strong>, so your browser can load them quickly. Each file sits under a long, unguessable
          path and isn&rsquo;t listed anywhere, but anyone who has the exact link can open it. These files contain lesson content, not your personal details.
        </p>
      </LegalSection>

      <LegalSection title="Go deeper: videos, books and images">
        <p>
          At the end of a lesson we suggest videos, articles, books and images. To find them, we look up the lesson&rsquo;s topic (never your details) on YouTube, Open
          Library and Wikipedia, and search the web. When you open that part of a lesson, your browser loads book covers from Open Library, image thumbnails from Wikimedia
          and video thumbnails from YouTube, so those services see your IP address as with any website. A video only loads from YouTube&rsquo;s privacy-enhanced player
          when you press play.
        </p>
      </LegalSection>

      <LegalSection title="What we don't do">
        <LegalList items={["We don't show ads.", "We don't sell or rent your data.", "We don't use your data to track you across other sites."]} />
      </LegalSection>

      <LegalSection title="Getting a copy of your data">
        <p>
          <Link href="/settings" className="font-medium text-accent hover:text-accent-strong">
            Settings
          </Link>{" "}
          → <strong>Download my data</strong> gives you everything above that&rsquo;s tied to your account, as one JSON file.
        </p>
      </LegalSection>

      <LegalSection title="Deleting your data">
        <p>
          You can delete everything at once from{" "}
          <Link href="/settings" className="font-medium text-accent hover:text-accent-strong">
            Settings
          </Link>{" "}
          → <strong>Delete your data</strong>. That removes every course, lesson, answer and setting tied to your account. It can&rsquo;t be undone. If you&rsquo;d also like your
          sign-in account removed, email us and we&rsquo;ll do it.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>If we change how we handle your data, we&rsquo;ll update this page and the date at the top. For significant changes, we&rsquo;ll tell you in the app or by email first.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions or requests about your data: <Mail />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
