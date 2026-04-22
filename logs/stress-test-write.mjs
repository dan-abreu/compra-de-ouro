const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const masterKey = process.env.MASTER_KEY ?? 'master-dev-key-change-in-prod';
const concurrency = Number(process.env.CONCURRENCY ?? 12);
const durationSec = Number(process.env.DURATION_SEC ?? 20);

import { execSync } from 'node:child_process';

const nowMs = () => Number(process.hrtime.bigint() / 1000000n);

const req = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const started = nowMs();
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined
    });
    const elapsed = nowMs() - started;
    let data = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, elapsed, data };
  } catch (error) {
    return { ok: false, status: 0, elapsed: nowMs() - started, error: String(error) };
  }
};

const summarize = (arr) => {
  if (arr.length === 0) return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const pick = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length) - 1))] ?? 0;
  const sum = sorted.reduce((acc, n) => acc + n, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Number((sum / sorted.length).toFixed(2)),
    p50: pick(50),
    p95: pick(95),
    p99: pick(99)
  };
};

const today = new Date().toISOString().slice(0, 10);

(async () => {
  console.log('=== WRITE STRESS TEST START ===');
  console.log(`Target: ${base}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Duration: ${durationSec}s`);

  const health = await req('/health');
  if (!health.ok) {
    console.log(`FAIL health check status=${health.status}`);
    process.exit(1);
  }

  const stamp = Date.now();
  const adminEmail = `stresswrite${stamp}@test.local`;
  const adminPassword = 'StressWritePass123!';

  const provision = await req('/api/master/provision', {
    method: 'POST',
    headers: { 'X-Master-Key': masterKey },
    body: {
      companyName: `Stress Write Tenant ${stamp}`,
      adminName: 'Stress Write Admin',
      adminEmail,
      adminPassword
    }
  });

  if (!provision.ok || !provision.data?.tenant?.id) {
    console.log(`FAIL tenant provision status=${provision.status}`);
    console.log(JSON.stringify(provision.data ?? {}, null, 2));
    process.exit(1);
  }

  const tenantId = provision.data.tenant.id;
  const tenantDbUrl = provision.data.tenant.databaseUrl;

  if (!tenantDbUrl) {
    console.log('FAIL tenant db url missing for runtime seed');
    process.exit(1);
  }

  // Seed runtime balances/rates so write operations start from a valid business baseline.
  execSync(`npx tsx src/scripts/seed-tenant-runtime-data.ts "${tenantDbUrl}" "${adminEmail}"`, { stdio: 'pipe' });

  const login = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'X-Tenant-ID': tenantId },
    body: { email: adminEmail, password: adminPassword }
  });

  if (!login.ok || !login.data?.accessToken) {
    console.log(`FAIL login status=${login.status}`);
    process.exit(1);
  }

  const authHeaders = {
    'X-Tenant-ID': tenantId,
    Authorization: `Bearer ${login.data.accessToken}`
  };

  const supplierRes = await req('/api/suppliers', {
    method: 'POST',
    headers: authHeaders,
    body: {
      companyName: 'Supplier Stress Write Base',
      documentId: `S-SW-${stamp}`,
      contactName: 'Load Test',
      phone: '5550000',
      address: 'Rua Stress'
    }
  });

  const supplierId = supplierRes.data?.id;
  if (!supplierRes.ok || !supplierId) {
    console.log(`FAIL baseline supplier status=${supplierRes.status}`);
    process.exit(1);
  }

  // Seed open gold so sale operations have inventory during the test.
  const seedPurchase = await req('/api/orders/purchase', {
    method: 'POST',
    headers: authHeaders,
    body: {
      isWalkIn: true,
      goldState: 'BURNED',
      physicalWeight: '1000.0000',
      purityPercentage: '95.0000',
      negotiatedPricePerGram: '1.0000',
      totalOrderValueUsd: '1000.0000',
      paymentSplits: [{ currency: 'USD', amount: '1000.0000' }]
    }
  });

  if (!seedPurchase.ok) {
    console.log(`FAIL seed purchase status=${seedPurchase.status}`);
    console.log(JSON.stringify(seedPurchase.data ?? {}, null, 2));
    process.exit(1);
  }

  let seq = 0;

  const ops = [
    {
      name: 'purchase',
      weight: 35,
      run: async () => {
        const result = await req('/api/orders/purchase', {
          method: 'POST',
          headers: authHeaders,
          body: {
            isWalkIn: true,
            goldState: 'BURNED',
            physicalWeight: '0.0500',
            purityPercentage: '95.0000',
            negotiatedPricePerGram: '70.0000',
            totalOrderValueUsd: '3.5000',
            paymentSplits: [{ currency: 'USD', amount: '3.5000' }]
          }
        });
        return result;
      }
    },
    {
      name: 'sale',
      weight: 25,
      run: async () => {
        const result = await req('/api/orders/sale', {
          method: 'POST',
          headers: authHeaders,
          body: {
            supplierId,
            isWalkIn: false,
            goldState: 'MELTED',
            physicalWeight: '0.0200',
            purityPercentage: '99.0000',
            negotiatedPricePerGram: '80.0000',
            totalOrderValueUsd: '1.6000',
            paymentSplits: [{ currency: 'USD', amount: '1.6000' }]
          }
        });
        return result;
      }
    },
    {
      name: 'opex',
      weight: 25,
      run: async () => {
        const id = ++seq;
        const result = await req('/api/opex', {
          method: 'POST',
          headers: authHeaders,
          body: {
            category: 'Operacional',
            description: `Stress opex ${stamp}-${id}`,
            amountUsd: '0.5000',
            occurredAt: today
          }
        });
        return result;
      }
    },
    {
      name: 'client-create',
      weight: 15,
      run: async () => {
        const id = ++seq;
        const result = await req('/api/clients', {
          method: 'POST',
          headers: authHeaders,
          body: {
            fullName: `Cliente Stress ${stamp}-${id}`,
            documentId: `C-SW-${stamp}-${id}`,
            phone: '5551234',
            address: 'Rua Cliente Stress',
            goldOrigin: 'Garimpo'
          }
        });
        return result;
      }
    }
  ];

  const totalWeight = ops.reduce((acc, item) => acc + item.weight, 0);
  const pickOp = () => {
    const point = Math.random() * totalWeight;
    let acc = 0;
    for (const op of ops) {
      acc += op.weight;
      if (point <= acc) return op;
    }
    return ops[ops.length - 1];
  };

  const deadline = Date.now() + durationSec * 1000;
  const endpointStats = new Map();
  const allLatencies = [];
  let total = 0;
  let success = 0;
  let failure = 0;

  for (const op of ops) {
    endpointStats.set(op.name, { total: 0, success: 0, failure: 0, statuses: {}, latencies: [] });
  }

  const worker = async () => {
    while (Date.now() < deadline) {
      const op = pickOp();
      const result = await op.run();
      total += 1;

      const stat = endpointStats.get(op.name);
      stat.total += 1;
      stat.latencies.push(result.elapsed);
      allLatencies.push(result.elapsed);

      const key = String(result.status);
      stat.statuses[key] = (stat.statuses[key] ?? 0) + 1;

      if (result.ok) {
        success += 1;
        stat.success += 1;
      } else {
        failure += 1;
        stat.failure += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const rps = Number((total / durationSec).toFixed(2));
  const successRate = total > 0 ? Number(((success / total) * 100).toFixed(2)) : 0;
  const latency = summarize(allLatencies);

  console.log('\n=== WRITE STRESS SUMMARY ===');
  console.log(`Requests: ${total}`);
  console.log(`Success: ${success}`);
  console.log(`Failure: ${failure}`);
  console.log(`Success rate: ${successRate}%`);
  console.log(`Throughput: ${rps} req/s`);
  console.log(`Latency ms => min=${latency.min} avg=${latency.avg} p50=${latency.p50} p95=${latency.p95} p99=${latency.p99} max=${latency.max}`);

  console.log('\n=== PER OPERATION ===');
  for (const op of ops) {
    const stat = endpointStats.get(op.name);
    const l = summarize(stat.latencies);
    console.log(`- ${op.name}: total=${stat.total} success=${stat.success} failure=${stat.failure} p95=${l.p95}ms statuses=${JSON.stringify(stat.statuses)}`);
  }

  console.log('=== WRITE STRESS TEST END ===');

  if (failure > 0) {
    process.exitCode = 1;
  }
})();
