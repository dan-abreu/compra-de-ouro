# Analise Estatica Profunda - Clean Code

Data: 2026-04-22
Escopo analisado: src/**/*.ts e web/**/*.{ts,tsx}
Foco: DRY, Dead Code e Code Smells

## Passo a passo gravado

1. Mapeamento estrutural completo dos arquivos TypeScript/TSX no backend e frontend.
2. Busca semantica de duplicacoes, dead code e smells em todo o workspace.
3. Validacao manual dos pontos criticos por leitura direta de arquivos.
4. Busca textual de funcoes/schema repetidos para confirmar violacoes DRY.
5. Checagem estrita de TypeScript com noUnusedLocals/noUnusedParameters para dead code.
6. Consolidacao dos achados com severidade, evidencia e sugestoes de refatoracao.

## Achados priorizados

### 1) DRY - mapeamento de erros Zod duplicado em 7 rotas (Alta)

Arquivos:
- src/routes/orders.ts
- src/routes/rates.ts
- src/routes/loan-books.ts
- src/routes/gold-transit.ts
- src/routes/opex.ts
- src/routes/clients.ts
- src/routes/suppliers.ts

Problema:
A funcao mapZodIssuesToFieldErrors foi reescrita em varias rotas com a mesma logica.

Sugestao de codigo corrigido:

```ts
// src/lib/validation.ts
import { z } from "zod";
import type { FieldErrorMap } from "./errors.js";

export const mapZodIssuesToFieldErrors = (issues: z.ZodIssue[]): FieldErrorMap => {
  return issues.reduce<FieldErrorMap>((acc, issue) => {
    const path = issue.path.join(".");
    if (path && !acc[path]) {
      acc[path] = issue.message;
    }
    return acc;
  }, {});
};
```

```ts
// exemplo de uso em route
import { mapZodIssuesToFieldErrors } from "../lib/validation.js";
```

---

### 2) DRY - decimalString duplicado em 5 rotas (Alta)

Arquivos:
- src/routes/orders.ts
- src/routes/rates.ts
- src/routes/loan-books.ts
- src/routes/gold-transit.ts
- src/routes/opex.ts

Problema:
Schema de decimal com regex repetido em varios pontos.

Sugestao de codigo corrigido:

```ts
// src/lib/schemas.ts
import { z } from "zod";

export const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Must be a positive decimal string with up to 4 places");
```

```ts
// nas rotas
import { decimalString } from "../lib/schemas.js";
```

---

### 3) DRY - getOrCreateMainVault repetido em 4 lugares (Alta)

Arquivos:
- src/routes/vault.ts
- src/services/purchase-order-service.ts
- src/services/sales-order-service.ts
- src/services/order-cancellation-service.ts

Problema:
Mesmo comportamento de criar/retornar cofre principal distribuido em multiplas implementacoes.

Sugestao de codigo corrigido:

```ts
// src/lib/vault-utils.ts
import { Prisma } from "@prisma/client";

type VaultDb = {
  vault: {
    findUnique: (args: { where: { code: string } }) => Promise<any>;
    create: (args: { data: any }) => Promise<any>;
  };
};

export const getOrCreateMainVault = async (db: VaultDb) => {
  const existing = await db.vault.findUnique({ where: { code: "MAIN" } });
  if (existing) return existing;

  return db.vault.create({
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
```

---

### 4) DRY - ensureValidSplits e convertSplitToUsd duplicados em purchase/sales service (Alta)

Arquivos:
- src/services/purchase-order-service.ts
- src/services/sales-order-service.ts

Problema:
Regras de validacao e conversao de splits quase identicas em dois services.

Sugestao de codigo corrigido:

