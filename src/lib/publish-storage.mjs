import { randomUUID } from "node:crypto";
import { lstat, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

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
