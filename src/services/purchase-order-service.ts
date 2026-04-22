import { Currency, GoldState, OrderStatus, PaymentOrderType, Prisma, PrismaClient, RecordStatus, VaultLedgerEntryType } from "@prisma/client";

import { AML_KYC_THRESHOLD_USD, REQUIRE_KYC_ABOVE_10K } from "../config/compliance-config.js";
import { D, eq4, q4 } from "../lib/decimal.js";
import { DomainError, isPrismaSchemaOutOfSyncError } from "../lib/errors.js";
import { calculateEffectiveFineGoldWeight, calculateOrderTotalUsd } from "../lib/order-pricing.js";
import { ensureTenantSchemaForTrading } from "../lib/tenant-schema-repair.js";
import { getOrCreateMainVault } from "../lib/vault-utils.js";
import {
  convertSplitToUsd,
  ensureValidSplits,
  LockedRateSnapshot,
  PaymentSplitInput
} from "./split-conversion-service.js";

type DbClient = PrismaClient | Prisma.TransactionClient;
type DecimalInstance = ReturnType<typeof D>;

export type PurchasePaymentSplitInput = {
  currency: Currency;
  amount: string;
  manualExchangeRate?: string;
};

export type CreatePurchaseOrderInput = {
  clientId?: string;
  isWalkIn?: boolean;
  createdById: string;
  dailyRateId?: string;
  goldState: GoldState;
  physicalWeight: string;
  purityPercentage: string;
  negotiatedPricePerGramUsd: string;
  paymentSplits: PurchasePaymentSplitInput[];
};

type PurchaseRateSnapshot = LockedRateSnapshot & {
  goldPricePerGramUsd: DecimalInstance;
};

const decimalToPrisma = (value: DecimalInstance): Prisma.Decimal => {
  return new Prisma.Decimal(q4(value).toFixed(4));
};

const prismaToDecimal = (value: Prisma.Decimal | string | number): DecimalInstance => {
  return D(value) as DecimalInstance;
};

const assertNonNegative = (value: DecimalInstance, label: string) => {
  if (value.isNegative()) {
    throw new DomainError(`Insufficient ${label}.`, 409);
  }
};

const getLockedRate = async (tx: DbClient, dailyRateId?: string) => {
  if (dailyRateId) {
    const rate = await tx.dailyRate.findUnique({ where: { id: dailyRateId } });
    if (!rate) {
      throw new DomainError("Daily rate not found.", 404, {
        code: "RATE_NOT_FOUND",
        fieldErrors: { dailyRateId: "Daily rate not found." }
      });
    }
    return rate;
  }

  const latest = await tx.dailyRate.findFirst({
    orderBy: [{ rateDate: "desc" }, { createdAt: "desc" }]
  });

  return latest;
};

const ensurePositive = (value: DecimalInstance, field: string, message: string) => {
  if (!value.gt(0)) {
    throw new DomainError(message, 422, {
      code: "VALIDATION_ERROR",
      fieldErrors: { [field]: message }
    });
  }
};

