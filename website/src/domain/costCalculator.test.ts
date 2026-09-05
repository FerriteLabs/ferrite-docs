import {describe, expect, it} from 'vitest';
import {calculateCostEstimate} from './costCalculator';

describe('calculateCostEstimate', () => {
  it('preserves the documented tier distribution', () => {
    const result = calculateCostEstimate({
      datasetGB: 100,
      hotRatio: 0.2,
      cloud: 'aws',
      replication: 1,
    });

    expect(result.hotGB).toBe(20);
    expect(result.warmGB).toBeCloseTo(24);
    expect(result.coldGB).toBeCloseTo(56);
    expect(result.hotGB + result.warmGB + result.coldGB).toBeCloseTo(100);
  });

  it('calculates the current AWS estimate', () => {
    const result = calculateCostEstimate({
      datasetGB: 100,
      hotRatio: 0.2,
      cloud: 'aws',
      replication: 1,
    });

    expect(result.redisCost).toBeCloseTo(1250);
    expect(result.ferriteCost).toBeCloseTo(253.208);
    expect(result.savings).toBeCloseTo(996.792);
    expect(result.savingsPct).toBeCloseTo(79.74336);
  });

  it('scales storage costs with replication', () => {
    const single = calculateCostEstimate({
      datasetGB: 250,
      hotRatio: 0.4,
      cloud: 'gcp',
      replication: 1,
    });
    const replicated = calculateCostEstimate({
      datasetGB: 250,
      hotRatio: 0.4,
      cloud: 'gcp',
      replication: 3,
    });

    expect(replicated.redisCost).toBeCloseTo(single.redisCost * 3);
    expect(replicated.ferriteCost).toBeCloseTo(single.ferriteCost * 3);
  });

  it('reports zero percentage savings for an empty dataset', () => {
    const result = calculateCostEstimate({
      datasetGB: 0,
      hotRatio: 0.2,
      cloud: 'azure',
      replication: 1,
    });

    expect(result.redisCost).toBe(0);
    expect(result.ferriteCost).toBe(0);
    expect(result.savingsPct).toBe(0);
  });
});
