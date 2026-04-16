import "dotenv/config";

import cors from "cors";
import express from "express";

import { tenantResolverMiddleware } from "./middleware/tenant-resolver.js";
import { authMiddleware } from "./middleware/auth-middleware.js";
import { clientsRouter } from "./routes/clients.js";
import { goldTransitRouter } from "./routes/gold-transit.js";
import { ledgerRouter } from "./routes/ledger.js";
import { loanBooksRouter } from "./routes/loan-books.js";
import { masterAdminRouter } from "./routes/master-admin.js";
import { opexRouter } from "./routes/opex.js";
import { authRouter } from "./routes/auth.js";
import { rootPrisma } from "./prisma.js";
import { ordersRouter } from "./routes/orders.js";
import { ratesRouter } from "./routes/rates.js";
import { suppliersRouter } from "./routes/suppliers.js";
import { treasuryRouter } from "./routes/treasury.js";
import { vaultRouter } from "./routes/vault.js";
import { disconnectMasterPrisma } from "./tenant/master-client.js";
import { disconnectAllTenantPrismas } from "./tenant/tenant-prisma-factory.js";

const app = express();
const port = Number(process.env.PORT ?? "3000");
const localhostOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const defaultAllowedOrigins = [
  "http://localhost:3003",
  "http://localhost:3004",
  "http://localhost:3005",
  "http://127.0.0.1:3003",
  "http://127.0.0.1:3004",
  "http://127.0.0.1:3005"
];

const configuredOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : defaultAllowedOrigins;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || localhostOriginRegex.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"));
    }
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Control plane endpoints (master DB), sem resolver tenant.
app.use("/api/master", masterAdminRouter);

// Data plane endpoints: exigem resolução de tenant por request.
app.use("/api", tenantResolverMiddleware);

// Auth endpoint (no authMiddleware needed for login)
app.use("/api/auth", authRouter);

// Protected endpoints (require valid JWT)
app.use("/api/orders", authMiddleware, ordersRouter);
app.use("/api/rates", authMiddleware, ratesRouter);
app.use("/api/vault", authMiddleware, vaultRouter);
app.use("/api/clients", authMiddleware, clientsRouter);
app.use("/api/suppliers", authMiddleware, suppliersRouter);
app.use("/api/ledger", authMiddleware, ledgerRouter);
app.use("/api/loan-books", authMiddleware, loanBooksRouter);
app.use("/api/gold-transit", goldTransitRouter);
app.use("/api/opex", opexRouter);
app.use("/api/treasury", treasuryRouter);

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});

const gracefulShutdown = async () => {
  await Promise.all([
    rootPrisma.$disconnect(),
    disconnectMasterPrisma(),
    disconnectAllTenantPrismas()
  ]);
};

process.on("SIGINT", async () => {
  await gracefulShutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await gracefulShutdown();
  process.exit(0);
});
