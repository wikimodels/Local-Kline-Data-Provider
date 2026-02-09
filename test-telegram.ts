// test-telegram.ts
import { load } from "https://deno.land/std@0.215.0/dotenv/mod.ts";
import { telegramBot } from "./core/utils/telegram-bot.ts";

// Load .env
await load({ export: true });

const token = Deno.env.get("TG_TECHNICALS_BOT");
const userId = Deno.env.get("TG_USER_ID");

console.log("--- Telegram Test ---");
console.log(`Token: ${token ? "Found (starts with " + token.substring(0, 5) + "...)" : "MISSING"}`);
console.log(`User ID: ${userId ? "Found (" + userId + ")" : "MISSING"}`);

if (!token || !userId) {
    console.error("❌ Credentials missing in .env or not loaded.");
    Deno.exit(1);
}

console.log("Attempting to send test message...");

try {
    await telegramBot.notifyStart();
    console.log("✅ 'notifyStart' called successfully. Check your Telegram!");
} catch (error) {
    console.error("❌ Error sending message:", error);
}
