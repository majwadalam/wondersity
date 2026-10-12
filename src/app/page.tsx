"use client";

import { MarketingFooter } from "@/components/app/AppShell";
import { Hero } from "@/components/landing/Hero";
import { TopicMarquee } from "@/components/landing/Marquee";
import { ClosingCta, CourseGallery, Faq, HowItWorks, NotAChat, Quality, Subjects } from "@/components/landing/Sections";

export default function Home() {
  return (
    <main id="top" className="bg-white">
      <Hero />
      <TopicMarquee />
      <NotAChat />
      <HowItWorks />
      <Subjects />
      <Quality />
      <CourseGallery />
      <Faq />
      <ClosingCta />
      <MarketingFooter dark />
    </main>
  );
}
