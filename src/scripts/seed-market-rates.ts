import { rootPrisma } from "../prisma.js";

async function seedMarketRates() {
  try {
    console.log("[seed] Iniciando inserção de taxas de mercado...");

    // Busca um operador ativo para atribui os dados
    const operator = await rootPrisma.user.findFirst({
      where: { status: "ACTIVE" },
    });

    if (!operator) {
      console.error("[seed] Nenhum operador ativo encontrado!");
      return;
    }

    console.log(`[seed] Usando operador: ${operator.id} (${operator.fullName})`);

    // Valores reais de mercado (15 de abril de 2026)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingRate = await rootPrisma.dailyRate.findUnique({
      where: { rateDate: today },
    });

    if (existingRate) {
      console.log("[seed] Taxa para hoje já existe, atualizando...");
      await rootPrisma.dailyRate.update({
        where: { rateDate: today },
        data: {
          goldPricePerGramUsd: "2.15", // ~67 USD/oz ÷ 31.1035
          usdToSrdRate: "37.5770",    // SRD por USD
          eurToUsdRate: "1.1797",     // USD por EUR
        },
      });
      console.log("[seed] Taxa atualizada com sucesso!");
    } else {
      console.log("[seed] Criando taxa para hoje...");
      await rootPrisma.dailyRate.create({
        data: {
          rateDate: today,
          createdById: operator.id,
          goldPricePerGramUsd: "2.15", // ~67 USD/oz ÷ 31.1035
          usdToSrdRate: "37.5770",    // SRD por USD
          eurToUsdRate: "1.1797",     // USD por EUR
        },
      });
      console.log("[seed] Taxa criada com sucesso!");
    }

    console.log("[seed] ✅ Taxas de mercado inseridas!");
    console.log("  - Ouro: US$2.15 por grama (~US$67 por oz)");
    console.log("  - USD/SRD: 37.5770");
    console.log("  - EUR/USD: 1.1797");
  } catch (error) {
    console.error("[seed] Erro ao inserir taxas:", error);
    throw error;
  } finally {
    await rootPrisma.$disconnect();
  }
}

seedMarketRates();
