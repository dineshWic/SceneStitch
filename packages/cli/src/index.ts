#!/usr/bin/env node
import { CORE_VERSION, ProjectSchema } from '@scenestitch/core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderProject } from '@scenestitch/server/render';

export const CLI_VERSION = '0.1.0';
export const DEPENDS_ON_CORE = CORE_VERSION;

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  if (args[0] !== 'render' || !args[1]) {
    console.log('Usage: scenestitch render <project-dir> [--draft|--final] [--output <file.mp4>]');
    return;
  }
  const directory = path.resolve(args[1]);
  const project = ProjectSchema.parse(
    JSON.parse(await fs.readFile(path.join(directory, 'project.json'), 'utf8')),
  );
  const outputFlag = args.indexOf('--output');
  const output =
    outputFlag >= 0 && args[outputFlag + 1]
      ? path.resolve(args[outputFlag + 1]!)
      : path.join(directory, 'exports', `export-${Date.now()}.mp4`);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  try {
    const result = await renderProject(project, directory, output, {
      draft: args.includes('--draft'),
      signal: controller.signal,
      onProgress: (progress, message) => console.log(`${Math.round(progress * 100)}% ${message}`),
    });
    console.log(JSON.stringify({ output, verification: result }, null, 2));
  } finally {
    process.removeListener('SIGINT', cancel);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCli().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  });
}
