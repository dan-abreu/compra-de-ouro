import { Currency, GoldState, OrderStatus, PaymentOrderType, Prisma, PrismaClient, RecordStatus, VaultLedgerEntryType } from "@prisma/client";

import { AML_KYC_THRESHOLD_USD, REQUIRE_KYC_ABOVE_10K } from "../config/compliance-config.js";
import { D, eq4, q4 } from "../lib/decimal.js";
import { DomainError } from "../lib/errors.js";

type DbClient = PrismaClient | Prisma.TransactionClient;
type DecimalInstance = ReturnType<typeof D>;

export type PurchasePaymentSplitInput = {
  currency: Currency;
  amount: string;
};

export type CreatePurchaseOrderInput = {
  supplierId?: string;
  isWalkIn?: boolean;
  createdById: string;
  dailyRateId?: string;
  goldState: GoldState;
  physicalWeight: string;
  purityPercentage: string;
  negotiatedPricePerGramUsd: string;
  totalOrderValueUsd: string;
  paymentSplits: PurchasePaymentSplitInput[];
};

type LockedRateSnapshot = {
  goldPricePerGramUsd: DecimalInstance;
  usdToSrdRate: DecimalInstance;
  eurToUsdRate: DecimalInstance;
};

const MAX_MANUAL_TOTAL_ADJUSTMENT_USD = D("0.0500") as DecimalInstance;

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

const ensureValidSplits = (splits: PurchasePaymentSplitInput[]) => {
  if (splits.length === 0) {
    throw new DomainError("At least one payment split is required.", 422, {
      code: "VALIDATION_ERROR",
      fieldErrors: { paymentSplits: "At least one payment split is required." }
    });
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

  if (!latest) {
    throw new DomainError("No DailyRate configured. Create one before orders.", 422, {
      code: "RATE_REQUIRED",
      fieldErrors: { dailyRateId: "No DailyRate configured. Create one before orders." }
    });
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
      balanceGoldGrams: new Prisma.Decimal("0.0000"),
      balanceUsd: new Prisma.Decimal("0.0000"),
      balanceEur: new Prisma.Decimal("0.0000"),
      balanceSrd: new Prisma.Decimal("0.0000"),
      openGoldGrams: new Prisma.Decimal("0.0000"),
      openGoldAcquisitionCostUsd: new Prisma.Decimal("0.0000")
    }
  });
};

