import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { writeLocalUpsert } from "../src/lib/publish-storage.mjs";

async function makeTempDir(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "magma-publish-storage-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  return dir;
}

test("creates a new file and reports created=true", async (t) => {
  const dir = await makeTempDir(t);
  const filePath = path.join(dir, "article.md");

  const result = await writeLocalUpsert(filePath, "first version\n");

  assert.deepEqual(result, { created: true });
  assert.equal(await readFile(filePath, "utf8"), "first version\n");
});

test("replaces the complete existing file and reports created=false", async (t) => {
  const dir = await makeTempDir(t);
  const filePath = path.join(dir, "article.md");
  const firstMarkdown = "old title\n\nold body\n";
  const replacementMarkdown = "new title\n\nnew body\n";
  await writeFile(filePath, firstMarkdown);

  const result = await writeLocalUpsert(filePath, replacementMarkdown);

  assert.deepEqual(result, { created: false });
  assert.equal(await readFile(filePath, "utf8"), replacementMarkdown);
});

test("removes its temporary file when the final rename fails", async (t) => {
  const dir = await makeTempDir(t);
  const targetDirectory = path.join(dir, "article.md");
  await mkdir(targetDirectory);

  await assert.rejects(writeLocalUpsert(targetDirectory, "content\n"));

  assert.deepEqual(await readdir(dir), ["article.md"]);
});
