const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const masterKey = process.env.MASTER_KEY ?? 'master-dev-key-change-in-prod';
const concurrency = Number(process.env.CONCURRENCY ?? 20);
const durationSec = Number(process.env.DURATION_SEC ?? 20);

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

const scenario = [
  { name: 'vault', method: 'GET', path: '/api/vault', weight: 24 },
  { name: 'clients', method: 'GET', path: '/api/clients', weight: 18 },
  { name: 'treasury', method: 'GET', path: '/api/treasury', weight: 20 },
  { name: 'rates-live', method: 'GET', path: '/api/rates/market-live', weight: 28 },
  { name: 'ledger', method: 'GET', path: '/api/ledger?page=1&pageSize=20', weight: 10 }
];

const totalWeight = scenario.reduce((acc, item) => acc + item.weight, 0);
const pickRoute = () => {
  const point = Math.random() * totalWeight;
  let acc = 0;
  for (const item of scenario) {
    acc += item.weight;
    if (point <= acc) return item;
  }
  return scenario[scenario.length - 1];
};

(async () => {
  console.log('=== STRESS TEST START ===');
  console.log(`Target: ${base}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Duration: ${durationSec}s`);

  const health = await req('/health');
  if (!health.ok) {
    console.log(`FAIL health check status=${health.status}`);
    process.exit(1);
  }

  const stamp = Date.now();
  const adminEmail = `stress${stamp}@test.local`;
  const adminPassword = 'StressPass123!';

  const provision = await req('/api/master/provision', {
    method: 'POST',
    headers: { 'X-Master-Key': masterKey },
    body: {
      companyName: `Stress Tenant ${stamp}`,
      adminName: 'Stress Admin',
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

  // Warmup requests to compile hot paths before measurement.
  await Promise.all([
    req('/api/vault', { headers: authHeaders }),
    req('/api/clients', { headers: authHeaders }),
    req('/api/treasury', { headers: authHeaders }),
    req('/api/rates/market-live', { headers: authHeaders })
  ]);

  const deadline = Date.now() + durationSec * 1000;
  const endpointStats = new Map();
  const allLatencies = [];
  let total = 0;
  let success = 0;
  let failure = 0;

  for (const route of scenario) {
    endpointStats.set(route.name, { total: 0, success: 0, failure: 0, statuses: {}, latencies: [] });
  }

  const worker = async () => {
    while (Date.now() < deadline) {
      const route = pickRoute();
      const result = await req(route.path, { method: route.method, headers: authHeaders });
      total += 1;
      const stat = endpointStats.get(route.name);
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

  const elapsedSec = durationSec;
  const rps = Number((total / elapsedSec).toFixed(2));
  const successRate = total > 0 ? Number(((success / total) * 100).toFixed(2)) : 0;
  const latency = summarize(allLatencies);

  console.log('\n=== STRESS TEST SUMMARY ===');
  console.log(`Requests: ${total}`);
  console.log(`Success: ${success}`);
  console.log(`Failure: ${failure}`);
  console.log(`Success rate: ${successRate}%`);
  console.log(`Throughput: ${rps} req/s`);
  console.log(`Latency ms => min=${latency.min} avg=${latency.avg} p50=${latency.p50} p95=${latency.p95} p99=${latency.p99} max=${latency.max}`);

  console.log('\n=== PER ENDPOINT ===');
  for (const route of scenario) {
    const stat = endpointStats.get(route.name);
    const l = summarize(stat.latencies);
    console.log(`- ${route.name}: total=${stat.total} success=${stat.success} failure=${stat.failure} p95=${l.p95}ms statuses=${JSON.stringify(stat.statuses)}`);
  }

  console.log('=== STRESS TEST END ===');

  if (failure > 0) {
    process.exitCode = 1;
  }
})();
