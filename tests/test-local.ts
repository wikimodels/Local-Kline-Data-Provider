import { load } from "https://deno.land/std@0.215.0/dotenv/mod.ts";
import { DColors } from "../models/types.ts";

try {
    await load({ export: true });
} catch (_e) {
    // ignore
}

const SECRET_TOKEN = Deno.env.get("SECRET_TOKEN");

if (!SECRET_TOKEN) {
    console.error("❌ SECRET_TOKEN not set");
    Deno.exit(1);
}

const timeframes = ["1h", "4h", "8h", "12h", "D"];

console.log(`${DColors.cyan}🚀 Testing LOCAL server: http://localhost:80${DColors.reset}`);

for (const tf of timeframes) {
    const url = `http://localhost:80/api/cache/${tf}`;
    console.log(`\n🔍 Timeframe: ${tf}`);
    try {
        const start = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for local

        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${SECRET_TOKEN}`,
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const ms = (performance.now() - start).toFixed(0);

        if (res.status === 200) {
            const json = await res.json();
            if (json.success && json.data) {
                console.log(`${DColors.green}✅ OK (200) - ${ms}ms${DColors.reset}`);
                console.log(
                    `   Coins: ${json.data.coinsNumber} | Updated: ${new Date(json.data.updatedAt).toLocaleTimeString()}`,
                );
            } else {
                console.error(`${DColors.red}❌ Invalid Structure${DColors.reset}`);
            }
        } else if (res.status === 404) {
            console.log(
                `${DColors.yellow}⚠️ Not Found (404) - Cache Empty${DColors.reset}`,
            );
        } else {
            console.log(`${DColors.red}❌ Status: ${res.status}${DColors.reset}`);
        }
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error(`${DColors.red}❌ Error: ${errorMsg}${DColors.reset}`);
    }
}
