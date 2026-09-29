import type { Collection } from "./content.js";

export class PublishStorageError extends Error {
  readonly status: number;
  constructor(status: number, message: string);
}

export function writeLocalUpsert(
  filePath: string,
  markdown: string,
): Promise<{ created: boolean }>;

export function commitToGitHubUpsert(args: {
  repoFull: string;
  token: string;
  collection: Collection;
  slug: string;
  markdown: string;
  fetchImpl?: typeof fetch;
}): Promise<{ created: boolean; commitUrl?: string }>;
