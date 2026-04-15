# Compra de Ouro — ERP Multi-Tenant

SaaS multi-tenant para casas de compra e venda de ouro no Suriname.
Sistema de rastreabilidade com contabilidade decimal-only (sem float), autenticação JWT por tenant e fluxo operacional orientado a caixa.

## Stack

| Camada | Tecnologia |
|---|---|
| Back-end | Node.js 18 + Express + Prisma 6 |
| Front-end | Next.js 14 (App Router) + Tailwind CSS |
| Banco de Dados | PostgreSQL 14 + `DECIMAL(18,4)` |
| Linguagem | TypeScript strict |
| Auth | JWT HMAC-SHA256 customizado (sem dependência externa) |
| Multi-tenancy | Master DB + banco separado por tenant |

---

## Arquitetura Multi-Tenant

Cada loja (tenant) tem seu próprio banco de dados PostgreSQL isolado.
Um banco master armazena metadados dos tenants (ID, `databaseUrl`, status de licença).

```
┌─────────────────────────────────────┐
│        compra_ouro_master           │
│   Tenant { id, companyName,         │
│            databaseUrl, license }   │
└──────────────┬──────────────────────┘
               │ resolve databaseUrl
       ┌───────┴────────┐
       ▼                ▼
 tenant_loja_a_…   tenant_loja_b_…
   (schema completo)  (schema completo)
```

Cada requisição de dados carrega o `X-Tenant-ID` no header.
O middleware resolve o banco correto e injeta um `PrismaClient` isolado via `AsyncLocalStorage`.

---

## Autenticação

- Login via `POST /api/auth/login` (email + senha, header `X-Tenant-ID`)
- Resposta inclui `accessToken` (JWT HS256) com claims: `tenantId`, `userId`, `role`, `exp`
- Rotas de dados exigem `Authorization: Bearer <token>`
- O `userId` do token é usado automaticamente como `createdById` em compras e vendas — sem campo manual

---

## Quick Start (Desenvolvimento)

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+

### Instalação

```bash
# Dependências backend
npm install

# Dependências frontend
npm --prefix web install

# Variáveis de ambiente
cp .env.example .env
# Editar DATABASE_URL, MASTER_DATABASE_URL, POSTGRES_ADMIN_URL e JWT_SECRET
```

### Configuração dos bancos

```bash
# Gerar Prisma Clients (tenant schema + master schema)
npm run prisma:generate
npm run prisma:generate:master

# Aplicar migrations no banco raiz
npx prisma migrate deploy
```

### Provisionar o primeiro tenant

```bash
npm run provision:tenant -- "Nome da Loja" "Admin Nome" "admin@loja.com" "SenhaSegura123"
```

O script cria o banco do tenant, aplica todas as migrations e gera o usuário admin.

### Seed de dados operacionais (vault + taxa do dia)

```bash
npx tsx src/scripts/seed-tenant-runtime-data.ts \
  "postgresql://postgres:postgres@localhost:5432/tenant_nome_loja_…?schema=public" \
  "admin@loja.com"
```

### Executar

```bash
# Terminal 1 — Backend (padrão porta 3000)
npm run dev

# Terminal 2 — Frontend
npm --prefix web exec -- next dev --port 3004
```

Acesse: **http://localhost:3004/login**

---

## Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Banco raiz (Prisma migrations) |
| `MASTER_DATABASE_URL` | Banco master com metadados de tenants |
| `POSTGRES_ADMIN_URL` | Banco admin para criar novos bancos de tenant |
| `JWT_SECRET` | Segredo HMAC-SHA256 para assinar tokens |
| `MASTER_API_KEY` | Chave para o endpoint de provisionamento |
| `PORT` | Porta do backend (padrão: 3000) |
| `CORS_ORIGIN` | Origem permitida pelo CORS |

---

## Estrutura do Projeto

