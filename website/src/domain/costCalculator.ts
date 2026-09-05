export type CloudProvider = 'aws' | 'gcp' | 'azure';

type CloudPricing = {
  name: string;
  memory: number;
  ssd: number;
  object: number;
};

export const CLOUD_PRICING: Record<CloudProvider, CloudPricing> = {
  aws: {name: 'AWS', memory: 12.5, ssd: 0.08, object: 0.023},
  gcp: {name: 'GCP', memory: 13, ssd: 0.17, object: 0.02},
  azure: {name: 'Azure', memory: 12.8, ssd: 0.12, object: 0.018},
};

export type CostEstimateInput = {
  datasetGB: number;
  hotRatio: number;
  cloud: CloudProvider;
  replication: number;
};

export function calculateCostEstimate({
  datasetGB,
  hotRatio,
  cloud,
  replication,
}: CostEstimateInput) {
  const pricing = CLOUD_PRICING[cloud];
  const hotGB = datasetGB * hotRatio;
  const warmGB = datasetGB * (1 - hotRatio) * 0.3;
  const coldGB = datasetGB * (1 - hotRatio) * 0.7;

  const redisCost = datasetGB * pricing.memory * replication;
  const ferriteMem = hotGB * pricing.memory * replication;
  const ferriteSSD = warmGB * pricing.ssd * replication;
  const ferriteObj = coldGB * pricing.object * replication;
  const ferriteCost = ferriteMem + ferriteSSD + ferriteObj;
  const savings = redisCost - ferriteCost;
  const savingsPct = redisCost > 0 ? (savings / redisCost) * 100 : 0;

  return {
    redisCost,
    ferriteCost,
    savings,
    savingsPct,
    hotGB,
    warmGB,
    coldGB,
    ferriteMem,
    ferriteSSD,
    ferriteObj,
    cloudName: pricing.name,
  };
}
