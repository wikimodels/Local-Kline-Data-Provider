// Deno-compatible coin fetcher
export async function fetchCoins() {
  try {
    const COIN_SIFTER_URL = Deno.env.get("COIN_SIFTER_URL");
    const SECRET_TOKEN = Deno.env.get("SECRET_TOKEN");

    if (!COIN_SIFTER_URL || !SECRET_TOKEN) {
      console.error(
        "❌ [COIN FETCHER] Error: COIN_SIFTER_URL or SECRET_TOKEN is not set in environment"
      );
      throw new Error("Missing server configuration");
    }

    const url = COIN_SIFTER_URL + "/coins/formatted-symbols";

    const response = await fetch(url, {
      headers: {
        "X-Auth-Token": SECRET_TOKEN,
      },
    });

    if (!response.ok) {
      console.error(`❌ [COIN FETCHER] HTTP error! status: ${response.status}`);
      const text = await response.text();
      console.error(`Response: ${text}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: any = await response.json();
    const coins = data.symbols;

    if (!coins || !Array.isArray(coins)) {
      console.error(`❌ [COIN FETCHER] Invalid response structure:`, data);
      throw new Error("Invalid response: symbols is not an array");
    }

    // Calculate exchange statistics
    const binanceCount = coins.filter(c => c.exchanges.some((e: string) => e.toUpperCase() === "BINANCE")).length;
    const bybitCount = coins.filter(c => c.exchanges.some((e: string) => e.toUpperCase() === "BYBIT")).length;
    const bothCount = coins.filter(c =>
      c.exchanges.some((e: string) => e.toUpperCase() === "BINANCE") &&
      c.exchanges.some((e: string) => e.toUpperCase() === "BYBIT")
    ).length;

    console.log(`✅ [COIN FETCHER] Fetched ${coins.length} unique coins`);
    console.log(`   📊 Binance: ${binanceCount} | Bybit: ${bybitCount} | Both: ${bothCount}`);

    return coins;
  } catch (error) {
    console.error("❌ [COIN FETCHER] Failed to fetch or parse coins data:", error);
    throw error;
  }
}

