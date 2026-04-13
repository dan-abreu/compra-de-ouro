import "dotenv/config";

import express from "express";

import { clientsRouter } from "./routes/clients.js";
import { ledgerRouter } from "./routes/ledger.js";
import { prisma } from "./prisma.js";
import { ordersRouter } from "./routes/orders.js";
import { ratesRouter } from "./routes/rates.js";
import { suppliersRouter } from "./routes/suppliers.js";
import { vaultRouter } from "./routes/vault.js";

const app = express();
const port = Number(process.env.PORT ?? "3000");

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/orders", ordersRouter);
app.use("/api/rates", ratesRouter);
app.use("/api/vault", vaultRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/ledger", ledgerRouter);

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