```
compra-de-ouro/
├── src/
│   ├── server.ts                      # Express + middlewares
│   ├── prisma.ts                      # Proxy Prisma (tenant-aware)
│   ├── lib/
│   │   ├── jwt.ts                     # Sign / verify JWT HMAC-SHA256
│   │   ├── password.ts                # Verificação de senha
│   │   ├── decimal.ts                 # Utilitários Decimal.js
│   │   └── errors.ts                  # DomainError
│   ├── middleware/
│   │   ├── auth-middleware.ts         # Valida Bearer token → req.userId
│   │   └── tenant-resolver.ts        # X-Tenant-ID → req.tenantPrisma
│   ├── tenant/
│   │   ├── master-client.ts           # Lê/escreve metadados no master DB
│   │   ├── provisioning.ts            # Cria banco + migrations + admin
│   │   ├── tenant-context.ts          # AsyncLocalStorage do tenant
│   │   └── tenant-prisma-factory.ts  # Pool de PrismaClients por tenant
│   ├── services/
│   │   ├── purchase-order-service.ts
│   │   └── sales-order-service.ts
│   ├── routes/
│   │   ├── auth.ts                    # POST /api/auth/login
│   │   ├── master-admin.ts            # POST /api/master/provision
│   │   ├── orders.ts                  # Compra e venda
│   │   ├── rates.ts                   # Taxa diária
│   │   ├── vault.ts                   # Saldo do cofre
│   │   ├── clients.ts
│   │   ├── suppliers.ts
│   │   ├── ledger.ts
│   │   ├── treasury.ts                # Dashboard gerencial completo
│   │   ├── gold-transit.ts            # Ouro em trânsito
│   │   ├── loan-books.ts              # Adiantamentos a garimpeiros
│   │   └── opex.ts                    # Despesas operacionais
│   └── scripts/
│       ├── provision-new-tenant.ts
│       ├── seed-tenant-runtime-data.ts
│       ├── seed-market-rates.ts
│       ├── inspect-tenant-columns.ts
│       └── validate-migration.ts
├── prisma/
│   ├── schema.prisma                  # Schema principal (tenant)
│   ├── master_schema.prisma           # Schema do master DB
│   └── migrations/
├── web/
│   ├── app/
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── compra/
│   │   ├── venda/
│   │   ├── extrato/
│   │   ├── tesouraria/
│   │   ├── clientes/
│   │   └── fornecedores/
│   ├── components/
│   │   ├── LoginPage.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── PurchasePage.tsx
│   │   ├── SalesPage.tsx
│   │   ├── TreasuryDashboard.tsx
│   │   ├── DashboardClient.tsx
│   │   ├── TradePartySelector.tsx
│   │   └── …
│   └── lib/
│       ├── auth-store.ts              # Estado de sessão (localStorage)
│       ├── apiClient.ts               # fetch com Bearer + X-Tenant-ID
│       └── decimal.ts
└── .env.example
```

---

## API Endpoints

Todas as rotas de dados exigem `Authorization: Bearer <token>` e `X-Tenant-ID`.

### Auth
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login → accessToken |

### Ordens
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/orders/purchase` | Criar compra |
| POST | `/api/orders/sale` | Criar venda |
| POST | `/api/orders/purchase/:id/cancel` | Cancelar compra |
| POST | `/api/orders/sale/:id/cancel` | Cancelar venda |

### Taxas / Cofre / Extrato
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/rates` | Inserir taxa do dia |
| GET | `/api/rates/latest` | Taxa mais recente |
| GET | `/api/vault` | Saldo consolidado |
| GET | `/api/ledger` | Timeline de movimentos |

### CRM
| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/api/clients` | Clientes |
| GET/POST | `/api/suppliers` | Fornecedores |

### Gerencial
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/treasury` | P&L, cofre MTM, fluxo cambial, adiantamentos, OPEX |
| GET/POST | `/api/gold-transit` | Ouro em trânsito |
| GET/POST | `/api/loan-books` | Adiantamentos a garimpeiros |
| GET/POST | `/api/opex` | Despesas operacionais |

### Admin Master (requer `X-Master-Key`)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/master/provision` | Provisionar novo tenant |

---

## Payload de Compra

```json
{
  "isWalkIn": true,
  "goldState": "BURNED",
  "physicalWeight": "10.0000",
  "purityPercentage": "99.0000",
  "negotiatedPricePerGram": "62.0000",
  "totalOrderValueUsd": "620.0000",
  "paymentSplits": [
    { "currency": "USD", "amount": "620.0000" }
  ]
}
```

`createdById` é preenchido automaticamente pelo backend a partir do JWT — não deve ser enviado no payload.

---

## Regra Absoluta: Decimal, Nunca Float

| Camada | Tipo |
|---|---|
| PostgreSQL | `DECIMAL(18,4)` |
| Node.js | `Prisma.Decimal` / `decimal.js` |
| Frontend | `decimal.js` com `toFixed(4)` |

---

## Scripts NPM

```bash
npm run dev                     # Backend em modo watch
npm run build                   # Compilar TypeScript
npm run prisma:generate         # Gerar Prisma Client (tenant)
npm run prisma:generate:master  # Gerar Prisma Client (master)
npm run validate:migration      # Verificar integridade do schema
npm run provision:tenant        # Provisionar novo tenant (args: nome admin email senha)
```

---

## Licença

Proprietário — Casa de Compra e Venda de Ouro, Suriname
