# Compra de Ouro - ERP/Livro-Caixa

SaaS web interno para casa de compra e venda de ouro no Suriname.
Sistema de rastreabilidade imutavel com contabilidade decimal-only (sem float) e fluxo operacional orientado a caixa.

## 📋 Stack Tecnológico

- **Back-end**: Node.js + Express + Prisma
- **Front-end**: React 18 + Next.js 14 + Tailwind CSS
- **Banco de Dados**: PostgreSQL com Decimal(18,4)
- **Linguagem**: TypeScript (strict mode)

## Funcionalidades Principais

### Modelagem Append-Only + Snapshot
- Tabelas principais: User, Client, Supplier, Vault, PurchaseOrder, SalesOrder, PaymentSplit, DailyRate, VaultLedger
- Padrao append-only: ordens canceladas recebem `status = 'CANCELED'` (sem hard delete)
- Snapshot de taxa/preco travado em cada ordem
- Todos os valores em `Decimal(18,4)` (PostgreSQL)

### Backend com transacoes ACID
- Compra usando fornecedor e venda usando cliente
- Cadastro flexivel: cliente/fornecedor podem ser salvos apenas com nome
- Modo avulso com controle de compliance por threshold
- Split payment multimoeda com validacao exata
- Atualizacao transacional do Vault com isolamento `Serializable`
- Custo medio de aquisicao para calculo de lucro na venda

### Frontend

1. Dashboard: saldo do cofre, ouro em aberto e formulario de taxa diaria
2. Compra POS: contraparte fornecedor com modo avulso, preco negociado e split dinamico
3. Venda: contraparte cliente com modo avulso, preco negociado e split dinamico
4. Extrato (Ledger): timeline cronologica com custo/receita/lucro
5. Cadastro de Clientes: cadastro flexivel (somente nome obrigatorio)
6. Cadastro de Fornecedores: cadastro flexivel (somente nome da empresa obrigatorio)
7. TradePartySelector: autocomplete reutilizavel com recentes + ordenacao A-Z

## Quick Start

### Pre-requisitos
- Node.js 18+
- PostgreSQL 14+

### Instalacao

```bash
# Instalar dependências backend
npm install

# Instalar dependências frontend
npm --prefix web install

# Configurar banco de dados
cp .env.example .env
# Editar .env com DATABASE_URL do PostgreSQL

# Gerar Prisma Client
npm run prisma:generate

# Aplicar migrations pendentes
npx prisma migrate deploy
```

### Executar

```bash
# Terminal 1: Backend (porta 3002)
set PORT=3002 && npm run dev

# PowerShell equivalente
$env:PORT=3002; npm run dev

# Terminal 2: Frontend (porta 3003)
npm --prefix web exec -- next dev --port 3003

# Opcional por variavel (script padrao usa 3001)
$env:PORT=3003; npm --prefix web run dev
```

Acesse: **http://localhost:3003/dashboard**

## CORS em dev

Por padrao, o backend permite origem:

```bash
http://localhost:3003
```

Pode ser alterado por variavel:

```bash
set CORS_ORIGIN=http://localhost:3003
npm run dev
```

## Estrutura

```
compra-de-ouro/
├── src/
│   ├── server.ts              # Express server
│   ├── prisma.ts              # Prisma client
│   ├── lib/
│   │   ├── decimal.ts         # Utilitários Decimal
│   │   └── errors.ts          # Classes de erro
│   ├── services/
│   │   ├── purchase-order-service.ts
│   │   ├── sales-order-service.ts
│   │   └── order-service.ts
│   └── routes/
│       ├── orders.ts          # POST /api/orders/purchase, /sale
│       ├── rates.ts           # POST /api/rates, GET /latest
│       ├── vault.ts           # GET /api/vault
│       ├── clients.ts         # CRUD clientes
│       ├── suppliers.ts       # CRUD fornecedores
│       └── ledger.ts          # GET /api/ledger
├── prisma/
│   └── schema.prisma          # Schema Decimal-only
├── web/
│   ├── app/
│   │   ├── dashboard/page.tsx
│   │   ├── compra/page.tsx
│   │   ├── venda/page.tsx
│   │   ├── extrato/page.tsx
│   │   ├── clientes/page.tsx
│   │   ├── fornecedores/page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── TradePartySelector.tsx
│   │   ├── PurchasePage.tsx
│   │   ├── SalesPage.tsx
│   │   ├── ClientsPage.tsx
│   │   ├── SuppliersPage.tsx
│   │   ├── TreasurySplitPlanner.tsx
│   │   ├── PriceSuggestionBreakdown.tsx
│   │   └── ui.tsx
│   └── lib/
│       ├── decimal.ts
│       ├── api.ts
│       ├── treasury.ts
│       └── complianceConfig.ts
└── .env.example
```

## Regra Absoluta: Decimal, Nunca Float

Todos os valores monetários, câmbio e peso em:
- PostgreSQL: `DECIMAL(18,4)`
- Node: `decimal.js` e `Prisma.Decimal`
- React: `decimal.js` com formatação `toFixed(4)`

## API Endpoints

### Ordens
- `POST /api/orders/purchase` - Criar compra (contraparte: fornecedor)
- `POST /api/orders/sale` - Criar venda (contraparte: cliente)
- `POST /api/orders/purchase/:id/cancel` - Cancelar compra
- `POST /api/orders/sale/:id/cancel` - Cancelar venda

### Taxas
- `POST /api/rates` - Criar taxa diária
- `GET /api/rates/latest` - Taxa mais recente

### Cofre
- `GET /api/vault` - Saldo consolidado

### CRM (Cadastro Flexivel)
- `GET/POST /api/clients` - Clientes
- `GET/POST /api/suppliers` - Fornecedores

### Extrato
- `GET /api/ledger` - Timeline de transações

## Desenvolvimento

### Compilar TypeScript
```bash
npm run build
npm --prefix web run build
```

### Iniciar em producao
```bash
npm start
npm --prefix web run start
```

### Estrutura de splits em ordem
```json
{
  "paymentSplits": [
    { "currency": "USD", "amount": "300.0000" },
    { "currency": "EUR", "amount": "150.0000" },
    { "currency": "SRD", "amount": "1200.0000" }
  ]
}
```

## Exemplo: Fluxo de Compra

1. Admin insere taxa do dia (ouro por grama USD, USD->SRD, EUR->USD)
2. Operador seleciona fornecedor (ou marca avulso)
3. Informa peso fisico, pureza e preco negociado por grama
4. Sistema calcula total em USD e permite ajuste fino controlado
5. Operador distribui pagamento em split (USD/EUR/SRD)
6. Finalizacao exige split fechando exatamente o total
7. Ordem finalizada e cofre atualizado atomicamente

## Exemplo: Fluxo de Venda com Lucro

1. Operador seleciona cliente (ou marca avulso)
2. Informa peso fisico, pureza e valor negociado em USD
3. Operador distribui recebimento em split (USD/EUR/SRD)
4. Sistema calcula custo médio do ouro em aberto
5. Calcula lucro em USD e projecao em SRD
6. Ordem finalizada, ouro saído do cofre

## Notas Importantes

- Sem integração externa de preço; admin insere manualmente
- Cada ordem leva snapshot de taxa/preço daquele momento
- Cancelamento é estorno contábil, não deletar do banco
- Ouro em aberto usa media ponderada de custo para apuracao de resultado

## Contribuindo

Fork, crie branch feature e submeta PR.

## Licenca

Proprietário - Casa de Compra e Venda de Ouro, Suriname
