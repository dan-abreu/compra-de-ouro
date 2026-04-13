import {
  Currency,
  OrderStatus,
  PaymentOrderType,
  Prisma,
  PrismaClient
} from "@prisma/client";
import Decimal from "decimal.js";

import { D, eq4, q4 } from "../lib/decimal.js";
import { DomainError } from "../lib/errors.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

type SplitInput = {
  currency: Currency;
  amount: string;
};

export type CreatePurchaseOrderInput = {
  clientId: string;
  createdById: string;
  dailyRateId?: string;
  grossWeight: string;
  netWeight: string;
  purityPercentage: string;
  paymentSplits: SplitInput[];
};

export type CreateSalesOrderInput = {
  supplierId: string;
  createdById: string;
  dailyRateId?: string;
  fineGoldWeightSold: string;
  negotiatedTotalSrd: string;
  paymentSplits: SplitInput[];
};

export type CancelOrderInput = {
  orderId: string;
  canceledById: string;
  reason?: string;
};

const decimalToPrisma = (value: Decimal): Prisma.Decimal => {
  return new Prisma.Decimal(q4(value).toFixed(4));
};

const prismaToDecimal = (value: Prisma.Decimal): Decimal => {
  return D(value.toString());
};

const ensureValidSplits = (splits: SplitInput[]): void => {
  if (splits.length === 0) {
    throw new DomainError("At least one payment split is required.", 422);
  }
};

const getLockedRate = async (tx: DbClient, dailyRateId?: string) => {
  if (dailyRateId) {
    const found = await tx.dailyRate.findUnique({ where: { id: dailyRateId } });
    if (!found) {
      throw new DomainError("Daily rate not found.", 404);
    }
    return found;
  }

  const latest = await tx.dailyRate.findFirst({
    orderBy: [{ rateDate: "desc" }, { createdAt: "desc" }]
  });

  if (!latest) {
    throw new DomainError("No DailyRate configured. Create one before orders.", 422);
  }

  return latest;
};

const getOrCreateMainVault = async (tx: DbClient) => {
  const existing = await tx.vault.findUnique({ where: { code: "MAIN" } });
  if (existing) {
    return existing;
  }

  return tx.vault.create({
    data: {
      code: "MAIN",
      physicalGoldFineWeight: new Prisma.Decimal("0.0000"),
      balanceSrd: new Prisma.Decimal("0.0000"),
      balanceUsd: new Prisma.Decimal("0.0000"),
      balanceEur: new Prisma.Decimal("0.0000"),
      openGoldFineWeight: new Prisma.Decimal("0.0000"),
      openGoldAcquisitionCostSrd: new Prisma.Decimal("0.0000")
    }
  });
};

const splitConvertedSrd = (split: SplitInput, usdToSrdRate: Decimal, eurToSrdRate: Decimal): Decimal => {
  const amount = D(split.amount);

  if (split.currency === Currency.SRD) {
    return q4(amount);
  }

  if (split.currency === Currency.USD) {
    return q4(amount.mul(usdToSrdRate));
  }

  return q4(amount.mul(eurToSrdRate));
};

const assertNonNegative = (value: Decimal, field: string) => {
  if (value.isNegative()) {
    throw new DomainError(`Insufficient ${field}.`, 409);
  }
};

const applyBalanceDelta = (
  current: { srd: Decimal; usd: Decimal; eur: Decimal },
  splits: SplitInput[],
  operation: "DEBIT" | "CREDIT"
) => {
  let nextSrd = current.srd;
  let nextUsd = current.usd;
  let nextEur = current.eur;

  for (const split of splits) {
    const amount = q4(split.amount);

    if (operation === "DEBIT") {
      if (split.currency === Currency.SRD) nextSrd = q4(nextSrd.sub(amount));
      if (split.currency === Currency.USD) nextUsd = q4(nextUsd.sub(amount));
      if (split.currency === Currency.EUR) nextEur = q4(nextEur.sub(amount));
    } else {
      if (split.currency === Currency.SRD) nextSrd = q4(nextSrd.add(amount));
      if (split.currency === Currency.USD) nextUsd = q4(nextUsd.add(amount));
      if (split.currency === Currency.EUR) nextEur = q4(nextEur.add(amount));
    }
  }

  return { srd: nextSrd, usd: nextUsd, eur: nextEur };
};

export class OrderService {
  constructor(private readonly prisma: PrismaClient) {}

