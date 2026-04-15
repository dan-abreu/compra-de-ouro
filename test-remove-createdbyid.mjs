#!/usr/bin/env node
import http from "http";

const makeRequest = (method, path, body, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:3000${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers
      }
    };

    if (body) {
      const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
      options.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null
        });
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
};

const runTest = async () => {
  console.log("=== TEST: Remove createdById from Compra/Venda ===\n");

  try {
    // Step 1: Provision a new tenant
    console.log("Step 1: Provisioning new tenant...");
    const provisionRes = await makeRequest("POST", "/api/master/provision", {
      companyName: "Test Loja Removeido",
      adminName: "Admin Teste",
      adminEmail: "admin@removeid.test",
      adminPassword: "TestPass123Remove"
    }, {
      "X-Master-Key": "master-dev-key-change-in-prod"
    });

    if (provisionRes.status !== 201) {
      console.error("❌ Provision failed:", provisionRes.body);
      return;
    }

    const tenantId = provisionRes.body.tenant.id;
    console.log(`✅ Tenant provisioned: ${tenantId}\n`);

    // Step 2: Login with the admin user
    console.log("Step 2: Logging in...");
    const loginRes = await makeRequest("POST", "/api/auth/login", {
      email: "admin@removeid.test",
      password: "TestPass123Remove"
    }, {
      "X-Tenant-ID": tenantId
    });

    if (loginRes.status !== 200) {
      console.error("❌ Login failed:", loginRes.body);
      return;
    }

    const token = loginRes.body.accessToken;
    const userId = loginRes.body.user.id;
    console.log(`✅ Logged in successfully`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Token: ${token.substring(0, 20)}...\n`);

    // Step 3: Create a purchase order WITHOUT creatdById in payload
    console.log("Step 3: Creating purchase order (without createdById in payload)...");
    const purchaseRes = await makeRequest("POST", "/api/orders/purchase", {
      isWalkIn: true,
      goldState: "BURNED",
      physicalWeight: "100.0000",
      purityPercentage: "99.0000",
      negotiatedPricePerGram: "60.0000",
      totalOrderValueUsd: "6000.0000",
      paymentSplits: [
        {
          currency: "USD",
          amount: "6000.0000"
        }
      ]
    }, {
      "X-Tenant-ID": tenantId,
      Authorization: `Bearer ${token}`
    });

    if (purchaseRes.status !== 201) {
      console.error("❌ Purchase creation failed:", purchaseRes.body);
      console.error("Status:", purchaseRes.status);
      return;
    }

    const orderId = purchaseRes.body.id;
    const createdById = purchaseRes.body.createdById;
    console.log(`✅ Purchase order created successfully`);
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Created By: ${createdById}`);
    console.log(`   Expected User ID match: ${createdById === userId ? "✅ YES" : "❌ NO"}\n`);

    if (createdById !== userId) {
      console.error("❌ ERROR: createdById should match the authenticated user ID!");
      return;
    }

    console.log("=== ✅ ALL TESTS PASSED ===");
    console.log("\nSummary:");
    console.log("- Tenant provisioned and admin user created");
    console.log("- Login successful with JWT token generation");
    console.log("- Purchase order created WITHOUT manually providing createdById");
    console.log("- Backend correctly extracted userId from JWT and assigned as createdById");

  } catch (error) {
    console.error("❌ Test error:", error instanceof Error ? error.message : error);
  }
};

runTest();
