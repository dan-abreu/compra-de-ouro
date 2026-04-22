# Checklist de Execucao da Refatoracao

Status geral: Concluido
Data: 2026-04-22

## Ordem obrigatoria dos passos

1. Blindagem multi-tenant sem fallback inseguro
2. Extracao de camadas do modulo de taxas (rates)
3. Modularizacao do TreasuryDashboard por responsabilidade
4. Desacoplamento do AppShell e polling de mercado
5. Remocao de duplicacao entre PurchasePage e SalesPage
6. Separacao do auth por subdominios
7. Validacao final (build, erros e regressao basica)

## Criterios de aceite por passo

### 1) Multi-tenant
- Nao usar cliente root por acidente em rotas tenant
- Falha explicita quando contexto tenant estiver ausente
- Rotas globais continuam usando root de forma intencional

### 2) Rates
- Controller HTTP separado de servicos de dominio
- Integracao externa desacoplada de validacao HTTP
- Cache isolado em modulo proprio

### 3) TreasuryDashboard
- Estado e regra de negocio em hook/modulo
- UI quebrada em componentes menores
- Sem alterar calculos financeiros em Decimal

### 4) AppShell
- Polling de mercado em hook dedicado
- Layout permanece no shell
- Comportamento mobile/desktop preservado

### 5) Purchase/Sales
- Fluxo compartilhado para reduzir codigo espelhado
- Diferencas de endpoint/contraparte parametrizadas

### 6) Auth
- Rotas divididas por contexto (sessao, perfil, seguranca de cancelamento)
- Tratamento de erro consistente

### 7) Validacao final
- TypeScript sem erros novos relevantes
- Build backend e frontend aprovados
- Caminhos criticos funcionais revisados

## Registro de progresso

- [x] Checklist criado
- [x] Passo 1 concluido
- [x] Passo 2 concluido
- [x] Passo 3 concluido
- [x] Passo 4 concluido
- [x] Passo 5 concluido
- [x] Passo 6 concluido
- [x] Passo 7 concluido
