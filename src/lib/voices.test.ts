import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { castKey, castVoice, isGuide, readCast, registerOf, REGISTERS, type Cast } from "./voices";

describe("castVoice", () => {
  it("keeps a character's voice in every lesson of the course", () => {
    const first = castVoice({}, { name: "Marcus Aurelius", voice: "cedar" }, 12);
    const again = castVoice(first.cast, { name: " marcus  aurelius", voice: "verse" }, 12);
    assert.equal(again.voice, first.voice);
    assert.equal(again.cast, first.cast, "nothing new to save");
  });

  it("gives different characters different voices of the kind asked for", () => {
    let cast: Cast = {};
    const voices = ["George Washington", "John Quincy Adams", "Frederick Douglass"].map((name) => {
      const r = castVoice(cast, { name, voice: "cedar" }, 7);
      cast = r.cast;
      return r.voice;
    });
    assert.equal(new Set(voices).size, 3);
    for (const v of voices) assert.equal(registerOf(v), "deep");
  });

  it("varies the first pick between courses", () => {
    const picks = new Set(Array.from({ length: 30 }, (_, course) => castVoice({}, { name: "Seneca", voice: "cedar" }, course).voice));
    assert.ok(picks.size > 1);
  });

  it("shares a voice once every voice of that kind is taken, without changing anyone", () => {
    let cast: Cast = {};
    for (const name of ["A", "B", "C", "D"]) cast = castVoice(cast, { name, register: "bright" }, 3).cast;
    assert.equal(Object.keys(cast).length, 4);
    for (const m of Object.values(cast)) assert.ok((REGISTERS.bright as readonly string[]).includes(m.voice));
  });

  it("remembers a portrait painted after the character was cast", () => {
    const { cast } = castVoice({}, { name: "Dr. Ada Reyes", voice: "marin" }, 1);
    const later = castVoice(cast, { name: "Dr. Ada Reyes", portrait: "https://x/p.webp" }, 1);
    assert.equal(later.cast[castKey("Dr. Ada Reyes")].portrait, "https://x/p.webp");
  });
});

describe("isGuide", () => {
  it("matches the guide by name, surname or title", () => {
    assert.ok(isGuide("Socrates", "Socrates"));
    assert.ok(isGuide("Dr. Reyes", "Dr. Ada Reyes"));
    assert.ok(isGuide("Seneca", "Seneca the Younger"));
    assert.ok(isGuide("Guide", "Marie Curie"));
    assert.ok(!isGuide("Glaucon", "Socrates"));
    assert.ok(!isGuide("Ada Smith", "Dr. Ada Reyes"));
  });
});

describe("readCast", () => {
  it("keeps only well-formed members", () => {
    const cast = readCast({ a: { name: "A", voice: "sage" }, b: { name: "B", voice: "not-a-voice" }, c: "nope", d: { voice: "ash" } });
    assert.deepEqual(Object.keys(cast), ["a"]);
    assert.deepEqual(readCast(null), {});
    assert.deepEqual(readCast([1, 2]), {});
  });
});
