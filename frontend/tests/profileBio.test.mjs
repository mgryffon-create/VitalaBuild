import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source = await readFile(new URL('../src/lib/profileBio.js', import.meta.url), 'utf8');
const { buildProfileBio } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('empty answers do not invent experience or qualifications', () => {
  assert.equal(buildProfileBio({}), '');
  const result = buildProfileBio({ years_experience: 0 }, {}, 'CNA');
  assert.equal(result, 'My role is CNA.');
  assert.ok(!result.includes('experienced'));
});
test('only selected role, skills and explicit answers appear', () => {
  const result = buildProfileBio({ years_experience: 2, skills: ['Wound care', { name: 'Epic' }], specialty: 'Long-term care' }, { settings: 'skilled nursing', goal: 'local PRN shifts', approach: 'clear communication' }, 'Registered nurse');
  assert.ok(result.includes('2 years of experience'));
  assert.ok(result.includes('Wound care, Epic'));
  assert.ok(result.includes('local PRN shifts'));
  assert.ok(!result.includes('licensed') && !result.includes('certified'));
});
test('existing bio is never mutated by drafting', () => {
  const profile = { bio: 'Keep my original bio', years_experience: 1 };
  buildProfileBio(profile, { goal: 'day shifts.' }, 'LPN');
  assert.equal(profile.bio, 'Keep my original bio');
  assert.equal(buildProfileBio(profile, {}, 'LPN'), 'My role is LPN with 1 year of experience.');
});