  async createPurchaseOrder(input: CreatePurchaseOrderInput) {
    ensureValidSplits(input.paymentSplits);

    return this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const rate = await getLockedRate(tx, input.dailyRateId);
        const vault = await getOrCreateMainVault(tx);

        const grossWeight = q4(input.grossWeight);
        const netWeight = q4(input.netWeight);
        const purityPercentage = q4(input.purityPercentage);

        if (purityPercentage.gt(100)) {
          throw new DomainError("purityPercentage cannot be greater than 100.", 422);
        }

        const fineGoldWeight = q4(netWeight.mul(purityPercentage.div(100)));
        const goldPrice = prismaToDecimal(rate.goldPricePerGram);
        const usdToSrdRate = prismaToDecimal(rate.usdToSrdRate);
        const eurToSrdRate = prismaToDecimal(rate.eurToSrdRate);

        const totalAmountSrd = q4(fineGoldWeight.mul(goldPrice));

        const converted = input.paymentSplits.map((split) => ({
          ...split,
          convertedValueSrd: splitConvertedSrd(split, usdToSrdRate, eurToSrdRate)
        }));

        const splitSumSrd = converted.reduce((acc, split) => q4(acc.add(split.convertedValueSrd)), D(0));

        if (!eq4(splitSumSrd, totalAmountSrd)) {
          throw new DomainError("Payment split sum does not match total order value.", 422);
        }

        const currentBalances = {
          srd: prismaToDecimal(vault.balanceSrd),
          usd: prismaToDecimal(vault.balanceUsd),
          eur: prismaToDecimal(vault.balanceEur)
        };

        const nextBalances = applyBalanceDelta(currentBalances, input.paymentSplits, "DEBIT");
        assertNonNegative(nextBalances.srd, "SRD balance");
        assertNonNegative(nextBalances.usd, "USD balance");
        assertNonNegative(nextBalances.eur, "EUR balance");

        const nextPhysicalGold = q4(prismaToDecimal(vault.physicalGoldFineWeight).add(fineGoldWeight));
        const nextOpenGold = q4(prismaToDecimal(vault.openGoldFineWeight).add(fineGoldWeight));
        const acquisitionCostSrd = totalAmountSrd;
        const nextOpenCost = q4(prismaToDecimal(vault.openGoldAcquisitionCostSrd).add(acquisitionCostSrd));

        const order = await tx.purchaseOrder.create({
          data: {
            status: OrderStatus.FINALIZED,
            clientId: input.clientId,
            createdById: input.createdById,
            grossWeight: decimalToPrisma(grossWeight),
            netWeight: decimalToPrisma(netWeight),
            purityPercentage: decimalToPrisma(purityPercentage),
            fineGoldWeight: decimalToPrisma(fineGoldWeight),
            lockedGoldPricePerGram: rate.goldPricePerGram,
            lockedUsdToSrdRate: rate.usdToSrdRate,
            lockedEurToSrdRate: rate.eurToSrdRate,
            totalAmountSrd: decimalToPrisma(totalAmountSrd),
            acquisitionCostSrd: decimalToPrisma(acquisitionCostSrd)
          }
        });

        if (converted.length > 0) {
          await tx.paymentSplit.createMany({
            data: converted.map((split) => ({
              orderType: PaymentOrderType.PURCHASE,
              purchaseOrderId: order.id,
              currency: split.currency,
              amount: decimalToPrisma(q4(split.amount)),
              convertedValueSrd: decimalToPrisma(split.convertedValueSrd)
            }))
          });
        }

        await tx.vault.update({
          where: { id: vault.id },
          data: {
            physicalGoldFineWeight: decimalToPrisma(nextPhysicalGold),
            openGoldFineWeight: decimalToPrisma(nextOpenGold),
            openGoldAcquisitionCostSrd: decimalToPrisma(nextOpenCost),
            balanceSrd: decimalToPrisma(nextBalances.srd),
            balanceUsd: decimalToPrisma(nextBalances.usd),
            balanceEur: decimalToPrisma(nextBalances.eur)
          }
        });

        return order;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async createSalesOrder(input: CreateSalesOrderInput) {
    ensureValidSplits(input.paymentSplits);

    return this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const rate = await getLockedRate(tx, input.dailyRateId);
        const vault = await getOrCreateMainVault(tx);

        const fineGoldWeightSold = q4(input.fineGoldWeightSold);
        const negotiatedTotalSrd = q4(input.negotiatedTotalSrd);

        const currentOpenGold = prismaToDecimal(vault.openGoldFineWeight);
        const currentOpenCost = prismaToDecimal(vault.openGoldAcquisitionCostSrd);
        const currentPhysicalGold = prismaToDecimal(vault.physicalGoldFineWeight);

        if (currentOpenGold.lte(0)) {
          throw new DomainError("No open gold available for sale.", 409);
        }

        if (fineGoldWeightSold.gt(currentOpenGold)) {
          throw new DomainError("Not enough open gold weight for this sale.", 409);
        }

        if (fineGoldWeightSold.gt(currentPhysicalGold)) {
          throw new DomainError("Not enough physical gold in vault.", 409);
        }

        const usdToSrdRate = prismaToDecimal(rate.usdToSrdRate);
        const eurToSrdRate = prismaToDecimal(rate.eurToSrdRate);

        const converted = input.paymentSplits.map((split) => ({
          ...split,
          convertedValueSrd: splitConvertedSrd(split, usdToSrdRate, eurToSrdRate)
        }));

        const splitSumSrd = converted.reduce((acc, split) => q4(acc.add(split.convertedValueSrd)), D(0));

        if (!eq4(splitSumSrd, negotiatedTotalSrd)) {
          throw new DomainError("Payment split sum does not match negotiated sale value.", 422);
        }

        const averageAcquisitionCostPerGram = q4(currentOpenCost.div(currentOpenGold));
        const costForSale = q4(averageAcquisitionCostPerGram.mul(fineGoldWeightSold));
        const realizedProfitSrd = q4(negotiatedTotalSrd.sub(costForSale));

        const currentBalances = {
          srd: prismaToDecimal(vault.balanceSrd),
          usd: prismaToDecimal(vault.balanceUsd),
          eur: prismaToDecimal(vault.balanceEur)
        };

        const nextBalances = applyBalanceDelta(currentBalances, input.paymentSplits, "CREDIT");
        const nextPhysicalGold = q4(currentPhysicalGold.sub(fineGoldWeightSold));
        const nextOpenGold = q4(currentOpenGold.sub(fineGoldWeightSold));
        const nextOpenCost = q4(currentOpenCost.sub(costForSale));

        assertNonNegative(nextPhysicalGold, "physical gold");
        assertNonNegative(nextOpenGold, "open gold");
        assertNonNegative(nextOpenCost, "open gold acquisition cost");

        const order = await tx.salesOrder.create({
          data: {
            status: OrderStatus.FINALIZED,
            supplierId: input.supplierId,
            createdById: input.createdById,
            fineGoldWeightSold: decimalToPrisma(fineGoldWeightSold),
            negotiatedTotalSrd: decimalToPrisma(negotiatedTotalSrd),
            lockedGoldPricePerGram: rate.goldPricePerGram,
            lockedUsdToSrdRate: rate.usdToSrdRate,
            lockedEurToSrdRate: rate.eurToSrdRate,
            averageAcquisitionCostSrd: decimalToPrisma(averageAcquisitionCostPerGram),
            realizedProfitSrd: decimalToPrisma(realizedProfitSrd)
          }
        });

        if (converted.length > 0) {
          await tx.paymentSplit.createMany({
            data: converted.map((split) => ({
              orderType: PaymentOrderType.SALE,
              salesOrderId: order.id,
              currency: split.currency,
              amount: decimalToPrisma(q4(split.amount)),
              convertedValueSrd: decimalToPrisma(split.convertedValueSrd)
            }))
          });
        }

        await tx.vault.update({
          where: { id: vault.id },
          data: {
            physicalGoldFineWeight: decimalToPrisma(nextPhysicalGold),
            openGoldFineWeight: decimalToPrisma(nextOpenGold),
            openGoldAcquisitionCostSrd: decimalToPrisma(nextOpenCost),
            balanceSrd: decimalToPrisma(nextBalances.srd),
            balanceUsd: decimalToPrisma(nextBalances.usd),
            balanceEur: decimalToPrisma(nextBalances.eur)
          }
        });

        return order;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async cancelPurchaseOrder(input: CancelOrderInput) {
    return this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const order = await tx.purchaseOrder.findUnique({
          where: { id: input.orderId },
          include: { paymentSplits: true }
        });

        if (!order) throw new DomainError("Purchase order not found.", 404);
        if (order.status === OrderStatus.CANCELED) throw new DomainError("Purchase order already canceled.", 409);
        if (order.status !== OrderStatus.FINALIZED) throw new DomainError("Only finalized purchase orders can be canceled.", 409);

        const vault = await getOrCreateMainVault(tx);
        const currentPhysicalGold = prismaToDecimal(vault.physicalGoldFineWeight);
        const currentOpenGold = prismaToDecimal(vault.openGoldFineWeight);
        const currentOpenCost = prismaToDecimal(vault.openGoldAcquisitionCostSrd);

        const fineGoldWeight = prismaToDecimal(order.fineGoldWeight);
        const acquisitionCostSrd = prismaToDecimal(order.acquisitionCostSrd);

        const nextPhysicalGold = q4(currentPhysicalGold.sub(fineGoldWeight));
        const nextOpenGold = q4(currentOpenGold.sub(fineGoldWeight));
        const nextOpenCost = q4(currentOpenCost.sub(acquisitionCostSrd));

        assertNonNegative(nextPhysicalGold, "physical gold");
        assertNonNegative(nextOpenGold, "open gold");
        assertNonNegative(nextOpenCost, "open cost");

        const mappedSplits: SplitInput[] = order.paymentSplits.map((split: { currency: Currency; amount: Prisma.Decimal }) => ({
          currency: split.currency,
          amount: split.amount.toString()
        }));

        const currentBalances = {
          srd: prismaToDecimal(vault.balanceSrd),
          usd: prismaToDecimal(vault.balanceUsd),
          eur: prismaToDecimal(vault.balanceEur)
        };

        const nextBalances = applyBalanceDelta(currentBalances, mappedSplits, "CREDIT");

        await tx.vault.update({
          where: { id: vault.id },
          data: {
            physicalGoldFineWeight: decimalToPrisma(nextPhysicalGold),
            openGoldFineWeight: decimalToPrisma(nextOpenGold),
            openGoldAcquisitionCostSrd: decimalToPrisma(nextOpenCost),
            balanceSrd: decimalToPrisma(nextBalances.srd),
            balanceUsd: decimalToPrisma(nextBalances.usd),
            balanceEur: decimalToPrisma(nextBalances.eur)
          }
        });

        return tx.purchaseOrder.update({
          where: { id: input.orderId },
          data: {
            status: OrderStatus.CANCELED,
            canceledById: input.canceledById,
            canceledAt: new Date(),
            cancelReason: input.reason ?? null
          }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async cancelSalesOrder(input: CancelOrderInput) {
    return this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const order = await tx.salesOrder.findUnique({
          where: { id: input.orderId },
          include: { paymentSplits: true }
        });

        if (!order) throw new DomainError("Sales order not found.", 404);
        if (order.status === OrderStatus.CANCELED) throw new DomainError("Sales order already canceled.", 409);
        if (order.status !== OrderStatus.FINALIZED) throw new DomainError("Only finalized sales orders can be canceled.", 409);

        const vault = await getOrCreateMainVault(tx);

        const soldFine = prismaToDecimal(order.fineGoldWeightSold);
        const avgCostPerGram = prismaToDecimal(order.averageAcquisitionCostSrd);
        const costForSale = q4(avgCostPerGram.mul(soldFine));

        const nextPhysicalGold = q4(prismaToDecimal(vault.physicalGoldFineWeight).add(soldFine));
        const nextOpenGold = q4(prismaToDecimal(vault.openGoldFineWeight).add(soldFine));
        const nextOpenCost = q4(prismaToDecimal(vault.openGoldAcquisitionCostSrd).add(costForSale));

        const mappedSplits: SplitInput[] = order.paymentSplits.map((split: { currency: Currency; amount: Prisma.Decimal }) => ({
          currency: split.currency,
          amount: split.amount.toString()
        }));

        const currentBalances = {
          srd: prismaToDecimal(vault.balanceSrd),
          usd: prismaToDecimal(vault.balanceUsd),
          eur: prismaToDecimal(vault.balanceEur)
        };

        const nextBalances = applyBalanceDelta(currentBalances, mappedSplits, "DEBIT");
        assertNonNegative(nextBalances.srd, "SRD balance");
        assertNonNegative(nextBalances.usd, "USD balance");
        assertNonNegative(nextBalances.eur, "EUR balance");

        await tx.vault.update({
          where: { id: vault.id },
          data: {
            physicalGoldFineWeight: decimalToPrisma(nextPhysicalGold),
            openGoldFineWeight: decimalToPrisma(nextOpenGold),
            openGoldAcquisitionCostSrd: decimalToPrisma(nextOpenCost),
            balanceSrd: decimalToPrisma(nextBalances.srd),
            balanceUsd: decimalToPrisma(nextBalances.usd),
            balanceEur: decimalToPrisma(nextBalances.eur)
          }
        });

        return tx.salesOrder.update({
          where: { id: input.orderId },
          data: {
            status: OrderStatus.CANCELED,
            canceledById: input.canceledById,
            canceledAt: new Date(),
            cancelReason: input.reason ?? null
          }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }
}
