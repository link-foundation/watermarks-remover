// Checks which legacy encodings and regex features the current runtime supports.
for (const label of [
  'windows-1252',
  'iso-8859-1',
  'utf-16le',
  'utf-16be',
  'shift_jis',
  'koi8-r',
]) {
  try {
    const text = new TextDecoder(label).decode(Uint8Array.of(0x80, 0xe9, 0x41));
    console.log(label, JSON.stringify(text));
  } catch (error) {
    console.log(label, 'unsupported', error.message);
  }
}
console.log(
  'Cn',
  /\p{Cn}/u.test('\u{E0080}'),
  'DI',
  /\p{Default_Ignorable_Code_Point}/u.test('\u{2065}')
);
console.log('script', /\p{Script=Cyrillic}/u.test('\u{430}'));
