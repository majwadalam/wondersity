import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { findBook, findImage, youtubeId } from "./enrichment";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Answers each request with the first canned response whose key the URL contains. */
function stubFetch(responses: [string, unknown][]) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = decodeURIComponent(String(input)).replace(/\+/g, " ");
    const hit = responses.find(([key]) => url.includes(key));
    return new Response(JSON.stringify(hit ? hit[1] : {}), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

describe("youtubeId", () => {
  it("reads watch, short, embed and youtu.be links, and rejects other sites", () => {
    assert.equal(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), "dQw4w9WgXcQ");
    assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(youtubeId("https://m.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(youtubeId("https://vimeo.com/123"), null);
    assert.equal(youtubeId("not a url"), null);
  });
});

describe("findBook", () => {
  const docs = {
    docs: [
      { key: "/works/OL1W", title: "Citizens", author_name: ["Simon Schama"], first_publish_year: 1989, cover_i: 42 },
      { key: "/works/OL2W", title: "Citizens", author_name: ["Someone Else"], first_publish_year: 2001 },
    ],
  };

  it("finds a book by its main title and the author's surname", async () => {
    stubFetch([["openlibrary.org/search.json", docs]]);
    assert.deepEqual(await findBook("Citizens: A Chronicle of the French Revolution", "Simon Schama"), {
      title: "Citizens",
      author: "Simon Schama",
      year: 1989,
      url: "https://openlibrary.org/works/OL1W",
      cover: "https://covers.openlibrary.org/b/id/42-M.jpg",
    });
  });

  it("drops a book whose author doesn't match, or that isn't there", async () => {
    stubFetch([["openlibrary.org/search.json", docs]]);
    assert.equal(await findBook("Citizens", "Jean Dupont"), null);
    stubFetch([["openlibrary.org/search.json", { docs: [] }]]);
    assert.equal(await findBook("The Secret Diaries of Robespierre's Cat", "Jean Dupont"), null);
  });
});

describe("findImage", () => {
  const info = (license: string) => ({
    query: {
      pages: {
        "-1": {
          imageinfo: [
            {
              thumburl: "https://upload.wikimedia.org/thumb/bastille.jpg?utm_source=x",
              descriptionurl: "https://commons.wikimedia.org/wiki/File:Bastille.jpg",
              extmetadata: {
                LicenseShortName: { value: license },
                Artist: { value: '<a href="/wiki/x">Jean-Pierre Houël</a>' },
                ObjectName: { value: 'Prise de la Bastille label QS:Lfr,"Prise"' },
              },
            },
          ],
        },
      },
    },
  });
  const search = {
    query: {
      pages: {
        "1": { index: 1, title: "Julius Caesar (painting)", pageimage: "Caesar.jpg" },
        "2": { index: 2, title: "Storming of the Bastille", pageimage: "Bastille.jpg" },
      },
    },
  };

  it("takes the image of the article that matches the subject, with its licence and author", async () => {
    stubFetch([
      ["gsrsearch", search],
      ["File:Bastille.jpg", info("Public domain")],
    ]);
    assert.deepEqual(await findImage("Storming of the Bastille painting"), {
      title: "Prise de la Bastille",
      thumb: "https://upload.wikimedia.org/thumb/bastille.jpg",
      url: "https://commons.wikimedia.org/wiki/File:Bastille.jpg",
      license: "Public domain",
      credit: "Jean-Pierre Houël",
    });
  });

  it("skips images with no stated licence", async () => {
    stubFetch([
      ["gsrsearch", search],
      ["File:Bastille.jpg", info("")],
    ]);
    assert.equal(await findImage("Storming of the Bastille"), null);
  });
});
