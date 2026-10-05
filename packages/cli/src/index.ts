import { CORE_VERSION } from '@scenestitch/core';

export const CLI_VERSION = '0.1.0';
export const DEPENDS_ON_CORE = CORE_VERSION;

export function runCli(): void {
  console.log(`SceneStitch CLI v${CLI_VERSION}`);
}
