import "dotenv/config";

import { provisionNewTenant } from "../tenant/provisioning.js";

const [companyName, adminName, adminEmail, adminPassword] = process.argv.slice(2);

if (!companyName || !adminName || !adminEmail || !adminPassword) {
  console.error("Usage: tsx src/scripts/provision-new-tenant.ts <companyName> <adminName> <adminEmail> <adminPassword>");
  process.exit(1);
}

provisionNewTenant({
  companyName,
  adminName,
  adminEmail,
  adminPassword
})
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
