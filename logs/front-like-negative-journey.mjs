const base = 'http://127.0.0.1:3000';
const masterKey = 'master-dev-key-change-in-prod';

const rows = [];
const add = (name, ok, detail) => {
  rows.push({ name, ok, detail });
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
  const adminEmail = `negflow${stamp}@test.local`;
  const adminPassword = 'NegFlowPass123!';

  console.log('=== FRONT-LIKE NEGATIVE JOURNEY TEST ===');

  const health = await req('/health');
  add('Health check', health.status === 200, `status=${health.status}`);

  const provision = await req('/api/master/provision', {
    method: 'POST',
    headers: { 'X-Master-Key': masterKey },
    body: {
      companyName: `Neg Flow ${stamp}`,
      adminName: 'Neg Flow Admin',
      adminEmail,
      adminPassword
    }
  });
  const tenantId = provision.data?.tenant?.id;
  add('Provision tenant for negative tests', provision.status === 201 && !!tenantId, `status=${provision.status}`);
  if (!tenantId) return;

  // Invalid tenant (simulates wrong company code)
  const badTenant = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'X-Tenant-ID': 'tenant-inexistente' },
    body: { email: adminEmail, password: adminPassword }
  });
  add('Login with invalid tenant', badTenant.status === 404, `status=${badTenant.status} code=${badTenant.data?.code ?? '-'}`);

  // Invalid password
  const wrongPass = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'X-Tenant-ID': tenantId },
    body: { email: adminEmail, password: 'senha-errada' }
  });
  add('Login with wrong password', wrongPass.status === 401, `status=${wrongPass.status} code=${wrongPass.data?.code ?? '-'}`);

  // Successful login for authenticated negative scenarios
  const login = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'X-Tenant-ID': tenantId },
    body: { email: adminEmail, password: adminPassword }
  });
  const token = login.data?.accessToken;
  add('Login success baseline', login.status === 200 && !!token, `status=${login.status}`);
  if (!token) return;

  const authHeaders = { 'X-Tenant-ID': tenantId, Authorization: `Bearer ${token}` };

  // Missing auth token
  const noAuthRates = await req('/api/rates/market-live', {
    headers: { 'X-Tenant-ID': tenantId }
  });
  add('Protected endpoint without token', noAuthRates.status === 401, `status=${noAuthRates.status} code=${noAuthRates.data?.code ?? '-'}`);

  // Invalid payload for client (missing fullName)
  const badClient = await req('/api/clients', {
    method: 'POST',
    headers: authHeaders,
    body: { fullName: '' }
  });
  add('Client validation error', badClient.status === 422, `status=${badClient.status} code=${badClient.data?.code ?? '-'}`);

  // Prepare supplier for order tests
  const supplier = await req('/api/suppliers', {
    method: 'POST',
    headers: authHeaders,
    body: { companyName: 'Fornecedor Negativo', documentId: `NEG-S-${stamp}` }
  });
  const supplierId = supplier.data?.id;
  add('Supplier create baseline', supplier.status === 201 && !!supplierId, `status=${supplier.status}`);

  // Sale without open gold should fail with 409
  const saleNoGold = await req('/api/orders/sale', {
    method: 'POST',
    headers: authHeaders,
    body: {
      supplierId,
      isWalkIn: false,
      goldState: 'MELTED',
      physicalWeight: '1.0000',
      purityPercentage: '90.0000',
      negotiatedPricePerGram: '80.0000',
      totalOrderValueUsd: '80.0000',
      paymentSplits: [{ currency: 'USD', amount: '80.0000' }]
    }
  });
  add('Sale without open gold', saleNoGold.status === 409, `status=${saleNoGold.status} code=${saleNoGold.data?.code ?? '-'}`);

  // Purchase with split mismatch should fail 422/domain error
  const purchaseSplitMismatch = await req('/api/orders/purchase', {
    method: 'POST',
    headers: authHeaders,
    body: {
      isWalkIn: true,
      goldState: 'BURNED',
      physicalWeight: '2.0000',
      purityPercentage: '90.0000',
      negotiatedPricePerGram: '70.0000',
      totalOrderValueUsd: '140.0000',
      paymentSplits: [{ currency: 'USD', amount: '100.0000' }]
    }
  });
  add('Purchase with split mismatch', purchaseSplitMismatch.status === 422 || purchaseSplitMismatch.status === 409, `status=${purchaseSplitMismatch.status} code=${purchaseSplitMismatch.data?.code ?? '-'}`);

  // OPEX with invalid date should fail validation
  const badOpex = await req('/api/opex', {
    method: 'POST',
    headers: authHeaders,
    body: {
      category: 'Operacional',
      description: 'Teste data invalida',
      amountUsd: '10.0000',
      occurredAt: '2026-99-99'
    }
  });
  add('OPEX invalid date validation', badOpex.status === 422, `status=${badOpex.status} code=${badOpex.data?.code ?? '-'}`);

  // Cancel endpoints should be 501 (known behavior)
  const cancelPurchase = await req('/api/orders/purchase/qualquer/cancel', {
    method: 'POST', headers: authHeaders, body: { reason: 'teste' }
  });
  add('Purchase cancel not implemented', cancelPurchase.status === 501, `status=${cancelPurchase.status}`);

  const cancelSale = await req('/api/orders/sale/qualquer/cancel', {
    method: 'POST', headers: authHeaders, body: { reason: 'teste' }
  });
  add('Sale cancel not implemented', cancelSale.status === 501, `status=${cancelSale.status}`);

  const passed = rows.filter(r => r.ok).length;
  const failed = rows.length - passed;

  console.log('\n=== NEGATIVE JOURNEY SUMMARY ===');
  console.log(`Total: ${rows.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nUnexpected failures:');
    for (const r of rows.filter(x => !x.ok)) {
      console.log(`- ${r.name}: ${r.detail}`);
    }
  }

  console.log('=== END FRONT-LIKE NEGATIVE JOURNEY TEST ===');
})();
