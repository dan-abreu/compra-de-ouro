const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const masterKey = process.env.MASTER_KEY ?? 'master-dev-key-change-in-prod';
const durationSec = Number(process.env.RAMP_DURATION_SEC ?? 15);
const levels = (process.env.RAMP_LEVELS ?? '10,25,50,75')
  .split(',')
  .map((n) => Number(n.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

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
  { name: 'vault', path: '/api/vault', weight: 24 },
  { name: 'clients', path: '/api/clients', weight: 18 },
  { name: 'treasury', path: '/api/treasury', weight: 20 },
  { name: 'rates-live', path: '/api/rates/market-live', weight: 28 },
  { name: 'ledger', path: '/api/ledger?page=1&pageSize=20', weight: 10 }
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

const runLevel = async (concurrency, authHeaders) => {
  const deadline = Date.now() + durationSec * 1000;
  const latencies = [];
  let total = 0;
  let success = 0;
  let failure = 0;

  const worker = async () => {
    while (Date.now() < deadline) {
      const route = pickRoute();
      const result = await req(route.path, { headers: authHeaders });
      total += 1;
      latencies.push(result.elapsed);

      if (result.ok) {
        success += 1;
      } else {
        failure += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const l = summarize(latencies);
  const successRate = total > 0 ? Number(((success / total) * 100).toFixed(2)) : 0;
  const throughput = Number((total / durationSec).toFixed(2));

  return {
    total,
    successRate,
    throughput,
    p95: l.p95,
    p99: l.p99,
    failure
  };
};

(async () => {
  console.log('=== RAMP STRESS TEST START ===');
  console.log(`Target: ${base}`);
  console.log(`Duration per level: ${durationSec}s`);
  console.log(`Levels: ${levels.join(', ')}`);

  const health = await req('/health');
  if (!health.ok) {
    console.log(`FAIL health check status=${health.status}`);
    process.exit(1);
  }

  const stamp = Date.now();
  const adminEmail = `ramp${stamp}@test.local`;
  const adminPassword = 'RampPass123!';

  const provision = await req('/api/master/provision', {
    method: 'POST',
    headers: { 'X-Master-Key': masterKey },
    body: {
      companyName: `Ramp Tenant ${stamp}`,
      adminName: 'Ramp Admin',
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

  await Promise.all([
    req('/api/vault', { headers: authHeaders }),
    req('/api/clients', { headers: authHeaders }),
    req('/api/treasury', { headers: authHeaders }),
    req('/api/rates/market-live', { headers: authHeaders })
  ]);

  const rows = [];
  for (const concurrency of levels) {
    console.log(`\n--- Running level concurrency=${concurrency} ---`);
    const metrics = await runLevel(concurrency, authHeaders);
    const saturated = metrics.successRate < 99 || metrics.p95 > 120 || metrics.failure > 0;
    rows.push({ concurrency, ...metrics, saturated });
    console.log(`req=${metrics.total} success=${metrics.successRate}% rps=${metrics.throughput} p95=${metrics.p95}ms p99=${metrics.p99}ms saturated=${saturated ? 'YES' : 'NO'}`);
  }

  console.log('\n=== RAMP SUMMARY ===');
  for (const row of rows) {
    console.log(`- c=${row.concurrency} | req=${row.total} | success=${row.successRate}% | rps=${row.throughput} | p95=${row.p95}ms | p99=${row.p99}ms | saturated=${row.saturated ? 'YES' : 'NO'}`);
  }

  const stableRows = rows.filter((r) => !r.saturated);
  if (stableRows.length > 0) {
    const best = stableRows[stableRows.length - 1];
    console.log(`\nRecommended stable limit: concurrency=${best.concurrency} (success=${best.successRate}% p95=${best.p95}ms)`);
  } else {
    console.log('\nNo stable level found under current thresholds.');
  }

  console.log('=== RAMP STRESS TEST END ===');
})();
