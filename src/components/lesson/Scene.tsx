"use client";

import { Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import { isRemote } from "@/lib/remoteImage";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Staging } from "@/lib/staging";

/**
 * A staged step's scene: the painting, its setting, and the guide's line.
 * Wide screens: a tall panel beside the step, so the question stays in view.
 * Phones: a slim strip with the line underneath. A painting that isn't there
 * (still being made, or failed) is a calm gradient with the setting written
 * on it, never an empty box. With voice on, the line is spoken as the step opens.
 */
export function SceneHeader({
  staging,
  step,
  active,
  voice,
  banner,
}: {
  staging: Staging;
  step: number;
  active: boolean;
  voice: VoiceControl | null;
  /** Kept for older callers; the intro no longer differs. */
  large?: boolean;
  /** A short strip above a hands-on step, which needs the full width. */
  banner?: boolean;
}) {
  const wide = useWide();
  const s = staging.steps[step];
  if (!s) return null;
  const image = staging.images[s.image]?.url;
  // The caption belongs to the picture, so they can't disagree (older lessons kept it per step).
  const setting = staging.images[s.image]?.setting ?? s.setting;
  const speaker = (light: boolean) => (
    <p
      className={`flex items-center gap-2 text-xs font-semibold ${light ? "text-white/75" : "text-muted"}`}
    >
      {staging.guide.name}
      {voice && (
        <SpeakButton
          voice={voice}
          step={step}
          active={active}
          tone={light ? "dark" : "light"}
        />
      )}
    </p>
  );
  // One layout at a time, so the line is spoken once and the painting loads once.
  if (wide && banner) {
    return (
      <div className="relative h-44 overflow-hidden rounded-3xl">
        <Backdrop image={image} setting={setting} priority={step === 0} sizes="1100px" />
        {s.line && <div className="absolute inset-0 flex items-end bg-gradient-to-r from-[#0a2540]/90 via-[#0a2540]/55 to-transparent px-6 pb-5">
          <div className="flex max-w-[640px] items-start gap-3.5">
            <Portrait staging={staging} size="h-11 w-11" />
            <div className="min-w-0 flex-1">
              {speaker(true)}
              <p className="mt-1 text-[16px] leading-snug text-white">{s.line}</p>
            </div>
          </div>
        </div>}
        {setting && image && <SettingChip setting={setting} />}
      </div>
    );
  }
  if (wide) {
    return (
      <div className="relative h-[min(640px,calc(100vh-9rem))] overflow-hidden rounded-3xl">
        <Backdrop
          image={image}
          setting={setting}
          priority={step === 0}
          sizes="560px"
        />
        {setting && image && <SettingChip setting={setting} />}
        {s.line && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0a2540]/95 via-[#0a2540]/65 to-transparent px-6 pt-24 pb-6">
          <div className="flex items-start gap-3.5">
            <Portrait staging={staging} size="h-12 w-12" />
            <div className="min-w-0 flex-1">
              {speaker(true)}
              <p className="mt-1 text-[17px] leading-snug text-white">
                {s.line}
              </p>
            </div>
          </div>
        </div>}
      </div>
    );
  }
  return (
    <div>
      <div className="relative -mx-4 aspect-[21/9] overflow-hidden sm:mx-0 sm:rounded-2xl">
        <Backdrop
          image={image}
          setting={setting}
          priority={step === 0}
          sizes="(min-width: 768px) 720px, 100vw"
        />
        {setting && image && <SettingChip setting={setting} />}
      </div>
      {s.line && <div className="mt-4 flex items-start gap-3">
        <Portrait staging={staging} size="h-10 w-10" />
        <div className="min-w-0 flex-1">
          {speaker(false)}
          <p className="mt-0.5 text-[15px] leading-snug text-fg">{s.line}</p>
        </div>
      </div>}
    </div>
  );
}

const WIDE = "(min-width: 1024px)";
function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
/** True on wide screens, where a lesson sits beside its scene. */
export function useWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}

function SettingChip({ setting }: { setting: string }) {
  return (
    <span className="absolute top-3 left-3 max-w-[85%] truncate rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md sm:top-4 sm:left-4">
      {setting}
    </span>
  );
}

