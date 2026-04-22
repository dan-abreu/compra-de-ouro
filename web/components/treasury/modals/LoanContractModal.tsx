import type { Dispatch, SetStateAction } from "react";

import type {
  CostBaseType,
  CounterpartyType,
  ExpectedRepayment,
  LoanDirection,
  LoanFormState,
  LoanInputCurrency,
  MonthlyCostType
} from "../useTreasuryDashboardState";
import { ActionModal, actionButtonClassName, inputClassName } from "../ui";

type LoanContractModalProps = {
  open: boolean;
  form: LoanFormState;
  setForm: Dispatch<SetStateAction<LoanFormState>>;
  knownPeople: string[];
  onClose: () => void;
  onSave: () => void;
};

export function LoanContractModal({ open, form, setForm, knownPeople, onClose, onSave }: LoanContractModalProps) {
  return (
    <ActionModal
      open={open}
      title="Novo Contrato Financeiro"
      subtitle="Deixe explicito se o valor entrou ou saiu do caixa e em qual moeda o caixa foi movimentado."
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700">
            Direcao da Operacao
            <select
              className={inputClassName}
              value={form.direction}
              onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value as LoanDirection }))}
            >
              <option value="RECEIVED">Entrou no caixa da loja agora (fica a pagar depois)</option>
              <option value="GRANTED">Saiu do caixa da loja agora (fica a receber depois)</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Tipo de Contraparte
            <select
              className={inputClassName}
              value={form.counterpartyType}
              onChange={(event) =>
                setForm((current) => ({ ...current, counterpartyType: event.target.value as CounterpartyType }))
              }
            >
              <option value="CLIENT">Cliente</option>
              <option value="SUPPLIER">Fornecedor</option>
              <option value="EMPLOYEE">Funcionario</option>
              <option value="THIRD_PARTY">Terceiro</option>
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium text-stone-700">
          Nome da Contraparte
          <input
            className={inputClassName}
            list="treasury-known-people"
            value={form.counterpartyName}
            onChange={(event) => setForm((current) => ({ ...current, counterpartyName: event.target.value }))}
            placeholder="Digite ou selecione um nome"
          />
          <datalist id="treasury-known-people">
            {knownPeople.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>

        <label className="block text-sm font-medium text-stone-700">
          Documento da Contraparte (opcional)
          <input
            className={inputClassName}
            value={form.counterpartyDocument}
            onChange={(event) => setForm((current) => ({ ...current, counterpartyDocument: event.target.value }))}
            placeholder="CPF, CNPJ ou documento interno"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700">
            Valor Principal
            <input
              className={inputClassName}
              type="number"
              min="0"
              step="0.0001"
              value={form.amount}
              onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              placeholder={form.currency === "GOLD" ? "0.0000 g" : "0.0000"}
            />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Caixa movimentado
            <select
              className={inputClassName}
              value={form.currency}
              onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value as LoanInputCurrency }))}
            >
              <option value="USD">Caixa USD</option>
              <option value="EUR">Caixa EUR</option>
              <option value="SRD">Caixa SRD</option>
              <option value="GOLD">Cofre Ouro (gramas)</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700">
            Encargo Mensal
            <select
              className={inputClassName}
              value={form.monthlyCostType}
              onChange={(event) => setForm((current) => ({ ...current, monthlyCostType: event.target.value as MonthlyCostType }))}
            >
              <option value="NONE">Sem encargo</option>
              <option value="PERCENTAGE">Juros mensal (%)</option>
              <option value="FIXED">Valor fixo mensal (USD)</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Forma de Liquidacao Esperada
            <select
              className={inputClassName}
              value={form.expectedRepayment}
              onChange={(event) =>
                setForm((current) => ({ ...current, expectedRepayment: event.target.value as ExpectedRepayment }))
              }
            >
              <option value="CASH">Em Dinheiro</option>
              <option value="GOLD">Em Ouro</option>
              <option value="MIXED">Misto</option>
            </select>
          </label>
        </div>

        {form.monthlyCostType === "PERCENTAGE" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-stone-700">
              Taxa Mensal (%)
              <input
                className={inputClassName}
                type="number"
                min="0"
                step="0.0001"
                value={form.monthlyRatePercent}
                onChange={(event) => setForm((current) => ({ ...current, monthlyRatePercent: event.target.value }))}
                placeholder="Ex: 3.0000"
              />
            </label>

            <label className="block text-sm font-medium text-stone-700">
              Base de Calculo
              <select
                className={inputClassName}
                value={form.costBaseType}
                onChange={(event) => setForm((current) => ({ ...current, costBaseType: event.target.value as CostBaseType }))}
              >
                <option value="CURRENT_BALANCE">Saldo atual</option>
                <option value="ORIGINAL_PRINCIPAL">Principal original</option>
              </select>
            </label>
          </div>
        ) : null}

        {form.monthlyCostType === "FIXED" ? (
          <label className="block text-sm font-medium text-stone-700">
            Valor Fixo Mensal (USD)
            <input
              className={inputClassName}
              type="number"
              min="0"
              step="0.0001"
              value={form.monthlyFixedCost}
              onChange={(event) => setForm((current) => ({ ...current, monthlyFixedCost: event.target.value }))}
              placeholder="Ex: 250.0000"
            />
          </label>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-medium text-stone-700">
            Data de Inicio
            <input
              className={inputClassName}
              type="date"
              value={form.startDate}
              onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
            />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Data de Vencimento
            <input
              className={inputClassName}
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
            />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Dia de Cobranca
            <input
              className={inputClassName}
              type="number"
              min="1"
              max="31"
              value={form.billingDay}
              onChange={(event) => setForm((current) => ({ ...current, billingDay: event.target.value }))}
              placeholder="Ex: 5"
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-stone-700">
          Observacoes
          <textarea
            className={inputClassName}
            rows={3}
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Detalhes adicionais do contrato"
          />
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className={actionButtonClassName} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Salvar
          </button>
        </div>
      </form>
    </ActionModal>
  );
}