export class PurchaseOrderService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreatePurchaseOrderInput) {
    try {
      return await this.createInTransaction(input);
    } catch (error) {
      if (!isPrismaSchemaOutOfSyncError(error)) {
        throw error;
      }

      await ensureTenantSchemaForTrading(this.prisma);
      return this.createInTransaction(input);
    }
  }

  private async createInTransaction(input: CreatePurchaseOrderInput) {
    ensureValidSplits(input.paymentSplits as PaymentSplitInput[]);

    return this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const rate = await getLockedRate(tx, input.dailyRateId);
        const vault = await getOrCreateMainVault(tx);
        const isWalkIn = Boolean(input.isWalkIn);

        const [client, operator] = await Promise.all([
          isWalkIn || !input.clientId
            ? Promise.resolve(null)
            : tx.client.findUnique({ where: { id: input.clientId } }),
          tx.user.findUnique({ where: { id: input.createdById } })
        ]);

        if (!isWalkIn && !client) {
          throw new DomainError("Cliente invalido.", 422, {
            code: "CLIENT_NOT_FOUND",
            fieldErrors: { clientId: "Cliente selecionado nao existe." }
          });
        }

        if (!isWalkIn && client && client.status !== RecordStatus.ACTIVE) {
          throw new DomainError("Cliente bloqueado para operacoes.", 409, {
            code: "CLIENT_BLOCKED",
            fieldErrors: { clientId: "Cliente bloqueado para operacoes." }
          });
        }

        if (!operator || operator.status !== RecordStatus.ACTIVE) {
          throw new DomainError("Operador invalido ou inativo.", 422, {
            code: "OPERATOR_INVALID",
            fieldErrors: { createdById: "Operador invalido ou inativo." }
          });
        }

        const snapshot: PurchaseRateSnapshot | null = rate
          ? {
              goldPricePerGramUsd: prismaToDecimal(rate.goldPricePerGramUsd),
              usdToSrdRate: prismaToDecimal(rate.usdToSrdRate),
              eurToUsdRate: prismaToDecimal(rate.eurToUsdRate)
            }
          : null;

        const physicalWeight = q4(input.physicalWeight) as DecimalInstance;
        const purityPercentage = q4(input.purityPercentage) as DecimalInstance;
        const negotiatedPricePerGramUsd = q4(input.negotiatedPricePerGramUsd) as DecimalInstance;

        ensurePositive(physicalWeight, "physicalWeight", "Physical weight must be greater than zero.");
        ensurePositive(purityPercentage, "purityPercentage", "Purity percentage must be greater than zero.");
        ensurePositive(negotiatedPricePerGramUsd, "negotiatedPricePerGram", "Negotiated price per gram must be greater than zero.");

        if (purityPercentage.gt(100)) {
          throw new DomainError("purityPercentage cannot be greater than 100.", 422, {
            code: "VALIDATION_ERROR",
            fieldErrors: { purityPercentage: "Purity percentage cannot be greater than 100." }
          });
        }

        const fineGoldWeight = calculateEffectiveFineGoldWeight(physicalWeight, purityPercentage);
        const totalAmountUsd = calculateOrderTotalUsd(physicalWeight, purityPercentage, negotiatedPricePerGramUsd);

        ensurePositive(totalAmountUsd, "negotiatedPricePerGram", "Total order value must be greater than zero.");

        const needsKycDueToThreshold = isWalkIn && totalAmountUsd.gte(AML_KYC_THRESHOLD_USD);
        if (needsKycDueToThreshold && REQUIRE_KYC_ABOVE_10K) {
          throw new DomainError("Compliance KYC obrigatorio para avulso acima de USD 10.000.", 403, {
            code: "KYC_REQUIRED_BY_POLICY",
            fieldErrors: { isWalkIn: "Politica ativa impede finalizar avulso acima de USD 10.000." }
          });
        }

        const complianceOverride = needsKycDueToThreshold && !REQUIRE_KYC_ABOVE_10K;

        const acquisitionCostUsd = totalAmountUsd;

        const splitRows = input.paymentSplits.map((split) => {
          const amount = q4(split.amount) as DecimalInstance;
          return {
            currency: split.currency,
            amount,
            manualExchangeRate: split.manualExchangeRate ? (q4(split.manualExchangeRate) as DecimalInstance) : null,
            convertedValueUsd: convertSplitToUsd(split, snapshot)
          };
        });

        const lockedUsdToSrdRate =
          snapshot?.usdToSrdRate ?? splitRows.find((split) => split.currency === Currency.SRD && split.manualExchangeRate)?.manualExchangeRate ?? (D("1") as DecimalInstance);
        const lockedEurToUsdRate =
          snapshot?.eurToUsdRate ?? splitRows.find((split) => split.currency === Currency.EUR && split.manualExchangeRate)?.manualExchangeRate ?? (D("1") as DecimalInstance);

        const totalSplitUsd = splitRows.reduce(
          (acc, split) => q4(acc.add(split.convertedValueUsd)) as DecimalInstance,
          D(0) as DecimalInstance
        );

        if (!eq4(totalSplitUsd, totalAmountUsd)) {
          throw new DomainError("Matematica Inconsistente: payment split sum does not match total order value in USD.", 422, {
            code: "MATH_INCONSISTENT",
            fieldErrors: { paymentSplits: "Os pagamentos nao fecham exatamente 100% do valor da ordem." }
          });
        }

        const currentBalances = {
          usd: prismaToDecimal(vault.balanceUsd),
          eur: prismaToDecimal(vault.balanceEur),
          srd: prismaToDecimal(vault.balanceSrd),
          gold: prismaToDecimal(vault.balanceGoldGrams),
          openGold: prismaToDecimal(vault.openGoldGrams),
          openGoldAcquisitionCostUsd: prismaToDecimal(vault.openGoldAcquisitionCostUsd)
        };

        let nextUsd = currentBalances.usd;
        let nextEur = currentBalances.eur;
        let nextSrd = currentBalances.srd;

        for (const split of splitRows) {
          if (split.currency === Currency.USD) nextUsd = q4(nextUsd.sub(split.amount)) as DecimalInstance;
          if (split.currency === Currency.EUR) nextEur = q4(nextEur.sub(split.amount)) as DecimalInstance;
          if (split.currency === Currency.SRD) nextSrd = q4(nextSrd.sub(split.amount)) as DecimalInstance;
        }

        assertNonNegative(nextUsd, "USD balance");
        assertNonNegative(nextEur, "EUR balance");
        assertNonNegative(nextSrd, "SRD balance");

        const nextGoldBalance = q4(currentBalances.gold.add(physicalWeight)) as DecimalInstance;
        const nextOpenGold = q4(currentBalances.openGold.add(physicalWeight)) as DecimalInstance;
        const nextOpenGoldAcquisitionCostUsd = q4(
          currentBalances.openGoldAcquisitionCostUsd.add(acquisitionCostUsd)
        ) as DecimalInstance;

        const order = await tx.purchaseOrder.create({
          data: {
            status: OrderStatus.FINALIZED,
            clientId: isWalkIn ? null : input.clientId,
            isWalkIn,
            complianceOverride,
            createdById: input.createdById,
            goldState: input.goldState,
            physicalWeight: decimalToPrisma(physicalWeight),
            purityPercentage: decimalToPrisma(purityPercentage),
            lockedGoldPricePerGramUsd: decimalToPrisma(negotiatedPricePerGramUsd),
            lockedUsdToSrdRate: decimalToPrisma(lockedUsdToSrdRate),
            lockedEurToUsdRate: decimalToPrisma(lockedEurToUsdRate),
            totalAmountUsd: decimalToPrisma(totalAmountUsd),
            acquisitionCostUsd: decimalToPrisma(acquisitionCostUsd)
          }
        });

        await tx.vaultLedger.create({
          data: {
            vaultCode: vault.code,
            entryType: VaultLedgerEntryType.PURCHASE_IN,
            goldState: input.goldState,
            currency: Currency.USD,
            physicalWeight: decimalToPrisma(physicalWeight),
            purityPercentage: decimalToPrisma(purityPercentage),
            totalAmountUsd: decimalToPrisma(totalAmountUsd),
            purchaseOrderId: order.id
          }
        });

        await tx.paymentSplit.createMany({
          data: splitRows.map((split) => ({
            orderType: PaymentOrderType.PURCHASE,
            purchaseOrderId: order.id,
            currency: split.currency,
            amount: decimalToPrisma(split.amount),
            convertedValueUsd: decimalToPrisma(split.convertedValueUsd)
          }))
        });

        await tx.vault.update({
          where: { id: vault.id },
          data: {
            balanceGoldGrams: decimalToPrisma(nextGoldBalance),
            balanceUsd: decimalToPrisma(nextUsd),
            balanceEur: decimalToPrisma(nextEur),
            balanceSrd: decimalToPrisma(nextSrd),
            openGoldGrams: decimalToPrisma(nextOpenGold),
            openGoldAcquisitionCostUsd: decimalToPrisma(nextOpenGoldAcquisitionCostUsd)
          }
        });

        return order;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }
}
