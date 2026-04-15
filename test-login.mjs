#!/usr/bin/env node
import http from 'http';

const testLogin = async () => {
  // First, let's try to provision a new tenant
  console.log('Step 1: Provisioning new tenant...');
  
  const provisionData = JSON.stringify({
    companyName: 'Test Company',
    adminName: 'Test Admin',
    adminEmail: 'test@test.com',
    adminPassword: 'TestPass123'
  });

  const provisionOpts = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/master/provision',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': 'master-dev-key-change-in-prod',
      'Content-Length': provisionData.length
    }
  };

  const provisionRes = await new Promise((resolve, reject) => {
    const req = http.request(provisionOpts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.write(provisionData);
    req.end();
  });

  console.log('Provision status:', provisionRes.status);
  const provisioned = JSON.parse(provisionRes.body);
  console.log('Provisioned:', JSON.stringify(provisioned, null, 2));

  const tenantId = provisioned.tenant.id;
  console.log('\nStep 2: Testing login with new tenant...');
  console.log('Tenant ID:', tenantId);

  // Now test login
  const loginData = JSON.stringify({
    email: 'test@test.com',
    password: 'TestPass123'
  });

  const loginOpts = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,
      'Content-Length': loginData.length
    }
  };

  const loginRes = await new Promise((resolve, reject) => {
    const req = http.request(loginOpts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.write(loginData);
    req.end();
  });

  console.log('Login status:', loginRes.status);
  console.log('Login response:', loginRes.body);

  if (loginRes.status === 200) {
    console.log('\n✅ LOGIN SUCCESSFUL!');
    const loginPayload = JSON.parse(loginRes.body);
    console.log('Access token:', loginPayload.accessToken ? '✓ Present' : '✗ Missing');
    console.log('User ID:', loginPayload.user?.id);
    console.log('User role:', loginPayload.user?.role);
  } else {
    console.log('\n❌ LOGIN FAILED!');
  }
};

testLogin().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
