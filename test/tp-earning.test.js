const test = require('node:test');
const assert = require('node:assert/strict');
const { computeItinerary } = require('../calc.js');

// LIS-YYZ is 3562 miles. ticketNumber "047" (non-AC) keeps TP on the
// star-distance path; eliteStatus omitted keeps the elite-bonus minimum at 0.
function tpBasePoints(fareClass, fareBrand, { orig = 'LIS', dest = 'YYZ', distance = 3562 } = {}) {
  const segments = [{
    airline: 'TP', orig, dest, fareClass, fareBrand: fareBrand || '', distance,
  }];
  const result = computeItinerary(segments, '047', undefined, 1000);
  return result.perSegment[0].basePoints;
}

test('TP earns by brand code parsed from a fare basis', () => {
  assert.equal(tpBasePoints('C', 'C15TOP0A'), 5343);
  assert.equal(tpBasePoints('D', 'D15EXE0A'), 5343);
  assert.equal(tpBasePoints('Y', 'Y15PLU0A'), 3562);
  assert.equal(tpBasePoints('M', 'M15CLC0A'), 3562);
  assert.equal(tpBasePoints('H', 'H15BSC0A'), 1781);
  assert.equal(tpBasePoints('V', 'V15DSC0A'), 0);
});

test('TP earns by brand name entered directly', () => {
  assert.equal(tpBasePoints('C', 'TOP EXECUTIVE'), 5343);
  assert.equal(tpBasePoints('D', 'EXECUTIVE'), 5343);
  assert.equal(tpBasePoints('W', 'TOP PRIME'), 4096);
  assert.equal(tpBasePoints('S', 'PRIME'), 4096);
  assert.equal(tpBasePoints('O', 'PLUS'), 3562);
  assert.equal(tpBasePoints('M', 'CLASSIC'), 3562);
  assert.equal(tpBasePoints('H', 'BASIC'), 1781);
  assert.equal(tpBasePoints('V', 'DISCOUNT'), 0);
});

test('TP reads TOP PRIME as comfort rather than business', () => {
  assert.equal(tpBasePoints('W', 'TOP PRIME'), 4096);
  assert.equal(tpBasePoints('W', 'TOP EXECUTIVE'), 5343);
});

test('TP brand overrides the fare class default', () => {
  assert.equal(tpBasePoints('K', null), 3562);
  assert.equal(tpBasePoints('K', 'BASIC'), 1781);
  assert.equal(tpBasePoints('K', 'DISCOUNT'), 0);
});

test('TP falls back to fare class when the brand is absent or unrecognized', () => {
  assert.equal(tpBasePoints('J', null), 5343);
  assert.equal(tpBasePoints('J', 'RANDOM'), 5343);
  assert.equal(tpBasePoints('W', null), 3562);
  assert.equal(tpBasePoints('O', null), 3562);
});

test('TP earns nothing in classes absent from the table', () => {
  assert.equal(tpBasePoints('G', null), 0);
  assert.equal(tpBasePoints('P', null), 0);
  assert.equal(tpBasePoints('N', null), 0);
});

test('TP no longer special-cases domestic Portugal routes', () => {
  // Previously LIS/OPO/PXO/FNC-to-each-other routes used a separate table
  // (V/W/S/L/K/U/A/G/P at 50%). That branch is gone: domestic and
  // international routes compute identically now.
  const domestic = tpBasePoints('V', null, { orig: 'LIS', dest: 'OPO', distance: 1000 });
  const international = tpBasePoints('V', null, { orig: 'LIS', dest: 'YYZ', distance: 1000 });
  assert.equal(domestic, 1000); // 100%, not the old 50%
  assert.equal(international, 1000);
});
