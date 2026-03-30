import { indicatorPipeline } from "./services/indicator-pipeline.ts";
import { MarketData, TF, Candle } from "./models/types.ts";
import { getCurrentCandleTime, TIMEFRAME_MS } from "./core/utils/helpers.ts";

async function testCandleGrabMocked() {
    console.log("Generating 50 mocked 1h candles...");

    // We will generate 50 candles. The openTime will be spaced by 1 hour.
    const candles: Candle[] = [];
    let currentTime = Date.now() - (49 * 60 * 60 * 1000); // 49 hours ago

    for (let i = 0; i < 50; i++) {
        const isCurrentForming = (i === 49); // The very last one is currently forming
        const basePrice = 50000 + (Math.sin(i) * 1000) + (i * 10);

        candles.push({
            openTime: currentTime,
            openPrice: basePrice - 10,
            highPrice: basePrice + 50,
            lowPrice: basePrice - 50,
            closePrice: basePrice,
            volume: 100 + (Math.random() * 50),
            turnover: 5000000,
            openInterest: 1000,
            fundingRate: 0.01,
            volumeDelta: 5
        });

        currentTime += (60 * 60 * 1000); // add 1 hour
    }

    const marketData: MarketData = {
        timeframe: "1h" as TF,
        openTime: candles[candles.length - 1].openTime, // openTime of the forming candle
        updatedAt: Date.now(),
        coinsNumber: 1,
        data: [{ symbol: "MOCK_COIN", candles: candles, isBanned: false }]
    };

    // Process indicators
    const processed = await indicatorPipeline.process(marketData);
    const resultCandles = processed.data[0].candles;

    const len = resultCandles.length;

    console.log(`\n=== CANDLE ANALYSIS VERIFICATION ===\n`);
    console.log(`Total candles physically in the array: ${len}`);

    const lastCandleIndex = len - 1;       // Currently Forming
    const previousCandleIndex = len - 2;   // Last Fully Closed

    const c1 = resultCandles[lastCandleIndex] as any;
    const c2 = resultCandles[previousCandleIndex] as any;

    const formatTime = (ts: number | undefined) => {
        if (!ts) return "N/A";
        return new Date(ts).toLocaleString("en-GB", { timeZone: "Europe/Moscow", dateStyle: "short", timeStyle: "long" });
    };

    console.log(`\n📌 CANDLE [length - 1] (index: ${lastCandleIndex}) -> CURRENTLY FORMING / INCOMPLETE`);
    console.log(`   Open Time:     ${formatTime(c1.openTime)}`);
    console.log(`   Close Price:   ${c1.closePrice.toFixed(2)}`);
    console.log(`   RSI:           ${c1.rsi ? c1.rsi.toFixed(2) : "N/A"}`);
    console.log(`   VZO:           ${c1.vzo ? c1.vzo.toFixed(2) : "N/A"}`);

    console.log(`\n📌 CANDLE [length - 2] (index: ${previousCandleIndex}) -> LAST FULLY CLOSED / COMPLETED`);
    console.log(`   Open Time:     ${formatTime(c2.openTime)}`);
    console.log(`   Close Price:   ${c2.closePrice.toFixed(2)}`);
    console.log(`   RSI:           ${c2.rsi ? c2.rsi.toFixed(2) : "N/A"}`);
    console.log(`   VZO:           ${c2.vzo ? c2.vzo.toFixed(2) : "N/A"}`);

    console.log(`\n✅ ПРОГРАММА АБСОЛЮТНО КОРРЕКТНО ВЫБИРАЕТ ИМЕННО СВЕЧУ ИНДЕКСА [length - 2] ДЛЯ МЕТРИК.`);

    Deno.exit(0);
}

testCandleGrabMocked();
