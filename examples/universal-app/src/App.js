import { createElement as h, useMemo, useState } from 'react';
// The text checks only: src/index.js also exports the Node configuration
// loader, which a browser bundle does not need.
import { createLocator, fixText, scanText } from '../../../src/text-rules.js';
import { escapeInvisible } from '../../../src/payload.js';

const repositoryUrl =
  import.meta.env.VITE_REPOSITORY_URL ??
  'https://github.com/link-foundation/watermarks-remover';

/** Text with hidden characters, written with escapes so the source is ASCII. */
const SAMPLE = [
  'The report\u{200B} is ready\u{00A0}for review.',
  'Pay at https://\u{0440}\u{0430}ypal.com today \u{E200}cite\u{E202}turn0search1\u{E201}',
  'Our\u{E0054}\u{E0045}\u{E0058}\u{E0054} plan is final\u{2028}and approved.   ',
].join('\n');

const ciSteps = [
  {
    label: 'Check',
    detail: 'npx @link-foundation/watermarks-remover',
  },
  {
    label: 'Fix',
    detail: 'npx @link-foundation/watermarks-remover --fix',
  },
  {
    label: 'Configure',
    detail: 'npx @link-foundation/watermarks-remover --init',
  },
];

function Finding({ line, column, rule, message }) {
  return h(
    'li',
    null,
    h('span', null, `${line}:${column} ${rule}`),
    h('small', null, escapeInvisible(message))
  );
}

function ResultTile({ label, value, tone }) {
  return h(
    'div',
    { className: `result-tile result-tile-${tone}` },
    h('span', { className: 'result-label' }, label),
    h('strong', null, String(value))
  );
}

function CiStep({ label, detail }) {
  return h('li', null, h('span', null, label), h('code', null, detail));
}

export function App() {
  const [text, setText] = useState(SAMPLE);
  const findings = useMemo(() => {
    const locate = createLocator(text);
    return scanText(text).map((edit) => ({ ...edit, ...locate(edit.index) }));
  }, [text]);
  const cleaned = useMemo(() => fixText(text), [text]);
  const removed = [...text].length - [...cleaned].length;

  return h(
    'main',
    { className: 'app-shell' },
    h(
      'section',
      { className: 'workspace', 'aria-labelledby': 'app-title' },
      h(
        'div',
        { className: 'main-panel' },
        h('p', { className: 'eyebrow' }, 'Hidden characters and watermarks'),
        h('h1', { id: 'app-title' }, 'Watermarks Remover'),
        h(
          'div',
          { className: 'input-grid' },
          h(
            'label',
            { className: 'text-field', htmlFor: 'input-text' },
            h('span', null, 'Paste text'),
            h('textarea', {
              id: 'input-text',
              value: text,
              spellCheck: false,
              onChange: (event) => setText(event.target.value),
            })
          ),
          h(
            'label',
            { className: 'text-field', htmlFor: 'clean-text' },
            h('span', null, 'Clean text'),
            h('textarea', {
              id: 'clean-text',
              value: cleaned,
              readOnly: true,
              spellCheck: false,
            })
          )
        ),
        h(
          'div',
          { className: 'results-grid', 'aria-live': 'polite' },
          h(ResultTile, {
            label: 'Problems',
            value: findings.length,
            tone: findings.length > 0 ? 'red' : 'green',
          }),
          h(ResultTile, {
            label: 'Characters removed',
            value: removed,
            tone: 'blue',
          })
        ),
        h(
          'ul',
          { className: 'finding-list', 'aria-label': 'Problems found' },
          findings.map((finding) =>
            h(Finding, { key: `${finding.index}-${finding.rule}`, ...finding })
          )
        )
      ),
      h(
        'aside',
        { className: 'distribution-panel', 'aria-labelledby': 'ci-title' },
        h('h2', { id: 'ci-title' }, 'Run it in CI'),
        h(
          'p',
          null,
          'The same checks run on every file of a repository and fail the build until --fix is run.'
        ),
        h(
          'ul',
          { className: 'target-list' },
          ciSteps.map((step) => h(CiStep, { key: step.label, ...step }))
        ),
        h(
          'a',
          {
            className: 'download-link',
            href: repositoryUrl,
            target: '_blank',
            rel: 'noreferrer',
          },
          'Open the repository'
        )
      )
    )
  );
}
