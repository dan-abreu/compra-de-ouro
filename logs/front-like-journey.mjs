import { execSync } from 'node:child_process';

const base = 'http://127.0.0.1:3000';
const masterKey = 'master-dev-key-change-in-prod';

const step = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`);
  if (!ok) process.exitCode = 1;
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
  const stamp = Date.now();
  const adminEmail = `frontflow${stamp}@test.local`;
  const adminPassword = 'FrontFlowPass123!';

  console.log('=== FRONT-LIKE JOURNEY TEST ===');

  // 0) Infra checks
  const health = await req('/health');
  step('App bootstrap (health)', health.status === 200, `status=${health.status}`);

  // 1) "Cadastro da empresa" (simula onboarding)
  const provision = await req('/api/master/provision', {
    method: 'POST',
    headers: { 'X-Master-Key': masterKey },
    body: {
      companyName: `Front Flow ${stamp}`,
      adminName: 'Front Flow Admin',
      adminEmail,
      adminPassword
    }
  });
  const tenantId = provision.data?.tenant?.id;
  const tenantDbUrl = provision.data?.tenant?.databaseUrl;
  step('Tela inicial -> Provision tenant', provision.status === 201 && !!tenantId && !!tenantDbUrl, `status=${provision.status}`);
  if (!tenantId || !tenantDbUrl) return;

  // 2) Seed base operacional para telas do front terem dados úteis
  execSync(`npx tsx src/scripts/seed-tenant-runtime-data.ts "${tenantDbUrl}" "${adminEmail}"`, { stdio: 'pipe' });
  step('Setup operacional (seed runtime)', true, 'vault/rates seeded');

  // 3) Login page flow
  const login = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'X-Tenant-ID': tenantId },
    body: { email: adminEmail, password: adminPassword }
  });
  const token = login.data?.accessToken;
  step('Login page -> autenticar', login.status === 200 && !!token, `status=${login.status}`);
  if (!token) return;

  const authHeaders = { 'X-Tenant-ID': tenantId, Authorization: `Bearer ${token}` };

  // 4) Dashboard route load
  const vault = await req('/api/vault', { headers: authHeaders });
  const latestRate = await req('/api/rates/latest', { headers: authHeaders });
  step('Dashboard -> carregar saldo cofre', vault.status === 200, `status=${vault.status}`);
  step('Dashboard -> carregar snapshot taxa', latestRate.status === 200, `status=${latestRate.status}`);

  // 5) Market rail / live rates (usado em várias páginas)
  const marketLive = await req('/api/rates/market-live', { headers: authHeaders });
  step('Painel mercado -> cotacao em tempo real', marketLive.status === 200 && !!marketLive.data?.goldPricePerGramUsd, `status=${marketLive.status} source=${marketLive.data?.sourceMode ?? '-'}`);

  // 6) Clientes page flow
  const clientCreate = await req('/api/clients', {
    method: 'POST', headers: authHeaders,
    body: { fullName: 'Cliente Front', documentId: `CF-${stamp}`, phone: '5551000', address: 'Rua Cliente', goldOrigin: 'Garimpo' }
  });
  const clientId = clientCreate.data?.id;
  const clientsList = await req('/api/clients', { headers: authHeaders });
  step('Clientes -> cadastrar cliente', clientCreate.status === 201 && !!clientId, `status=${clientCreate.status}`);
  step('Clientes -> listar clientes', clientsList.status === 200 && Array.isArray(clientsList.data), `status=${clientsList.status}`);

  // 7) Fornecedores page flow
  const supplierCreate = await req('/api/suppliers', {
    method: 'POST', headers: authHeaders,
    body: { companyName: 'Fornecedor Front', documentId: `SF-${stamp}`, contactName: 'Contato Front', phone: '5552000', address: 'Rua Fornecedor' }
  });
  const supplierId = supplierCreate.data?.id;
  const suppliersList = await req('/api/suppliers', { headers: authHeaders });
  step('Fornecedores -> cadastrar fornecedor', supplierCreate.status === 201 && !!supplierId, `status=${supplierCreate.status}`);
  step('Fornecedores -> listar fornecedores', suppliersList.status === 200 && Array.isArray(suppliersList.data), `status=${suppliersList.status}`);

  // 8) Compra page flow
  const purchase = await req('/api/orders/purchase', {
    method: 'POST', headers: authHeaders,
    body: {
      clientId,
      isWalkIn: false,
      goldState: 'BURNED',
      physicalWeight: '8.0000',
      purityPercentage: '95.0000',
      negotiatedPricePerGram: '70.0000',
      totalOrderValueUsd: '560.0000',
      paymentSplits: [{ currency: 'USD', amount: '560.0000' }]
    }
  });
  step('Compra -> finalizar ordem', purchase.status === 201, `status=${purchase.status}`);

  // 9) Venda page flow
  const sale = await req('/api/orders/sale', {
    method: 'POST', headers: authHeaders,
    body: {
      supplierId,
      isWalkIn: false,
      goldState: 'MELTED',
      physicalWeight: '2.5000',
      purityPercentage: '99.0000',
      negotiatedPricePerGram: '80.0000',
      totalOrderValueUsd: '200.0000',
      paymentSplits: [{ currency: 'USD', amount: '200.0000' }]
    }
  });
  step('Venda -> finalizar ordem', sale.status === 201, `status=${sale.status}`);

  // 10) Extrato page flow
  const ledger = await req('/api/ledger', { headers: authHeaders });
  step('Extrato -> listar movimentos', ledger.status === 200 && Array.isArray(ledger.data) && ledger.data.length >= 2, `status=${ledger.status} count=${Array.isArray(ledger.data) ? ledger.data.length : '-'}`);

  // 11) Tesouraria page flow
  const treasury = await req('/api/treasury', { headers: authHeaders });
  step('Tesouraria -> carregar dashboard gerencial', treasury.status === 200 && !!treasury.data?.pnlToday, `status=${treasury.status}`);

  // 12) OPEX page support
  const today = new Date().toISOString().slice(0, 10);
  const opexCreate = await req('/api/opex', {
    method: 'POST', headers: authHeaders,
    body: { category: 'Operacional', description: 'Despesa front flow', amountUsd: '9.9900', occurredAt: today }
  });
  const opexList = await req(`/api/opex?date=${today}`, { headers: authHeaders });
  step('OPEX -> criar despesa', opexCreate.status === 201, `status=${opexCreate.status}`);
  step('OPEX -> listar despesas', opexList.status === 200 && Array.isArray(opexList.data), `status=${opexList.status}`);

  console.log('=== END FRONT-LIKE JOURNEY TEST ===');
})();
