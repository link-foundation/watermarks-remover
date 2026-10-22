// Shows how links-notation parses the configuration file format.
import { Parser } from 'links-notation';

const doc = `encoding: utf-8
bom: remove
line-endings: lf
allowed-scripts: Latin Cyrillic Greek
combining-mark-limit: 6
files
  include
    '**/*'
  exclude
    'vendor/**'
    'tests/fixtures/**'
rules
  typographic-punctuation: warn
  escaped-character: off
overrides
  '**/*.md'
    markdown: true
  '**/*.bat'
    line-endings: crlf
    encoding: keep
`;
const show = (group, depth = 0) => {
  const element = group.element ?? group;
  console.log(
    ' '.repeat(depth * 2),
    JSON.stringify({
      id: element.id,
      values: element.values?.map((v) => v.id ?? v),
    })
  );
  for (const child of group.children ?? []) {
    show(child, depth + 1);
  }
};
for (const group of new Parser().parseGroups(doc)) {
  show(group);
}
