import type { Metadata } from "next";
import { StartFromLink } from "./StartFromLink";

// A shared course link (/start?topic=…, from "Share course"). Signed out, it
// goes to sign-up with the topic kept; signed in, it opens the start dialog
// for that topic, or the course if they already have it.

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const topic = (await searchParams).topic;
  const name = typeof topic === "string" ? topic.trim().slice(0, 120) : "";
  return {
    title: name ? `Learn ${name} · Wondersity` : "Start a course · Wondersity",
    description: name
      ? `A short course on ${name}, planned as levels of 5-10 minute lessons with a guide, checks that make you think, and painted scenes.`
      : "Short courses on any topic, planned for you.",
  };
}

export default async function StartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const topic = (await searchParams).topic;
  return <StartFromLink topic={typeof topic === "string" ? topic.trim().slice(0, 120) : ""} />;
}
