import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import test from "node:test";

const baseUrl = process.env.PUBLISH_TEST_BASE_URL;
const apiKey = process.env.PUBLISH_API_KEY;
const testSlug = `upsert-smoke-${Date.now()}-${randomBytes(6).toString("hex")}`;
const testFile = path.join(process.cwd(), "content", "posts", `${testSlug}.md`);
const originalBody = "Initial smoke-test body.";
const replacementBody = "Replacement smoke-test body.";
const seededMarkdown = [
  "---",
  'title: "Seeded smoke-test post"',
  'description: "Temporary local API integration test."',
  "date: 2026-09-29",
  "tags: [test]",
  "---",
  "",
  "Seeded original body.",
  "",
].join("\n");

function article(content, overrides = {}) {
  return {
    collection: "posts",
    title: "Upsert smoke test",
    description: "Temporary local API integration test.",
    content,
    tags: ["test"],
    date: "2026-09-29",
    draft: false,
    ...overrides,
  };
}

async function send(method, pathname, body, { authenticated = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authenticated) headers.Authorization = `Bearer ${apiKey}`;
  return fetch(new URL(pathname, baseUrl), {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function ensureSeedFile() {
  try {
    await readFile(testFile, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await mkdir(path.dirname(testFile), { recursive: true });
    await writeFile(testFile, seededMarkdown, { flag: "wx" });
  }
}

test.before(() => {
  assert.ok(baseUrl, "PUBLISH_TEST_BASE_URL must point to the local test server");
  assert.ok(apiKey, "PUBLISH_API_KEY must be set to a test-only key");
});

test.after(async () => {
  await rm(testFile, { force: true });
});

test("PUT creates a new post and returns 201", async () => {
  const response = await send("PUT", `/api/posts/${testSlug}`, article(originalBody));

  assert.equal(response.status, 201);
  const result = await response.json();
  assert.deepEqual(Object.keys(result).sort(), ["collection", "mode", "slug", "url"]);
  assert.equal(result.collection, "posts");
  assert.equal(result.slug, testSlug);
  assert.equal(result.mode, "local");
  assert.equal(await readFile(testFile, "utf8").then((text) => text.includes(originalBody)), true);
});

test("PUT replaces the whole post and returns 200", async () => {
  await ensureSeedFile();
  const response = await send("PUT", `/api/posts/${testSlug}`, article(replacementBody));

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.slug, testSlug);
  const saved = await readFile(testFile, "utf8");
  assert.ok(saved.includes(replacementBody));
  assert.ok(!saved.includes(originalBody));
});

test("POST remains create-only when the slug already exists", async () => {
  await ensureSeedFile();
  const before = await readFile(testFile, "utf8");
  const response = await send("POST", "/api/posts", article("POST must not overwrite", { slug: testSlug }));

  assert.equal(response.status, 409);
  assert.equal(await readFile(testFile, "utf8"), before);
});

test("PUT rejects missing authentication without changing the file", async () => {
  await ensureSeedFile();
  const before = await readFile(testFile, "utf8");
  const response = await send("PUT", `/api/posts/${testSlug}`, article("unauthorized"), { authenticated: false });

  assert.equal(response.status, 401);
  assert.equal(await readFile(testFile, "utf8"), before);
});

test("PUT rejects an invalid URL slug", async () => {
  const response = await send("PUT", "/api/posts/bad%20slug", article("invalid slug"));

  assert.equal(response.status, 422);
});

test("PUT rejects a body slug that differs from the URL slug", async () => {
  await ensureSeedFile();
  const before = await readFile(testFile, "utf8");
  const response = await send("PUT", `/api/posts/${testSlug}`, article("mismatched slug", { slug: "another-entry" }));

  assert.equal(response.status, 422);
  assert.equal(await readFile(testFile, "utf8"), before);
});

test("PUT rejects invalid fields before changing the file", async () => {
  await ensureSeedFile();
  const before = await readFile(testFile, "utf8");
  const response = await send("PUT", `/api/posts/${testSlug}`, article("invalid title", { title: "  " }));

  assert.equal(response.status, 422);
  assert.equal(await readFile(testFile, "utf8"), before);
});
