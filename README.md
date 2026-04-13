# 🏆 Compra de Ouro - ERP/Livro-Caixa

SaaS web interno para casa de compra e venda de ouro local no Suriname. Sistema de rastreabilidade imutável com contabilidade decimal-only (sem float).

## 📋 Stack Tecnológico

- **Back-end**: Node.js + Express + Prisma
- **Front-end**: React 18 + Next.js 14 + Tailwind CSS
- **Banco de Dados**: PostgreSQL com Decimal(18,4)
- **Linguagem**: TypeScript (strict mode)

## 🎯 Funcionalidades Principais

### PASSO 1: Modelagem Append-Only + Snapshot
- ✅ Tabelas: User, Client, Supplier, Vault, PurchaseOrder, SalesOrder, PaymentSplit, DailyRate
- ✅ Padrão append-only: ordens canceladas recebem `status = 'CANCELED'` (sem hard delete)
- ✅ Snapshot de taxa/preço travado em cada ordem
- ✅ Todos os valores em `Decimal(18,4)` (PostgreSQL)

### PASSO 2: Backend com Transações ACID
- ✅ Cálculo automático de ouro fino: `fineGoldWeight = netWeight * (purityPercentage / 100)`
- ✅ Split payment multimoeda com validação exata
- ✅ Atualização transacional do Vault com isolamento `Serializable`
- ✅ Custo médio de aquisição para cálculo de lucro na venda

### PASSO 3: Frontend - 6 Páginas

1. **Dashboard**: Saldo do cofre, ouro em aberto, formulário de taxa manual do dia
2. **Compra POS**: Seleção de cliente, cálculo de ouro fino, split payment dinâmico
3. **Venda B2B**: Peso de ouro fino, valor negociado, split payment de recebimento
4. **Extrato (Ledger)**: Timeline cronológica com lucro calculado, botão de cancelamento
5. **Cadastro de Clientes**: Dados + upload KYC
6. **Cadastro de Fornecedores**: Dados de empresas B2B

## 🚀 Quick Start

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+

### Instalação

```bash
# Instalar dependências backend
npm install

# Instalar dependências frontend
cd web && npm install && cd ..

# Configurar banco de dados
cp .env.example .env
# Editar .env com DATABASE_URL do PostgreSQL

# Gerar Prisma Client
npm run prisma:generate

# Migrations (se houver)
npm run prisma:migrate
```

### Executar

```bash
# Terminal 1: Backend (porta 3000)
npm run dev

# Terminal 2: Frontend (porta 3001)
cd web && npm run dev
```

Acesse: **http://localhost:3001/dashboard**

## 📁 Estrutura

```
compra-de-ouro/
├── src/
│   ├── server.ts              # Express server
│   ├── prisma.ts              # Prisma client
│   ├── lib/
│   │   ├── decimal.ts         # Utilitários Decimal
│   │   └── errors.ts          # Classes de erro
│   ├── services/
│   │   └── order-service.ts   # Lógica transacional
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
│   │   ├── app-shell.tsx      # Layout + navação
│   │   ├── split-payment.tsx  # Editor de split multimoeda
│   │   └── ui.tsx             # Componentes reutilizáveis
│   └── lib/
│       ├── decimal.ts         # Decimal para front
│       └── api.ts             # Cliente HTTP
└── .env.example
```

## 🔐 REGRA ABSOLUTA: Decimal, Nunca Float

Todos os valores monetários, câmbio e peso em:
- PostgreSQL: `DECIMAL(18,4)`
- Node: `decimal.js` (Prisma.Decimal)
- React: `decimal.js` com formatação `toFixed(4)`

## 📝 API Endpoints

### Ordens
- `POST /api/orders/purchase` - Criar compra
- `POST /api/orders/sale` - Criar venda
- `POST /api/orders/purchase/:id/cancel` - Cancelar compra
- `POST /api/orders/sale/:id/cancel` - Cancelar venda

### Taxas
- `POST /api/rates` - Criar taxa diária
- `GET /api/rates/latest` - Taxa mais recente

### Cofre
- `GET /api/vault` - Saldo consolidado

### CRM
- `GET/POST /api/clients` - Clientes
- `GET/POST /api/suppliers` - Fornecedores

### Extrato
- `GET /api/ledger` - Timeline de transações

## 🛠️ Desenvolvimento

### Compilar TypeScript
```bash
npm run build
```

### Iniciar em produção
```bash
npm start
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

## 📊 Exemplo: Fluxo de Compra

1. Admin insere taxa do dia (ouro por grama, USD->SRD, EUR->SRD)
2. Operador seleciona cliente
3. Entrar peso bruto, peso líquido, pureza
4. Sistema calcula automaticamente ouro fino e total em SRD
5. Operador distribui pagamento em split (USD/EUR/SRD)
6. Botão finalizar só ativa quando split soma exatamente o total
7. Ordem finalizada, cofre atualizado atomicamente

## 🔄 Exemplo: Fluxo de Venda com Lucro

1. Operador seleciona fornecedor
2. Insere peso de ouro fino a vender e valor negociado em SRD
3. Operador distribui recebimento em split (USD/EUR/SRD)
4. Sistema calcula custo médio do ouro em aberto
5. Calcula lucro = valor_negociado - (custo_médio * quantidade_vendida)
6. Ordem finalizada, ouro saído do cofre

## 📌 Notas Importantes

- Sem integração externa de preço; admin insere manualmente
- Cada ordem leva snapshot de taxa/preço daquele momento
- Cancelamento é estorno contábil, não deletar do banco
- Ouro em aberto é pool FIFO para cálculo de média ponderada

## 🤝 Contribuindo

Fork, crie branch feature e submeta PR.

## 📄 Licença

Proprietário - Casa de Compra e Venda de Ouro, Suriname
