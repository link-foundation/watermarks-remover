/**
 * Type definitions of the browser-safe entry point.
 */

export type Severity = 'error' | 'warn' | 'off';

export interface RuleInfo {
  id: string;
  /** Default severity. */
  severity: Severity;
  fixable: boolean;
  summary: string;
}

export declare const RULES: RuleInfo[];
export declare const RULE_IDS: string[];
export declare const SEVERITIES: Severity[];
export declare function defaultSeverities(): Record<string, Severity>;
export declare function getRule(id: string): RuleInfo | undefined;

export interface TextOptions {
  /** Defaults to the default severity of every rule. */
  severities?: Record<string, Severity>;
  /** Script names such as `Latin`; null allows every script. */
  allowedScripts?: string[] | null;
  lineEndings?: 'lf' | 'crlf' | 'keep';
  combiningMarkLimit?: number;
  /** Keep two-space hard line breaks. */
  markdown?: boolean;
}

/** One problem in a text, as UTF-16 offsets into the scanned string. */
export interface Edit {
  index: number;
  length: number;
  rule: string;
  message: string;
  /** What `fixText` writes in place of the range; null when not fixable. */
  replacement: string | null;
  /** A whole-text repair, used by rules such as line-endings. */
  fix?: (text: string) => string;
}

export declare function scanText(text: string, options?: TextOptions): Edit[];
export declare function fixText(text: string, options?: TextOptions): string;
export declare function createLocator(
  text: string
): (index: number) => { line: number; column: number };

export interface Settings {
  encoding: 'utf-8' | 'keep';
  fallbackEncoding: string;
  bom: 'remove' | 'require' | 'keep';
  lineEndings: 'lf' | 'crlf' | 'keep';
  allowedScripts: string[] | null;
  combiningMarkLimit: number;
  markdownHardBreaks: boolean;
  /** Larger files are skipped, in bytes. */
  maxFileSize: number;
  rules: Record<string, Severity>;
}

export interface Override {
  patterns: string[];
  settings: Partial<Settings>;
}

export interface Config extends Settings {
  include: string[];
  exclude: string[];
  overrides: Override[];
}

export declare const CONFIG_FILE: string;
export declare const STARTER_CONFIG: string;
export declare class ConfigError extends Error {}
export declare function defaultConfig(): Config;
/** Parses a `.watermarks-remover.lino` file written in Links Notation. */
export declare function parseConfig(source: string): Config;
export declare function settingsFor(config: Config, path: string): Settings;
export declare function isIncluded(config: Config, path: string): boolean;
export declare function matchesGlob(path: string, pattern: string): boolean;

export interface Finding {
  path: string;
  /** 1-based, 0 when the finding is about the whole file. */
  line: number;
  /** 1-based in code points, 0 for the whole file. */
  column: number;
  rule: string;
  severity: Severity;
  message: string;
  fixable: boolean;
}

export interface FileResult {
  path: string;
  kind: 'text' | 'image' | 'binary' | 'too-large';
  encoding?: string;
  findings: Finding[];
  /** New contents, null when nothing changed. */
  fixed: Uint8Array | null;
}

export declare function checkFile(
  path: string,
  bytes: Uint8Array,
  settings: Settings,
  options?: { fix?: boolean }
): FileResult;
export declare function textOptions(
  path: string,
  settings: Settings
): TextOptions;

export interface Decoded {
  binary: boolean;
  text?: string;
  encoding?: string;
  bom?: boolean;
}

export declare function decode(
  bytes: Uint8Array,
  options?: { fallbackEncoding?: string }
): Decoded;
export declare function encode(
  text: string,
  target: { encoding: string; bom: boolean }
): Uint8Array;
export declare function normalizeEncoding(label: string): string | null;

export interface ImageResult {
  format: string;
  /** Names of the removed metadata blocks. */
  removed: string[];
  bytes: Uint8Array;
}

export declare function stripImageMetadata(
  bytes: Uint8Array
): ImageResult | null;

/** Writes invisible and default-ignorable characters as `\u{...}`. */
export declare function escapeInvisible(text: string): string;

export interface CheckedFile extends FileResult {
  /** Findings before `--fix` rewrote the file. */
  before?: Finding[];
}

export interface RunResult {
  files: CheckedFile[];
  /** Paths of the rewritten files. */
  fixed: string[];
}

export interface ReportContext {
  name: string;
  version: string;
  fixCommand: string;
}

export interface Summary {
  files: number;
  errors: number;
  warnings: number;
  fixable: number;
  fixed: number;
  fixedFiles: number;
}

export declare const FORMATS: Array<'text' | 'github' | 'json' | 'sarif'>;
export declare function summarize(result: RunResult): Summary;
export declare function formatReport(
  result: RunResult,
  format: 'text' | 'github' | 'json' | 'sarif',
  context: ReportContext
): string;
export declare function formatStepSummary(
  result: RunResult,
  context: ReportContext
): string;
