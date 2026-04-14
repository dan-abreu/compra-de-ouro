# PASSO 1: REFATORAÇÃO BACKEND – ESPECIFICAÇÃO EXECUTIVA

**Status:** Pronto para implementação  
**Data:** 2026-04-13  
**Engenheiro:** [Your Name]  

---

## 🎯 OBJETIVO

Desacoplar o cálculo do total da ordem da taxa global de ouro puro (`goldPricePerGramInBase` no `DailyRate`). 

**Regra de Ouro:** O operador deve ter LIBERDADE TOTAL para digitar o "Preço Negociado por Grama" no momento exato da transação, e é esse valor que deve ser usado para calcular o total.

---

## 📌 MUDANÇAS NECESSÁRIAS

### 1️⃣ TIPOS (TypeScript)

**Arquivo:** `src/services/order-service.ts`

#### A. Atualizar `CreatePurchaseOrderInput`:

```typescript
export type CreatePurchaseOrderInput = {
  clientId: string;
  createdById: string;
  dailyRateId?: string;
  grossWeight: string;
  netWeight: string;
  purityPercentage: string;
  negotiatedPricePerGram: string;  // ← NOVO: Preço por grama negociado (OBRIGATÓRIO)
  paymentSplits: PurchaseSplitInput[];
};
```

#### B. Atualizar `CreateSalesOrderInput`:

```typescript
export type CreateSalesOrderInput = {
  supplierId: string;
  createdById: string;
  dailyRateId?: string;
  fineGoldWeightSold: string;
  negotiatedPricePerGram: string;  // ← NOVO: Preço por grama negociado (OBRIGATÓRIO)
  paymentSplits: SalesSplitInput[];
};
```

**Nota:** Remover campos antigos `negotiatedTotalSrd` e `negotiatedTotalInBaseCurrency` de `CreateSalesOrderInput` – o total será calculado, não recebido.

---

### 2️⃣ VALIDAÇÃO (Zod Schemas)

**Arquivo:** `src/routes/orders.ts`

#### A. Atualizar `createPurchaseSchema`:

```typescript
const createPurchaseSchema = z.object({
  clientId: z.string().min(1),
  createdById: z.string().min(1),
  dailyRateId: z.string().min(1).optional(),
  grossWeight: decimalString,
  netWeight: decimalString,
  purityPercentage: decimalString,
  negotiatedPricePerGram: decimalString,  // ← NOVO
  paymentSplits: z.array(splitSchema).min(1)
});
```

#### B. Atualizar `createSalesSchema`:

```typescript
const createSalesSchema = z.object({
  supplierId: z.string().min(1),
  createdById: z.string().min(1),
  dailyRateId: z.string().min(1).optional(),
  fineGoldWeightSold: decimalString,
  negotiatedPricePerGram: decimalString,  // ← NOVO (substitui negotiatedTotalSrd)
  paymentSplits: z.array(salesSplitSchema).min(1)
});
```

---

### 3️⃣ LÓGICA DE NEGÓCIO (Order Service)

**Arquivo:** `src/services/order-service.ts`

#### A. Refatorar `createPurchaseOrder()`:

**Mudança:** Usar `input.negotiatedPricePerGram` para calcular total, não `snapshot.goldPricePerGramInBase`

```typescript
async createPurchaseOrder(input: CreatePurchaseOrderInput) {
  ensureValidPurchaseSplits(input.paymentSplits);

  return this.prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // ... [resto do código até o cálculo do total]

      const grossWeight = q4(input.grossWeight) as DecimalInstance;
      const netWeight = q4(input.netWeight) as DecimalInstance;
      const purityPercentage = q4(input.purityPercentage) as DecimalInstance;

      const fineGoldWeight = q4(netWeight.mul(purityPercentage.div(100))) as DecimalInstance;
      
      // ⭐ MUDANÇA: usar negotiatedPricePerGram (não mais snapshot.goldPricePerGramInBase)
      const negotiatedPricePerGram = q4(input.negotiatedPricePerGram) as DecimalInstance;
      const totalAmountInBaseCurrency = q4(fineGoldWeight.mul(negotiatedPricePerGram)) as DecimalInstance;

      // ... [resto: validar splits, atualizar vault, criar order]

      // ⭐ MUDANÇA: preencher lockedGoldPricePerGramInBase com o valor negociado
      const order = await tx.purchaseOrder.create({
        data: {
          // ... [outros campos]
          lockedGoldPricePerGramInBase: decimalToPrisma(negotiatedPricePerGram),
          // ... [outros campos]
        }
      });

      // ... [resto: criar splits, atualizar vault]
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
```