const convertSplitToUsd = (
  split: PurchasePaymentSplitInput,
  snapshot: LockedRateSnapshot
): DecimalInstance => {
  const amount = q4(split.amount) as DecimalInstance;

  if (split.currency === Currency.USD) {
    return amount;
  }

  if (split.currency === Currency.SRD) {
    if (snapshot.usdToSrdRate.lte(0)) {
      throw new DomainError("Invalid USD/SRD rate snapshot.", 422);
    }
    return q4(amount.div(snapshot.usdToSrdRate)) as DecimalInstance;
  }

  if (split.currency === Currency.EUR) {
    if (snapshot.eurToUsdRate.lte(0)) {
      throw new DomainError("Invalid EUR/USD rate snapshot.", 422);
    }
    return q4(amount.mul(snapshot.eurToUsdRate)) as DecimalInstance;
  }

  throw new DomainError("Unsupported split currency.", 422, {
    code: "VALIDATION_ERROR",
    fieldErrors: { paymentSplits: "Unsupported split currency." }
  });
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
    ensureValidSplits(input.paymentSplits);

    return this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const rate = await getLockedRate(tx, input.dailyRateId);
        const vault = await getOrCreateMainVault(tx);
        const isWalkIn = Boolean(input.isWalkIn);

        const [supplier, operator] = await Promise.all([
          isWalkIn || !input.supplierId
            ? Promise.resolve(null)
            : tx.supplier.findUnique({ where: { id: input.supplierId } }),
          tx.user.findUnique({ where: { id: input.createdById } })
        ]);

        if (!isWalkIn && !supplier) {
          throw new DomainError("Fornecedor invalido.", 422, {
            code: "SUPPLIER_NOT_FOUND",
            fieldErrors: { supplierId: "Fornecedor selecionado nao existe." }
          });
        }

        if (!isWalkIn && supplier && supplier.status !== RecordStatus.ACTIVE) {
          throw new DomainError("Fornecedor bloqueado para operacoes.", 409, {
            code: "SUPPLIER_BLOCKED",
            fieldErrors: { supplierId: "Fornecedor bloqueado para operacoes." }
          });
        }

        if (!operator || operator.status !== RecordStatus.ACTIVE) {
          throw new DomainError("Operador invalido ou inativo.", 422, {
            code: "OPERATOR_INVALID",
            fieldErrors: { createdById: "Operador invalido ou inativo." }
          });
        }

        const snapshot: LockedRateSnapshot = {
          goldPricePerGramUsd: prismaToDecimal(rate.goldPricePerGramUsd),
          usdToSrdRate: prismaToDecimal(rate.usdToSrdRate),
          eurToUsdRate: prismaToDecimal(rate.eurToUsdRate)
        };

        const physicalWeight = q4(input.physicalWeight) as DecimalInstance;
        const purityPercentage = q4(input.purityPercentage) as DecimalInstance;
        const negotiatedPricePerGramUsd = q4(input.negotiatedPricePerGramUsd) as DecimalInstance;
        const totalOrderValueUsd = q4(input.totalOrderValueUsd) as DecimalInstance;

        ensurePositive(physicalWeight, "physicalWeight", "Physical weight must be greater than zero.");
        ensurePositive(purityPercentage, "purityPercentage", "Purity percentage must be greater than zero.");
        ensurePositive(negotiatedPricePerGramUsd, "negotiatedPricePerGram", "Negotiated price per gram must be greater than zero.");
        ensurePositive(totalOrderValueUsd, "totalOrderValueUsd", "Total order value must be greater than zero.");

        if (purityPercentage.gt(100)) {
          throw new DomainError("purityPercentage cannot be greater than 100.", 422, {
            code: "VALIDATION_ERROR",
            fieldErrors: { purityPercentage: "Purity percentage cannot be greater than 100." }
          });
        }

        const calculatedOrderValueUsd = q4(physicalWeight.mul(negotiatedPricePerGramUsd)) as DecimalInstance;
        const totalAmountUsd = totalOrderValueUsd;

        ensurePositive(totalAmountUsd, "negotiatedPricePerGram", "Total order value must be greater than zero.");

        const needsKycDueToThreshold = isWalkIn && totalAmountUsd.gte(AML_KYC_THRESHOLD_USD);
        if (needsKycDueToThreshold && REQUIRE_KYC_ABOVE_10K) {
          throw new DomainError("Compliance KYC obrigatorio para avulso acima de USD 10.000.", 403, {
            code: "KYC_REQUIRED_BY_POLICY",
            fieldErrors: { isWalkIn: "Politica ativa impede finalizar avulso acima de USD 10.000." }
          });
        }

        const complianceOverride = needsKycDueToThreshold && !REQUIRE_KYC_ABOVE_10K;

        if (!calculatedOrderValueUsd.gt(0)) {
          throw new DomainError("Calculated order value must be greater than zero.", 422, {
            code: "VALIDATION_ERROR",
            fieldErrors: { negotiatedPricePerGram: "Calculated order value must be greater than zero." }
          });
        }

        const manualAdjustmentAbsUsd = q4(totalAmountUsd.sub(calculatedOrderValueUsd).abs()) as DecimalInstance;
        if (manualAdjustmentAbsUsd.gt(MAX_MANUAL_TOTAL_ADJUSTMENT_USD)) {
          throw new DomainError(
            "Total da ordem invalido: o valor deve ser baseado em Peso do Ouro Queimado x Preco Negociado, com apenas ajuste de centavos.",
            422,
            {
              code: "TOTAL_OVERRIDE_OUT_OF_RANGE",
              fieldErrors: {
                totalOrderValueUsd:
                  "Ajuste manual excede o limite permitido. Confira Peso Fisico x Preco Negociado."
              }
            }
          );
        }

        const acquisitionCostUsd = totalAmountUsd;

        const splitRows = input.paymentSplits.map((split) => {
          const amount = q4(split.amount) as DecimalInstance;
          return {
            currency: split.currency,
            amount,
            convertedValueUsd: convertSplitToUsd(split, snapshot)
          };
        });

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
            supplierId: isWalkIn ? null : input.supplierId,
            isWalkIn,
            complianceOverride,
            createdById: input.createdById,
            goldState: input.goldState,
            physicalWeight: decimalToPrisma(physicalWeight),
            purityPercentage: decimalToPrisma(purityPercentage),
            lockedGoldPricePerGramUsd: decimalToPrisma(negotiatedPricePerGramUsd),
            lockedUsdToSrdRate: decimalToPrisma(snapshot.usdToSrdRate),
            lockedEurToUsdRate: decimalToPrisma(snapshot.eurToUsdRate),
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
