/**
 * Type definitions of the Node.js entry point.
 */

import type { Config, RunResult } from './index.js';

export * from './index.js';

export interface RunOptions {
  /** Defaults to the current directory. */
  root?: string;
  /** Files or directories; defaults to every file git knows about. */
  paths?: string[];
  /** Write repaired files. */
  fix?: boolean;
  configPath?: string;
}

export declare function checkFiles(options?: RunOptions): Promise<RunResult>;
export declare function listFiles(
  root: string,
  paths: string[],
  config: Config
): Promise<string[]>;
export declare function loadConfig(
  root: string,
  configPath?: string
): Promise<Config>;
