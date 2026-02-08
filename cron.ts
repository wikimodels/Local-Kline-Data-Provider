import { load } from "https://deno.land/std@0.215.0/dotenv/mod.ts";
import { logger } from "./core/utils/logger.ts";
import { DColors } from "./models/types.ts";

// —————————————————————————————————————————————
// 1. LOAD ENVIRONMENT VARIABLES
// —————————————————————————————————————————————

await load({ export: true });

const SECRET_TOKEN = Deno.env.get("SECRET_TOKEN");
const NGROK_URL = Deno.env.get("NGROK_URL");

if (!SECRET_TOKEN) {
    logger.error("ERROR: SECRET_TOKEN not set in .env", DColors.red);
    Deno.exit(1);
}

if (!NGROK_URL) {
    logger.error("ERROR: NGROK_URL not set in .env", DColors.red);
    Deno.exit(1);
}

logger.info("✅ Environment variables loaded", DColors.green);
logger.info(`📡 NGROK_URL: ${NGROK_URL}`, DColors.cyan);

// —————————————————————————————————————————————
// 2. HELPER FUNCTIONS
// —————————————————————————————————————————————

function getBearerHeaders(): HeadersInit {
    return {
        Authorization: `Bearer ${SECRET_TOKEN}`,
        "Content-Type": "application/json",
    };
}

async function triggerJob(jobName: string) {
    const url = `${NGROK_URL}/api/jobs/run/${jobName}`;
    logger.info(`[CRON] 🚀 Triggering job: ${jobName}`, DColors.cyan);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: getBearerHeaders(),
        });

        if (res.status === 202) {
            logger.info(`✅ [CRON] ${jobName} triggered successfully`, DColors.green);
        } else if (res.status === 404) {
            logger.error(`❌ [CRON] ${jobName} not found (404)`, DColors.red);
        } else if (res.status === 401) {
            logger.error(`❌ [CRON] ${jobName} unauthorized (401)`, DColors.red);
        } else {
            const text = await res.text();
            logger.warn(
                `⚠️ [CRON] ${jobName} returned ${res.status}: ${text}`,
                DColors.yellow,
            );
        }
    } catch (e) {
        logger.error(
            `❌ [CRON] ${jobName} failed: ${(e as Error).message}`,
            DColors.red,
        );
    }
}

// —————————————————————————————————————————————
// 3. CRON JOBS
// —————————————————————————————————————————————

// 1h Job: Every hour at minute 0
Deno.cron("1h Cache Update", "0 * * * *", async () => {
    await triggerJob("job-1h");
});

// 4h Job: Every 4 hours at minute 0
Deno.cron("4h Cache Update", "0 */4 * * *", async () => {
    await triggerJob("job-4h");
});

// 8h Job: Every 8 hours at minute 0
Deno.cron("8h Cache Update", "0 */8 * * *", async () => {
    await triggerJob("job-8h");
});

// 12h Job: Every 12 hours at minute 0
Deno.cron("12h Cache Update", "0 */12 * * *", async () => {
    await triggerJob("job-12h");
});

// 1d Job: Daily at midnight (00:00)
Deno.cron("1d Cache Update", "0 0 * * *", async () => {
    await triggerJob("job-1d");
});

logger.info("✅ Cron jobs configured and running", DColors.green);
logger.info("📋 Schedules:", DColors.cyan);
logger.info("  • 1h:  Every hour at :00", DColors.cyan);
logger.info("  • 4h:  Every 4 hours at :00", DColors.cyan);
logger.info("  • 8h:  Every 8 hours at :00", DColors.cyan);
logger.info("  • 12h: Every 12 hours at :00", DColors.cyan);
logger.info("  • 1d:  Daily at 00:00", DColors.cyan);
logger.info("🔄 Cron service is running. Press Ctrl+C to stop.", DColors.green);
