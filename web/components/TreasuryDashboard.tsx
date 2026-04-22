"use client";

import { OverviewKpis } from "./treasury/OverviewKpis";
import { ExpenseModal } from "./treasury/modals/ExpenseModal";
import { LoanContractModal } from "./treasury/modals/LoanContractModal";
import { CurrencyCashSection } from "./treasury/sections/CurrencyCashSection";
import { DailyPnlSection } from "./treasury/sections/DailyPnlSection";
import { FinancialContractsSection } from "./treasury/sections/FinancialContractsSection";
import { GoldVaultSection } from "./treasury/sections/GoldVaultSection";
import { useTreasuryDashboardState } from "./treasury/useTreasuryDashboardState";

export function TreasuryDashboard() {
  const {
    expenseForm,
    expenseModalOpen,
    fxRows,
    goldRows,
    grossRevenue,
    handleExpenseSave,
    handleLoanSave,
    knownPeople,
    loading,
    loanForm,
    loanModalOpen,
    loanRows,
    message,
    netPnl,
    opexRows,
    opexTotal,
    setExpenseForm,
    setExpenseModalOpen,
    setLoanForm,
    setLoanModalOpen,
    spotGramUsd,
    totalBookValueUsd,
    totalCashUsdEq,
    totalGoldOwed,
    totalMonthlyFinancialCost,
    totalMonthlyFinancialRevenue,
    totalMtmValueUsd,
    totalStorePayables,
    totalStoreReceivables,
    totalVaultGrams,
    tradingProfit,
    vaultUnrealizedPnl
  } = useTreasuryDashboardState();

  if (loading) {
    return (
      <div className="glass rounded-2xl p-8 text-sm text-stone-500 shadow-glow">
        Carregando painel da tesouraria...
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-8">
      {message ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">{message}</div>
      ) : null}

      <OverviewKpis
        totalCashUsdEq={totalCashUsdEq}
        totalMtmValueUsd={totalMtmValueUsd}
        netPnl={netPnl}
        totalStoreReceivables={totalStoreReceivables}
        totalGoldOwed={totalGoldOwed}
        totalVaultGrams={totalVaultGrams}
        spotGramUsd={spotGramUsd}
      />

      <CurrencyCashSection fxRows={fxRows} />

      <GoldVaultSection
        spotGramUsd={spotGramUsd}
        goldRows={goldRows}
        totalVaultGrams={totalVaultGrams}
        totalBookValueUsd={totalBookValueUsd}
        totalMtmValueUsd={totalMtmValueUsd}
        vaultUnrealizedPnl={vaultUnrealizedPnl}
      />

      <FinancialContractsSection
        loanRows={loanRows}
        totalStorePayables={totalStorePayables}
        totalStoreReceivables={totalStoreReceivables}
        totalMonthlyFinancialCost={totalMonthlyFinancialCost}
        totalMonthlyFinancialRevenue={totalMonthlyFinancialRevenue}
        onOpenLoanModal={() => setLoanModalOpen(true)}
      />

      <DailyPnlSection
        tradingProfit={tradingProfit}
        opexRows={opexRows}
        opexTotal={opexTotal}
        grossRevenue={grossRevenue}
        netPnl={netPnl}
        onOpenExpenseModal={() => setExpenseModalOpen(true)}
      />

      <ExpenseModal
        open={expenseModalOpen}
        form={expenseForm}
        setForm={setExpenseForm}
        onClose={() => setExpenseModalOpen(false)}
        onSave={handleExpenseSave}
      />

      <LoanContractModal
        open={loanModalOpen}
        form={loanForm}
        setForm={setLoanForm}
        knownPeople={knownPeople}
        onClose={() => setLoanModalOpen(false)}
        onSave={handleLoanSave}
      />
    </div>
  );
}
