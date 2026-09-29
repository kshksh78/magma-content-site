import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { commitToGitHubUpsert, writeLocalUpsert } from "../src/lib/publish-storage.mjs";

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

function response(status, body = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const githubInput = {
  repoFull: "owner/repo",
  token: "test-token",
  collection: "posts",
  slug: "sample-entry",
  markdown: "---\ntitle: Sample\n---\n\nBody\n",
};

test("creates a GitHub file without a SHA when the path does not exist", async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    if (requests.length === 1) return response(404);
    return response(201, { commit: { html_url: "https://github.com/owner/repo/commit/abc" } });
  };

  const result = await commitToGitHubUpsert({ ...githubInput, fetchImpl });

  assert.equal(result.created, true);
  assert.equal(result.commitUrl, "https://github.com/owner/repo/commit/abc");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "https://api.github.com/repos/owner/repo/contents/content/posts/sample-entry.md");
  assert.equal(requests[1].init.method, "PUT");
  assert.equal(JSON.parse(requests[1].init.body).sha, undefined);
});

test("updates a GitHub file using the SHA returned by the existence check", async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    if (requests.length === 1) return response(200, { sha: "old-content-sha" });
    return response(200, { commit: { html_url: "https://github.com/owner/repo/commit/def" } });
  };

  const result = await commitToGitHubUpsert({ ...githubInput, fetchImpl });

  assert.equal(result.created, false);
  assert.equal(result.commitUrl, "https://github.com/owner/repo/commit/def");
  assert.equal(JSON.parse(requests[1].init.body).sha, "old-content-sha");
});

test("does not write to GitHub when the existence check returns an unexpected status", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return response(500);
  };

  await assert.rejects(
    commitToGitHubUpsert({ ...githubInput, fetchImpl }),
    (error) => error.status === 502,
  );

  assert.equal(calls, 1);
});

test("does not write to GitHub when the existence check has a network failure", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new Error("network unavailable");
  };

  await assert.rejects(
    commitToGitHubUpsert({ ...githubInput, fetchImpl }),
    (error) => error.status === 502,
  );

  assert.equal(calls, 1);
});

for (const conflictStatus of [409, 422]) {
  test(`maps GitHub PUT ${conflictStatus} to a conflict without retrying`, async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return calls === 1 ? response(404) : response(conflictStatus, { message: "conflict" });
    };

    await assert.rejects(
      commitToGitHubUpsert({ ...githubInput, fetchImpl }),
      (error) => error.status === 409,
    );

    assert.equal(calls, 2);
  });
}
