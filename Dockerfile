FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg chromium fonts-noto-color-emoji fonts-liberation && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
ENV HOST=0.0.0.0 SCENESTITCH_DATA_DIR=/data SCENESTITCH_BROWSER_EXECUTABLE=/usr/bin/chromium
EXPOSE 4000
CMD ["pnpm", "start"]
