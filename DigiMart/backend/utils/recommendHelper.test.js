import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateFeatures,
  calculateDescriptionSimilarity,
  calculateFeatureMatchScore,
  calculateTraditionalSimilarity,
  extractFeatures,
} from './recommendHelper.js';

test('extractFeatures parses colon-delimited specifications', () => {
  assert.deepEqual(
    extractFeatures('RAM: 8 GB, Storage: 256 GB; Color: Blue'),
    { ram: '8 gb', storage: '256 gb', color: 'blue' }
  );
});

test('aggregateFeatures retains unique values for each attribute', () => {
  assert.deepEqual(
    aggregateFeatures([{ ram: '8 gb', color: 'blue' }, { ram: '16 gb' }]),
    { ram: '8 gb, 16 gb', color: 'blue' }
  );
});

test('feature matching distinguishes exact, partial, and absent values', () => {
  assert.equal(calculateFeatureMatchScore('8 gb', '8 gb, 16 gb'), 1);
  assert.equal(calculateFeatureMatchScore('blue', 'dark blue, black'), 0.5);
  assert.equal(calculateFeatureMatchScore('red', 'blue, black'), 0);
});

test('traditional similarity follows the declared component weights', () => {
  const result = calculateTraditionalSimilarity(
    { category: 'Laptop', brand: 'Dell', price: 1000, rating: 4.5 },
    {
      categories: ['Laptop'],
      brands: ['Dell'],
      avgPrice: 1000,
      avgRating: 4.5,
    }
  );
  assert.ok(Math.abs(result.score - 1) < Number.EPSILON * 2);
});

test('description similarity averages comparable feature matches', () => {
  const result = calculateDescriptionSimilarity(
    { ram: '8 gb', color: 'blue', storage: '1 tb' },
    { ram: '8 gb, 16 gb', color: 'dark blue' }
  );
  assert.equal(result.score, 0.75);
  assert.equal(result.matches.length, 2);
});
