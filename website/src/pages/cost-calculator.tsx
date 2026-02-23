import React, { useState, useMemo } from 'react';
import Layout from '@theme/Layout';

// Cloud pricing per GB/month (approximate 2026 rates)
const PRICING = {
  aws: { name: 'AWS', memory: 12.50, ssd: 0.08, object: 0.023 },
  gcp: { name: 'GCP', memory: 13.00, ssd: 0.17, object: 0.020 },
  azure: { name: 'Azure', memory: 12.80, ssd: 0.12, object: 0.018 },
};

function CostCalculator() {
  const [datasetGB, setDatasetGB] = useState(100);
  const [hotRatio, setHotRatio] = useState(0.2);
  const [cloud, setCloud] = useState<'aws' | 'gcp' | 'azure'>('aws');
  const [replication, setReplication] = useState(1);

  const result = useMemo(() => {
    const p = PRICING[cloud];
    const hotGB = datasetGB * hotRatio;
    const warmGB = datasetGB * (1 - hotRatio) * 0.3;
    const coldGB = datasetGB * (1 - hotRatio) * 0.7;

    const redisCost = datasetGB * p.memory * replication;
    const ferriteMem = hotGB * p.memory * replication;
    const ferriteSSD = warmGB * p.ssd * replication;
    const ferriteObj = coldGB * p.object * replication;
    const ferriteCost = ferriteMem + ferriteSSD + ferriteObj;
    const savings = redisCost - ferriteCost;
    const savingsPct = redisCost > 0 ? (savings / redisCost) * 100 : 0;

    return {
      redisCost, ferriteCost, savings, savingsPct,
      hotGB, warmGB, coldGB,
      ferriteMem, ferriteSSD, ferriteObj,
      cloudName: p.name,
    };
  }, [datasetGB, hotRatio, cloud, replication]);

  return (
    <Layout title="Cost Calculator" description="Compare Redis vs Ferrite infrastructure costs">
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
        <h1>💰 Tiered Storage Cost Calculator</h1>
        <p>Compare monthly infrastructure costs: Redis (memory-only) vs Ferrite (tiered storage).</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          <label>
            Dataset Size (GB)
            <input type="range" min={1} max={2000} value={datasetGB}
              onChange={(e) => setDatasetGB(Number(e.target.value))}
              style={{ width: '100%' }} />
            <strong>{datasetGB} GB</strong>
          </label>

          <label>
            Hot Data Ratio
            <input type="range" min={5} max={100} value={hotRatio * 100}
              onChange={(e) => setHotRatio(Number(e.target.value) / 100)}
              style={{ width: '100%' }} />
            <strong>{(hotRatio * 100).toFixed(0)}%</strong>
          </label>

          <label>
            Cloud Provider
            <select value={cloud} onChange={(e) => setCloud(e.target.value as any)}
              style={{ width: '100%', padding: '0.5rem' }}>
              <option value="aws">AWS</option>
              <option value="gcp">Google Cloud</option>
              <option value="azure">Azure</option>
            </select>
          </label>

          <label>
            Replication Factor
            <select value={replication} onChange={(e) => setReplication(Number(e.target.value))}
              style={{ width: '100%', padding: '0.5rem' }}>
              <option value={1}>1× (no replication)</option>
              <option value={2}>2× (primary + replica)</option>
              <option value={3}>3× (primary + 2 replicas)</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div style={{ border: '2px solid #e74c3c', borderRadius: 8, padding: '1.5rem' }}>
            <h3 style={{ color: '#e74c3c' }}>Redis (memory-only)</h3>
            <table style={{ width: '100%' }}>
              <tbody>
                <tr><td>Memory</td><td style={{ textAlign: 'right' }}>{datasetGB} GB</td></tr>
                <tr style={{ fontWeight: 'bold', fontSize: '1.2em' }}>
                  <td>Monthly Cost</td>
                  <td style={{ textAlign: 'right', color: '#e74c3c' }}>${result.redisCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ border: '2px solid #27ae60', borderRadius: 8, padding: '1.5rem' }}>
            <h3 style={{ color: '#27ae60' }}>Ferrite (tiered)</h3>
            <table style={{ width: '100%' }}>
              <tbody>
                <tr><td>Hot (memory)</td><td style={{ textAlign: 'right' }}>{result.hotGB.toFixed(0)} GB — ${result.ferriteMem.toFixed(2)}</td></tr>
                <tr><td>Warm (SSD)</td><td style={{ textAlign: 'right' }}>{result.warmGB.toFixed(0)} GB — ${result.ferriteSSD.toFixed(2)}</td></tr>
                <tr><td>Cold (object)</td><td style={{ textAlign: 'right' }}>{result.coldGB.toFixed(0)} GB — ${result.ferriteObj.toFixed(2)}</td></tr>
                <tr style={{ fontWeight: 'bold', fontSize: '1.2em' }}>
                  <td>Monthly Cost</td>
                  <td style={{ textAlign: 'right', color: '#27ae60' }}>${result.ferriteCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{
          marginTop: '2rem', padding: '1.5rem', borderRadius: 8,
          background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
          color: 'white', textAlign: 'center', fontSize: '1.3em'
        }}>
          <strong>Monthly Savings: ${result.savings.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({result.savingsPct.toFixed(1)}%)</strong>
        </div>

        <p style={{ marginTop: '1rem', fontSize: '0.9em', color: '#666' }}>
          Estimates based on on-demand {result.cloudName} pricing. Reserved instances and committed use discounts may further reduce costs.
          Ferrite tier distribution assumes 30% warm / 70% cold for non-hot data.
        </p>
      </main>
    </Layout>
  );
}

export default CostCalculator;
