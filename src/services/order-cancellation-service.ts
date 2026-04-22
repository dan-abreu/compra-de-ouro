import {
  Currency,
  OrderStatus,
  PaymentOrderType,
  Prisma,
  PrismaClient,
  RecordStatus,
  VaultLedgerEntryType
} from "@prisma/client";

import { D, q4 } from "../lib/decimal.js";
import { DomainError } from "../lib/errors.js";
import { verifyPassword } from "../lib/password.js";
import { getOrderCancelSecurityConfig } from "../lib/security-config.js";
import { getOrCreateMainVault } from "../lib/vault-utils.js";

type DecimalInstance = ReturnType<typeof D>;

type CancelOrderInput = {
  orderId: string;
  canceledById: string;
  securityPassword: string;
  reason?: string;
};

const decimalToPrisma = (value: DecimalInstance): Prisma.Decimal => {
  return new Prisma.Decimal(q4(value).toFixed(4));
};

const prismaToDecimal = (value: Prisma.Decimal | string | number): DecimalInstance => {
  return D(value) as DecimalInstance;
};

const ensureNotNegative = (value: DecimalInstance, field: string, message: string) => {
  if (value.isNegative()) {
    throw new DomainError(message, 409, {
      code: "INSUFFICIENT_BALANCE",
      fieldErrors: { [field]: message }
    });
  }
};

