import test from 'node:test';
import assert from 'node:assert/strict';
import { ICON_CHOICES, iconLabel, iconSearchText } from './appearance';

const matches = (term: string) =>
  ICON_CHOICES.filter((icon) => iconSearchText(icon).includes(term));

test('icon names stay readable in the chooser', () => {
  assert.equal(iconLabel('g-translate'), 'G Translate');
  assert.equal(iconLabel('photo-camera'), 'Photo Camera');
});

test('search aliases find the icons their subjects describe', () => {
  assert.ok(matches('math').includes('calculate'));
  assert.ok(matches('math').includes('functions'));
  assert.ok(matches('audio').includes('headphones'));
  assert.ok(matches('audio').includes('mic'));
  assert.ok(matches('art').includes('palette'));
  assert.ok(matches('art').includes('brush'));
  assert.ok(matches('art').includes('draw'));
});
