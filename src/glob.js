/**
 * Glob patterns for `files` and `overrides`, with the gitignore meaning:
 *
 * - `*` matches within one path segment, `**` across segments, `?` one
 *   character, `[abc]` a class and `{js,mjs}` alternatives;
 * - a pattern without a slash matches the name at any depth (`*.md`);
 * - a pattern with a slash is anchored at the repository root;
 * - a pattern matching a directory matches everything inside it.
 */

const CACHE = new Map();

/**
 * @param {string} pattern
 * @returns {string} the body of a regular expression
 */
function translate(pattern) {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '*' && pattern[index + 1] === '*') {
      const slash = pattern[index + 2] === '/';
      source += slash ? '(?:.*/)?' : '.*';
      index += slash ? 2 : 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else if (char === '[') {
      const end = pattern.indexOf(']', index + 2);
      if (end === -1) {
        source += '\\[';
      } else {
        const body = pattern.slice(index + 1, end).replace(/^!/, '^');
        source += `[${body.replace(/\\/g, '\\\\')}]`;
        index = end;
      }
    } else if (char === '{') {
      const end = pattern.indexOf('}', index);
      if (end === -1) {
        source += '\\{';
      } else {
        const options = pattern.slice(index + 1, end).split(',');
        source += `(?:${options.map(translate).join('|')})`;
        index = end;
      }
    } else {
      source += char.replace(/[.+^$()|\\]/g, '\\$&');
    }
  }
  return source;
}

/**
 * Drops a leading `./` and any trailing slashes. A loop keeps this linear
 * for patterns with long runs of slashes.
 *
 * @param {string} pattern
 * @returns {string}
 */
function trimPattern(pattern) {
  let end = pattern.length;
  while (end > 0 && pattern[end - 1] === '/') {
    end -= 1;
  }
  return pattern.slice(pattern.startsWith('./') ? 2 : 0, end);
}

/**
 * @param {string} pattern
 * @returns {RegExp}
 */
function compile(pattern) {
  if (!CACHE.has(pattern)) {
    const trimmed = trimPattern(pattern);
    const anchored = trimmed.includes('/');
    const body = translate(trimmed.replace(/^\//, ''));
    const prefix = anchored ? '^' : '^(?:.*/)?';
    CACHE.set(pattern, new RegExp(`${prefix}${body}(?:/.*)?$`, 'u'));
  }
  return CACHE.get(pattern);
}

/**
 * @param {string} path relative, with forward slashes
 * @param {string} pattern
 * @returns {boolean}
 */
export const matchesGlob = (path, pattern) => compile(pattern).test(path);