#### B. Refatorar `createSalesOrder()`:

**Mudança:** Calcular `negotiatedTotalInBaseCurrency` a partir de `negotiatedPricePerGram`

```typescript
async createSalesOrder(input: CreateSalesOrderInput) {
  ensureValidSalesSplits(input.paymentSplits);

  return this.prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // ... [resto do código até o cálculo do total]

      const fineGoldWeightSold = q4(input.fineGoldWeightSold) as DecimalInstance;

      // ⭐ MUDANÇA: calcular total a partir de negotiatedPricePerGram
      const negotiatedPricePerGram = q4(input.negotiatedPricePerGram) as DecimalInstance;
      const negotiatedTotalInBaseCurrency = q4(fineGoldWeightSold.mul(negotiatedPricePerGram)) as DecimalInstance;

      // ... [resto: validar gold disponível, calcular splits de pagamento]

      // ⭐ MUDANÇA: preencher lockedGoldPricePerGramInBase com o valor negociado
      const order = await tx.salesOrder.create({
        data: {
          // ... [outros campos]
          negotiatedTotalInBaseCurrency: decimalToPrisma(negotiatedTotalInBaseCurrency),
          lockedGoldPricePerGramInBase: decimalToPrisma(negotiatedPricePerGram),
          // ... [outros campos]
        }
      });

      // ... [resto: criar splits, atualizar vault]
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
```

---

## 📊 IMPACTO DAS MUDANÇAS

| Componente | Antes | Depois | Motivo |
|---|---|---|---|
| **Total da Ordem (Purchase)** | `fineGoldWeight * dailyRate.goldPricePerGramInBase` | `fineGoldWeight * negotiatedPricePerGram` | Liberdade de preço do operador |
| **Total da Ordem (Sales)** | Recebido do frontend (`negotiatedTotalSrd` ou `negotiatedTotalInBaseCurrency`) | `fineGoldWeightSold * negotiatedPricePerGram` | Cálculo único e consistente |
| **Lock no Snapshot** | `lockedGoldPricePerGramInBase = dailyRate.goldPricePerGramInBase` | `lockedGoldPricePerGramInBase = negotiatedPricePerGram` | Registrar o preço efetivo utilizado |
| **DailyRate (`goldPricePerGramInBase`)** | Usado para cálculo de total | Não mais usado para cálculo de total | ✅ Mantém-se para referência/histórico |

---

## ✅ VALIDAÇÃO PÓS-MUDANÇA

### Testes Recomendados

1. **Compilação Backend:**
   ```bash
   npm run build
   ```
   Esperado: ✅ `Successfully compiled with 0 errors`

2. **Type-Safety:**
   - `CreatePurchaseOrderInput` com `negotiatedPricePerGram` obrigatório ✅
   - `CreateSalesOrderInput` com `negotiatedPricePerGram` obrigatório ✅
   - Endpoint recusa payloads sem esses campos ✅

3. **Funcionalidade:**
   - POST `/api/orders/purchase` com `negotiatedPricePerGram: "70"` → total calculado corretamente ✅
   - POST `/api/orders/sale` com `negotiatedPricePerGram: "75"` → total calculado corretamente ✅
   - `lockedGoldPricePerGramInBase` persistido no banco = valor negociado ✅

---

## 🚀 PRÓXIMO PASSO

Após sua aprovação desta refatoração, prosseguiremos para:

**PASSO 2: REFATORAÇÃO FRONTEND** → Adicionar campos de UI para:
- `Spot_Price_Oz` (Input)
- `Suggested_Local_Price` (Calculated read-only, fórmula: `(Spot_Price_Oz / 31.1035) * 0.90`)
- `Negotiated_Price_Per_Gram` (Input obrigatório)

---

**Avise quando PASSO 1 foi aplicado e compilou com sucesso! 🎯**
