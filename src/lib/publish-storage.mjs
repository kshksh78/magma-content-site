import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { lstat, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export class PublishStorageError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "PublishStorageError";
    this.status = status;
  }
}

/**
 * Atomically create or replace a content file using a temporary file in the
 * destination directory. The returned flag reflects whether the target
 * existed before this write began.
 *
 * @param {string} filePath
 * @param {string} markdown
 * @returns {Promise<{ created: boolean }>}
 */
export async function writeLocalUpsert(filePath, markdown) {
  let created;
  try {
    await lstat(filePath);
    created = false;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    created = true;
  }

  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(temporaryPath, markdown, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }

  return { created };
}

/**
 * Create or replace a GitHub Contents API file. Existing files are updated
 * with the SHA returned by the existence check to detect concurrent edits.
 *
 * @param {{ repoFull: string; token: string; collection: "posts" | "reports"; slug: string; markdown: string; fetchImpl?: typeof fetch }} input
 * @returns {Promise<{ created: boolean; commitUrl?: string }>}
 */
export async function commitToGitHubUpsert(input) {
  const { repoFull, token, collection, slug, markdown } = input;
  const request = input.fetchImpl ?? fetch;
  const fileUrl = `https://api.github.com/repos/${repoFull}/contents/content/${collection}/${slug}.md`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  let current;
  try {
    current = await request(fileUrl, { headers, cache: "no-store" });
  } catch {
    throw new PublishStorageError(502, "GitHub 파일 조회에 실패했습니다");
  }

  let created;
  let sha;
  if (current.status === 404) {
    created = true;
  } else if (current.status === 200) {
    created = false;
    let existing;
    try {
      existing = await current.json();
    } catch {
      throw new PublishStorageError(502, "GitHub 조회 응답을 읽지 못했습니다");
    }
    if (typeof existing?.sha !== "string" || !existing.sha) {
      throw new PublishStorageError(502, "GitHub 조회 응답에 파일 SHA가 없습니다");
    }
    sha = existing.sha;
  } else {
    throw new PublishStorageError(502, `GitHub 파일 조회 실패 (HTTP ${current.status})`);
  }

  const payload = {
    message: `${collection}: ${slug} 발행 API upsert`,
    content: Buffer.from(markdown, "utf8").toString("base64"),
    ...(sha ? { sha } : {}),
  };

  let saved;
  try {
    saved = await request(fileUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    throw new PublishStorageError(502, "GitHub 파일 저장 요청에 실패했습니다");
  }

  if (!saved.ok) {
    if (saved.status === 409 || saved.status === 422) {
      throw new PublishStorageError(409, `GitHub 파일 충돌 (HTTP ${saved.status})`);
    }
    throw new PublishStorageError(502, `GitHub 파일 저장 실패 (HTTP ${saved.status})`);
  }

  let result;
  try {
    result = await saved.json();
  } catch {
    throw new PublishStorageError(502, "GitHub 저장 응답을 읽지 못했습니다");
  }

  return {
    created,
    ...(typeof result?.commit?.html_url === "string"
      ? { commitUrl: result.commit.html_url }
      : {}),
  };
}
