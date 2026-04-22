import { execSync } from 'node:child_process';

const base = 'http://127.0.0.1:3000';
const masterKey = 'master-dev-key-change-in-prod';
const results = [];

const push = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`);
};

const req = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

(async () => {
  try {
    const stamp = Date.now();
    const adminEmail = `fullsmoke${stamp}@test.local`;
    const adminPassword = 'FullSmokePass123!';

    const health = await req('/health');
    push('Health check', health.status === 200, `status=${health.status}`);

    const provision = await req('/api/master/provision', {
      method: 'POST',
      headers: { 'X-Master-Key': masterKey },
      body: {
        companyName: `Full Smoke ${stamp}`,
        adminName: 'Full Smoke Admin',
        adminEmail,
        adminPassword
      }
    });

    const tenantId = provision.data?.tenant?.id;
    const tenantDbUrl = provision.data?.tenant?.databaseUrl;
    push('Master provision tenant', provision.status === 201 && !!tenantId && !!tenantDbUrl, `status=${provision.status}`);
    if (!tenantId || !tenantDbUrl) throw new Error('Provision failed');

    // Seed operational runtime data for realistic flows.
    execSync(`npx tsx src/scripts/seed-tenant-runtime-data.ts "${tenantDbUrl}" "${adminEmail}"`, { stdio: 'pipe' });
    push('Seed runtime data', true, 'vault and daily rate ready');

    const login = await req('/api/auth/login', {
      method: 'POST',
      headers: { 'X-Tenant-ID': tenantId },
      body: { email: adminEmail, password: adminPassword }
    });

    const token = login.data?.accessToken;
    push('Auth login', login.status === 200 && !!token, `status=${login.status}`);
    if (!token) throw new Error('Login failed');

    const authHeaders = { 'X-Tenant-ID': tenantId, Authorization: `Bearer ${token}` };

    const marketLive = await req('/api/rates/market-live', { headers: authHeaders });
    push('Rates market-live', marketLive.status === 200 && !!marketLive.data?.goldPricePerGramUsd, `status=${marketLive.status}`);

    const latestRate = await req('/api/rates/latest', { headers: authHeaders });
    push('Rates latest', latestRate.status === 200, `status=${latestRate.status}`);

    const client = await req('/api/clients', {
      method: 'POST', headers: authHeaders,
      body: { fullName: 'Cliente Full Smoke', documentId: `CL-${stamp}` }
    });
    const clientId = client.data?.id;
    push('Clients create', client.status === 201 && !!clientId, `status=${client.status}`);

    const supplier = await req('/api/suppliers', {
      method: 'POST', headers: authHeaders,
      body: { companyName: 'Fornecedor Full Smoke', documentId: `SU-${stamp}` }
    });
    const supplierId = supplier.data?.id;
    push('Suppliers create', supplier.status === 201 && !!supplierId, `status=${supplier.status}`);

    const purchase = await req('/api/orders/purchase', {
      method: 'POST', headers: authHeaders,
      body: {
        clientId,
        isWalkIn: false,
        goldState: 'BURNED',
        physicalWeight: '10.0000',
        purityPercentage: '95.0000',
        negotiatedPricePerGram: '70.0000',
        totalOrderValueUsd: '700.0000',
        paymentSplits: [{ currency: 'USD', amount: '700.0000' }]
      }
    });
    const purchaseId = purchase.data?.id;
    push('Orders purchase create', purchase.status === 201 && !!purchaseId, `status=${purchase.status}`);

    const sale = await req('/api/orders/sale', {
      method: 'POST', headers: authHeaders,
      body: {
        supplierId,
        isWalkIn: false,
        goldState: 'MELTED',
        physicalWeight: '2.0000',
        purityPercentage: '99.0000',
        negotiatedPricePerGram: '80.0000',
        totalOrderValueUsd: '160.0000',
        paymentSplits: [{ currency: 'USD', amount: '160.0000' }]
      }
    });
    const saleId = sale.data?.id;
    push('Orders sale create', sale.status === 201 && !!saleId, `status=${sale.status}`);

    const ledger = await req('/api/ledger', { headers: authHeaders });
    push('Ledger list', ledger.status === 200 && Array.isArray(ledger.data) && ledger.data.length >= 2, `status=${ledger.status} count=${Array.isArray(ledger.data) ? ledger.data.length : '-'}`);

    const vault = await req('/api/vault', { headers: authHeaders });
    push('Vault read', vault.status === 200 && !!vault.data, `status=${vault.status}`);

    const loanCreate = await req('/api/loan-books', {
      method: 'POST', headers: authHeaders,
      body: { clientId, counterpartyName: 'Garimpeiro FS', runningBalanceUsd: '-100.0000', frontMoneyUsd: '-50.0000', goldOwedGrams: '1.2000' }
    });
    push('Loan books create', loanCreate.status === 201, `status=${loanCreate.status}`);

    const loanList = await req('/api/loan-books', { headers: authHeaders });
    push('Loan books list', loanList.status === 200 && Array.isArray(loanList.data), `status=${loanList.status}`);

    const transitCreate = await req('/api/gold-transit', {
      method: 'POST', headers: authHeaders,
      body: { destination: 'Refinaria FS', physicalWeight: '0.5000', dispatchDate: '2026-04-15', expectedSettlementDate: '2026-04-16' }
    });
    push('Gold transit create', transitCreate.status === 201, `status=${transitCreate.status}`);

    const transitList = await req('/api/gold-transit', { headers: authHeaders });
    push('Gold transit list', transitList.status === 200 && Array.isArray(transitList.data), `status=${transitList.status}`);

    const today = new Date().toISOString().slice(0, 10);
    const opexCreate = await req('/api/opex', {
      method: 'POST', headers: authHeaders,
      body: { category: 'Operacional', description: 'Despesa full smoke', amountUsd: '12.3400', occurredAt: today }
    });
    push('Opex create', opexCreate.status === 201, `status=${opexCreate.status}`);

    const opexList = await req(`/api/opex?date=${today}`, { headers: authHeaders });
    push('Opex list', opexList.status === 200 && Array.isArray(opexList.data), `status=${opexList.status}`);

    const treasury = await req('/api/treasury', { headers: authHeaders });
    push('Treasury dashboard data', treasury.status === 200 && !!treasury.data?.pnlToday, `status=${treasury.status}`);

    const cancelPurchase = await req(`/api/orders/purchase/${purchaseId}/cancel`, {
      method: 'POST', headers: authHeaders, body: { reason: 'full smoke cancel test' }
    });
    push('Orders purchase cancel endpoint', cancelPurchase.status === 501, `status=${cancelPurchase.status}`);

    const cancelSale = await req(`/api/orders/sale/${saleId}/cancel`, {
      method: 'POST', headers: authHeaders, body: { reason: 'full smoke cancel test' }
    });
    push('Orders sale cancel endpoint', cancelSale.status === 501, `status=${cancelSale.status}`);

    const passed = results.filter(r => r.ok).length;
    const failed = results.length - passed;

    console.log('\n=== FULL SMOKE SUMMARY ===');
    console.log(`Tenant: ${tenantId}`);
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

    if (failed > 0) {
      console.log('\nFailed:');
      for (const r of results.filter(x => !x.ok)) {
        console.log(`- ${r.name}: ${r.detail}`);
      }
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('FATAL:', err.message || err);
    process.exitCode = 1;
  }
})();