/** The painting, or (without one) a gradient poster naming the place and time. */
function Backdrop({
  image,
  setting,
  priority,
  sizes,
}: {
  image?: string;
  setting?: string;
  priority: boolean;
  sizes: string;
}) {
  if (image) {
    return (
      <Image
        unoptimized={isRemote(image)}
        src={image}
        alt=""
        fill
        sizes={sizes}
        className="scene-pan object-cover"
        priority={priority}
        loading={priority ? undefined : "eager"}
      />
    );
  }
  const [place, time] = (setting ?? "").split(" · ");
  return (
    <div className="scene-placeholder absolute inset-0 flex flex-col justify-start p-5 lg:p-8">
      {place && (
        <>
          <span className="text-[11px] font-semibold tracking-[0.14em] text-white/60 uppercase">
            {time ?? "The scene"}
          </span>
          <span className="mt-1.5 max-w-md text-xl leading-tight font-semibold tracking-[-0.02em] text-white lg:text-[28px]">
            {place}
          </span>
        </>
      )}
    </div>
  );
}

function Portrait({ staging, size }: { staging: Staging; size: string }) {
  return (
    <span
      className={`relative flex-shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-white/80 ${size}`}
    >
      {staging.guide.portrait ? (
        <Image
          unoptimized={isRemote(staging.guide.portrait)}
          src={staging.guide.portrait}
          alt=""
          fill
          sizes="48px"
          loading="eager"
          className="scale-[1.5] object-cover object-[50%_30%]"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#7a5cff] to-[#3aa0e8] text-base font-semibold text-white">
          {staging.guide.name.replace(/^(Dr|Prof)\.?\s+/, "").charAt(0)}
        </span>
      )}
    </span>
  );
}

export type VoiceControl = {
  enabled: boolean;
  toggle: () => void;
  /** Resolves to a playable URL for a step's line (cached by the server). */
  urlFor: (step: number) => Promise<string | null>;
};

/**
 * The one guide line playing on the page. Starting a line stops the last one,
 * so lines never overlap, even when a step changes before its audio loads.
 */
let speaking: HTMLAudioElement | null = null;

function stopSpeaking(only?: HTMLAudioElement | null) {
  if (!speaking || (only !== undefined && speaking !== only)) return;
  speaking.pause();
  speaking = null;
}

/** Plays the step's line when it becomes active (if voice is on); click to replay. */
export function SpeakButton({
  voice,
  step,
  active,
  tone = "dark",
}: {
  voice: VoiceControl;
  step: number;
  active: boolean;
  tone?: "dark" | "light";
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  // Bumped whenever a play is started or cancelled; a URL that arrives for an older one is dropped.
  const request = useRef(0);
  const [playing, setPlaying] = useState(false);

  async function play() {
    const id = ++request.current;
    const url = await voice.urlFor(step);
    if (!url || id !== request.current) return;
    stopSpeaking();
    const a = new Audio(url);
    audio.current = speaking = a;
    a.onplay = () => setPlaying(true);
    a.onended = a.onpause = () => setPlaying(false);
    a.play().catch(() => setPlaying(false));
  }

  useEffect(() => {
    if (active && voice.enabled) {
      play();
      voice.urlFor(step + 1); // warm the next line so it's ready when the learner moves on
    }
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- a counter: the latest value is the point
      request.current++;
      stopSpeaking(audio.current);
      audio.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- play when the step opens or voice turns on
  }, [active, voice.enabled]);

  return (
    <button
      type="button"
      onClick={play}
      aria-label={`Hear ${step === 0 ? "the introduction" : "this line"} again`}
      className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 ${
        tone === "dark"
          ? `text-white/80 hover:bg-white/15 hover:text-white ${playing ? "text-white" : ""}`
          : `text-muted hover:bg-line hover:text-fg ${playing ? "text-accent" : ""}`
      }`}
    >
      {voice.enabled ? (
        <Volume2 size={14} className={playing ? "animate-pulse" : ""} />
      ) : (
        <VolumeX size={14} />
      )}
    </button>
  );
}