const emptyReasonToNull = (reason?: string) => {
  if (!reason) {
    return null;
  }

  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export class OrderCancellationService {
  constructor(private readonly prisma: PrismaClient) {}

  private async validateSecurityPassword(
    tx: Prisma.TransactionClient,
    userId: string,
    securityPassword: string
  ) {
    const user = await tx.user.findUnique({ where: { id: userId } });

    if (!user || user.status !== RecordStatus.ACTIVE) {
      throw new DomainError("Operador invalido ou inativo.", 401, {
        code: "AUTH_REQUIRED",
        fieldErrors: { securityPassword: "Operador invalido ou inativo." }
      });
    }

    const securityConfig = await getOrderCancelSecurityConfig(tx);
    const securityHash = securityConfig?.value?.trim() || "";
    if (!securityHash) {
      throw new DomainError("Senha de cancelamento ainda nao configurada pelo admin.", 409, {
        code: "CANCEL_SECURITY_PASSWORD_NOT_CONFIGURED",
        fieldErrors: {
          securityPassword: "O admin precisa configurar a senha de cancelamento nas configuracoes."
        }
      });
    }

    const valid = verifyPassword({
      password: securityPassword,
      storedHash: securityHash
    });

    if (!valid) {
      throw new DomainError("Senha de seguranca invalida.", 403, {
        code: "INVALID_SECURITY_PASSWORD",
        fieldErrors: { securityPassword: "Senha de seguranca invalida." }
      });
    }
  }

  async cancelPurchase(input: CancelOrderInput) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.validateSecurityPassword(tx, input.canceledById, input.securityPassword);

        const order = await tx.purchaseOrder.findUnique({ where: { id: input.orderId } });
        if (!order) {
          throw new DomainError("Ordem de compra nao encontrada.", 404, {
            code: "ORDER_NOT_FOUND",
            fieldErrors: { orderId: "Ordem de compra nao encontrada." }
          });
        }

        if (order.status === OrderStatus.CANCELED) {
          throw new DomainError("Ordem de compra ja esta cancelada.", 409, {
            code: "ORDER_ALREADY_CANCELED",
            fieldErrors: { orderId: "A ordem de compra ja esta cancelada." }
          });
        }

        if (order.status !== OrderStatus.FINALIZED) {
          throw new DomainError("Somente ordens finalizadas podem ser canceladas.", 409, {
            code: "ORDER_NOT_FINALIZED",
            fieldErrors: { orderId: "Somente ordens finalizadas podem ser canceladas." }
          });
        }

        const [vault, splits] = await Promise.all([
          getOrCreateMainVault(tx),
          tx.paymentSplit.findMany({
            where: {
              orderType: PaymentOrderType.PURCHASE,
              purchaseOrderId: order.id
            }
          })
        ]);

        const currentUsd = prismaToDecimal(vault.balanceUsd);
        const currentEur = prismaToDecimal(vault.balanceEur);
        const currentSrd = prismaToDecimal(vault.balanceSrd);
        const currentGold = prismaToDecimal(vault.balanceGoldGrams);
        const currentOpenGold = prismaToDecimal(vault.openGoldGrams);
        const currentOpenGoldCostUsd = prismaToDecimal(vault.openGoldAcquisitionCostUsd);

        let usdDelta = D(0) as DecimalInstance;
        let eurDelta = D(0) as DecimalInstance;
        let srdDelta = D(0) as DecimalInstance;

        for (const split of splits) {
          if (split.currency === Currency.USD) {
            usdDelta = q4(usdDelta.add(split.amount)) as DecimalInstance;
          }
          if (split.currency === Currency.EUR) {
            eurDelta = q4(eurDelta.add(split.amount)) as DecimalInstance;
          }
          if (split.currency === Currency.SRD) {
            srdDelta = q4(srdDelta.add(split.amount)) as DecimalInstance;
          }
        }

        const nextGold = q4(currentGold.sub(order.physicalWeight)) as DecimalInstance;
        const nextOpenGold = q4(currentOpenGold.sub(order.physicalWeight)) as DecimalInstance;
        const nextOpenGoldCostUsd = q4(currentOpenGoldCostUsd.sub(order.acquisitionCostUsd)) as DecimalInstance;

        ensureNotNegative(nextGold, "physicalWeight", "Nao ha ouro suficiente para estornar esta compra.");
        ensureNotNegative(nextOpenGold, "physicalWeight", "Nao ha ouro aberto suficiente para estornar esta compra.");
        ensureNotNegative(nextOpenGoldCostUsd, "orderId", "Nao ha custo aberto suficiente para estornar esta compra.");

        await tx.vault.update({
          where: { id: vault.id },
          data: {
            balanceUsd: decimalToPrisma(q4(currentUsd.add(usdDelta)) as DecimalInstance),
            balanceEur: decimalToPrisma(q4(currentEur.add(eurDelta)) as DecimalInstance),
            balanceSrd: decimalToPrisma(q4(currentSrd.add(srdDelta)) as DecimalInstance),
            balanceGoldGrams: decimalToPrisma(nextGold),
            openGoldGrams: decimalToPrisma(nextOpenGold),
            openGoldAcquisitionCostUsd: decimalToPrisma(nextOpenGoldCostUsd)
          }
        });

        await tx.vaultLedger.create({
          data: {
            vaultCode: vault.code,
            entryType: VaultLedgerEntryType.ADJUSTMENT,
            goldState: order.goldState,
            currency: Currency.USD,
            physicalWeight: decimalToPrisma(q4(D(order.physicalWeight).neg()) as DecimalInstance),
            purityPercentage: order.purityPercentage,
            totalAmountUsd: decimalToPrisma(q4(D(order.totalAmountUsd).neg()) as DecimalInstance),
            purchaseOrderId: order.id,
            notes: `Cancelamento de compra${input.reason ? `: ${input.reason}` : ""}`
          }
        });

        return tx.purchaseOrder.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELED,
            canceledAt: new Date(),
            canceledById: input.canceledById,
            cancelReason: emptyReasonToNull(input.reason)
          }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async cancelSale(input: CancelOrderInput) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.validateSecurityPassword(tx, input.canceledById, input.securityPassword);

        const order = await tx.salesOrder.findUnique({ where: { id: input.orderId } });
        if (!order) {
          throw new DomainError("Ordem de venda nao encontrada.", 404, {
            code: "ORDER_NOT_FOUND",
            fieldErrors: { orderId: "Ordem de venda nao encontrada." }
          });
        }

        if (order.status === OrderStatus.CANCELED) {
          throw new DomainError("Ordem de venda ja esta cancelada.", 409, {
            code: "ORDER_ALREADY_CANCELED",
            fieldErrors: { orderId: "A ordem de venda ja esta cancelada." }
          });
        }

        if (order.status !== OrderStatus.FINALIZED) {
          throw new DomainError("Somente ordens finalizadas podem ser canceladas.", 409, {
            code: "ORDER_NOT_FINALIZED",
            fieldErrors: { orderId: "Somente ordens finalizadas podem ser canceladas." }
          });
        }

        const [vault, splits] = await Promise.all([
          getOrCreateMainVault(tx),
          tx.paymentSplit.findMany({
            where: {
              orderType: PaymentOrderType.SALE,
              salesOrderId: order.id
            }
          })
        ]);

        const currentUsd = prismaToDecimal(vault.balanceUsd);
        const currentEur = prismaToDecimal(vault.balanceEur);
        const currentSrd = prismaToDecimal(vault.balanceSrd);
        const currentGold = prismaToDecimal(vault.balanceGoldGrams);
        const currentOpenGold = prismaToDecimal(vault.openGoldGrams);
        const currentOpenGoldCostUsd = prismaToDecimal(vault.openGoldAcquisitionCostUsd);

        let usdDelta = D(0) as DecimalInstance;
        let eurDelta = D(0) as DecimalInstance;
        let srdDelta = D(0) as DecimalInstance;

        for (const split of splits) {
          if (split.currency === Currency.USD) {
            usdDelta = q4(usdDelta.add(split.amount)) as DecimalInstance;
          }
          if (split.currency === Currency.EUR) {
            eurDelta = q4(eurDelta.add(split.amount)) as DecimalInstance;
          }
          if (split.currency === Currency.SRD) {
            srdDelta = q4(srdDelta.add(split.amount)) as DecimalInstance;
          }
        }

        const nextUsd = q4(currentUsd.sub(usdDelta)) as DecimalInstance;
        const nextEur = q4(currentEur.sub(eurDelta)) as DecimalInstance;
        const nextSrd = q4(currentSrd.sub(srdDelta)) as DecimalInstance;

        ensureNotNegative(nextUsd, "paymentSplits", "Saldo USD insuficiente para estornar esta venda.");
        ensureNotNegative(nextEur, "paymentSplits", "Saldo EUR insuficiente para estornar esta venda.");
        ensureNotNegative(nextSrd, "paymentSplits", "Saldo SRD insuficiente para estornar esta venda.");

        const costForSaleUsd = q4(D(order.averageAcquisitionCostUsd).mul(D(order.physicalWeight))) as DecimalInstance;
        const nextGold = q4(currentGold.add(order.physicalWeight)) as DecimalInstance;
        const nextOpenGold = q4(currentOpenGold.add(order.physicalWeight)) as DecimalInstance;
        const nextOpenGoldCostUsd = q4(currentOpenGoldCostUsd.add(costForSaleUsd)) as DecimalInstance;

        await tx.vault.update({
          where: { id: vault.id },
          data: {
            balanceUsd: decimalToPrisma(nextUsd),
            balanceEur: decimalToPrisma(nextEur),
            balanceSrd: decimalToPrisma(nextSrd),
            balanceGoldGrams: decimalToPrisma(nextGold),
            openGoldGrams: decimalToPrisma(nextOpenGold),
            openGoldAcquisitionCostUsd: decimalToPrisma(nextOpenGoldCostUsd)
          }
        });

        await tx.vaultLedger.create({
          data: {
            vaultCode: vault.code,
            entryType: VaultLedgerEntryType.ADJUSTMENT,
            goldState: order.goldState,
            currency: Currency.USD,
            physicalWeight: order.physicalWeight,
            purityPercentage: order.purityPercentage,
            totalAmountUsd: decimalToPrisma(costForSaleUsd),
            salesOrderId: order.id,
            notes: `Cancelamento de venda${input.reason ? `: ${input.reason}` : ""}`
          }
        });

        return tx.salesOrder.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELED,
            canceledAt: new Date(),
            canceledById: input.canceledById,
            cancelReason: emptyReasonToNull(input.reason)
          }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }
}
