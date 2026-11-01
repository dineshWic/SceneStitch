import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Project } from '@scenestitch/core';

/** Serve only the declared working assets; do not copy originals or previous exports into a bundle. */
export async function serveRenderAssets(project: Project, directory: string) {
  const files = new Map<string, string>();
  const root = path.resolve(directory);
  const token = randomUUID();
  for (const [i, asset] of project.assets.entries()) {
    const absolute = path.resolve(root, asset.path);
    if (!absolute.startsWith(root + path.sep))
      throw new Error(`Asset path is outside project: ${asset.name ?? asset.id}`);
    files.set(`/${token}/${i}`, absolute);
  }
  const server = createServer(async (req, res) => {
    const file = files.get(req.url ?? '');
    const stat = file ? await fs.stat(file).catch(() => null) : null;
    if (!file || !stat?.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    const mime: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };
    res.setHeader(
      'Content-Type',
      mime[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    );
    let start = 0;
    let end = stat.size - 1;
    if (req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (!match) {
        res.writeHead(416).end();
        return;
      }
      start = Number(match[1]);
      end = match[2] ? Math.min(end, Number(match[2])) : end;
      if (start > end || start >= stat.size) {
        res.writeHead(416).end();
        return;
      }
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    }
    res.setHeader('Content-Length', end - start + 1);
    const stream = createReadStream(file, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unable to serve render media');
  return {
    project: {
      ...project,
      assets: project.assets.map((a, i) => ({
        ...a,
        path: `http://127.0.0.1:${address.port}/${token}/${i}`,
      })),
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