```ts
// src/services/split-conversion-service.ts
import { D } from "../lib/decimal.js";
import { DomainError } from "../lib/errors.js";

type Split = {
  currency: "USD" | "EUR" | "SRD";
  amount: string;
  manualExchangeRate?: string;
};

type RateSnapshot = {
  eurToUsdRate: string;
  usdToSrdRate: string;
};

export const ensureValidSplits = (splits: Split[]) => {
  if (!splits.length) {
    throw new DomainError("Pelo menos um split de pagamento e obrigatorio.", 422, {
      code: "VALIDATION_ERROR",
      fieldErrors: { paymentSplits: "Informe ao menos um split." }
    });
  }
};

export const convertSplitToUsd = (split: Split, rate: RateSnapshot) => {
  const amount = D(split.amount);
  if (split.currency === "USD") return amount;

  if (split.currency === "EUR") {
    const fx = D(split.manualExchangeRate || rate.eurToUsdRate);
    return amount.mul(fx);
  }

  const usdToSrd = D(split.manualExchangeRate || rate.usdToSrdRate);
  return usdToSrd.eq(0) ? D(0) : amount.div(usdToSrd);
};
```

---

### 5) Dead Code - import nao usado em Purchase/Sales (Alta)

Arquivos:
- web/components/PurchasePage.tsx
- web/components/SalesPage.tsx

Problema confirmado por checagem estrita TS:
- DailyRate importado e nao utilizado.

Sugestao de codigo corrigido:

```ts
// antes
import { DailyRate, useDailyRate } from "@/components/trade/useDailyRate";

// depois
import { useDailyRate } from "@/components/trade/useDailyRate";
```

---

### 6) DRY - componente de dica HelpHint duplicado em 4 arquivos (Media)

Arquivos:
- web/components/trade/HelpHint.tsx
- web/components/DashboardClient.tsx
- web/app/extrato/page.tsx
- web/components/TreasuryDashboard.tsx (HelpBalloon com mesmo comportamento)

Problema:
Mesmo componente visual e comportamento repetido.

Sugestao de codigo corrigido:

```ts
// manter apenas
// web/components/trade/HelpHint.tsx

// importar onde necessario
import { HelpHint } from "@/components/trade/HelpHint";
```

---

### 7) Code Smell - arquivos gigantes com responsabilidades misturadas (Media)

Arquivos e tamanho:
- web/components/TreasuryDashboard.tsx: 839 linhas
- web/components/app-shell.tsx: 644 linhas
- web/components/PurchasePage.tsx: 517 linhas
- web/components/SalesPage.tsx: 515 linhas
- src/services/sales-order-service.ts: 350 linhas
- src/services/purchase-order-service.ts: 327 linhas

Problema:
Componentes/services fazem muita coisa ao mesmo tempo (render, estado, regra de negocio, transformacao e IO).

Sugestao de estrutura corrigida:
- App shell: extrair LeftNavRail, RightMarketRail, MobileQuickNav, MarketCard e utils.
- Purchase/Sales: criar TradeOrderForm base com configuracao por tipo.
- Services de ordem: extrair regras comuns em utilitarios (split, vault, validacao).

---

### 8) Code Smell - nomenclatura de validadores inconsistente (Media)

Arquivos:
- src/routes/rates.ts (assertPositiveDecimal)
- src/services/purchase-order-service.ts (ensurePositive)
- src/services/sales-order-service.ts (ensurePositive)

Problema:
Mesma intencao com nomes diferentes, aumentando carga cognitiva.

Sugestao de codigo corrigido:

```ts
// src/lib/decimal-validation.ts
import { D } from "./decimal.js";
import { DomainError } from "./errors.js";

export const ensurePositiveDecimal = (value: string, field: string, label: string) => {
  if (D(value).lte(0)) {
    throw new DomainError(`${label} deve ser maior que zero.`, 422, {
      code: "VALIDATION_ERROR",
      fieldErrors: { [field]: `${label} deve ser maior que zero.` }
    });
  }
};
```

## Resumo final

- DRY: 5 grupos fortes de duplicacao.
- Dead Code confirmado: 2 imports nao usados.
- Smells relevantes: 3 grupos principais (arquivos gigantes, duplicacao de componentes, inconsistencias de nomenclatura).

Impacto esperado apos refatoracao:
- Menos regressao entre compra/venda e entre services de ordem.
- Menor custo de manutencao.
- Melhor legibilidade e testabilidade.
