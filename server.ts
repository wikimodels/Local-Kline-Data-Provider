// Deno imports
import { load } from "https://deno.land/std@0.215.0/dotenv/mod.ts";
// @ts-ignore: npm export issue
import express, { Request, Response, NextFunction } from "npm:express";
// @ts-ignore: npm export issue
import cors from "npm:cors";
// @ts-ignore: npm export issue
import compression from "npm:compression";
import { DataStore } from "./store/store.ts";
import { logger } from "./core/utils/logger.ts";
import { DColors, TF, JobResult, CoinMarketData } from "./models/types.ts";

// Import jobs
import { run1hJob } from "./jobs/job-1h.ts";
import { run4hJob } from "./jobs/job-4h.ts";
import { run8hJob } from "./jobs/job-8h.ts";
import { run12hJob } from "./jobs/job-12h.ts";
import { run1dJob } from "./jobs/job-1d.ts";

// —————————————————————————————————————————————
// 1. LOAD ENVIRONMENT VARIABLES
// —————————————————————————————————————————————

// Load .env and export to Deno.env
await load({ export: true });

const PORT = 80;
const SECRET_TOKEN = Deno.env.get("SECRET_TOKEN");
const NGROK_URL = Deno.env.get("NGROK_URL");

if (!SECRET_TOKEN) {
  logger.error("SECRET_TOKEN is not set in .env");
  Deno.exit(1);
}

if (!NGROK_URL) {
  logger.error("NGROK_URL is not set in .env");
  Deno.exit(1);
}

// —————————————————————————————————————————————
// 2. EXPRESS SERVER SETUP
// —————————————————————————————————————————————

const app = express();

// Enable compression for all responses
app.use(compression({
  level: 6, // Compression level (0-9, 6 is good balance)
  threshold: 1024, // Only compress responses > 1KB
}));

app.use(cors());
app.use(express.json());

// Initialize storage
DataStore.init();

// —————————————————————————————————————————————
// 2. JOBS REGISTRY
// —————————————————————————————————————————————

const jobs: Record<string, () => Promise<JobResult>> = {
  "job-1h": run1hJob,
  "job-4h": run4hJob,
  "job-8h": run8hJob,
  "job-12h": run12hJob,
  "job-1d": run1dJob,
};

// —————————————————————————————————————————————
// 3. MIDDLEWARE
// —————————————————————————————————————————————

const checkAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${SECRET_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// —————————————————————————————————————————————
// 4. API ENDPOINTS
// —————————————————————————————————————————————

// --- ENDPOINT 0: Health Check (NO AUTH) ---
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    time: Date.now(),
    url: NGROK_URL,
  });
});

// --- ENDPOINT 1: Get cached data ---
app.get("/api/cache/:tf", checkAuth, async (req: Request, res: Response) => {
  try {
    const { tf } = req.params;

    // Handle "all" timeframes
    if (tf === "all") {
      const allData = await DataStore.getAll();
      return res.status(200).json({ success: true, data: allData });
    }

    // Validate timeframe
    const validTimeframes: TF[] = ["1h", "4h", "8h", "12h", "D"];
    if (!validTimeframes.includes(tf as TF)) {
      return res.status(400).json({ error: `Invalid timeframe: ${tf}` });
    }

    const timeframe = tf as TF;
    const cachedData = await DataStore.get(timeframe);

    if (cachedData) {
      return res.status(200).json({
        success: true,
        data: cachedData,
        cached: true,
      });
    }

    // No cache found
    return res.status(404).json({
      error: `No cache found for timeframe: ${timeframe}`,
    });
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    logger.error(`[API] Error in cache endpoint: ${errorMsg}`, e);
    return res.status(500).json({ error: errorMsg });
  }
});

// --- ENDPOINT 2: Trigger job ---
app.post("/api/jobs/run/:jobName", checkAuth, (req: Request, res: Response) => {
  try {
    const rawJobName = req.params.jobName;
    const jobName = Array.isArray(rawJobName) ? rawJobName[0] : rawJobName;

    if (jobName && jobName in jobs) {
      const jobToRun = jobs[jobName as keyof typeof jobs];
      jobToRun(); // Run asynchronously

      return res.status(202).json({
        success: true,
        message: `Job '${jobName}' started successfully.`,
      });
    } else {
      return res
        .status(404)
        .json({ error: `Job '${jobName || "undefined"}' not found.` });
    }
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    logger.error(`[API] Error running job: ${errorMsg}`, e);
    return res.status(500).json({ error: errorMsg });
  }
});

// --- ENDPOINT 3: Get latest BTC 1h candle ---
app.get(
  "/api/1h-btc-candle",
  checkAuth,
  async (_req: Request, res: Response) => {
    try {
      const tf = "1h" as TF;
      const symbolToFind = "BTCUSDT";

      const cache1h = await DataStore.get(tf);

      if (!cache1h || !cache1h.data) {
        return res.status(444).json({
          error: `Cache for timeframe '${tf}' is empty or invalid.`,
        });
      }

      const symbolData = cache1h.data.find(
        (coin: CoinMarketData) => coin.symbol === symbolToFind,
      );

      if (!symbolData) {
        return res.status(404).json({
          error: `Data for '${symbolToFind}' not found in '${tf}' cache.`,
        });
      }

      if (!symbolData.candles || symbolData.candles.length === 0) {
        return res.status(404).json({
          error: `Field 'candles' is empty for '${symbolToFind}' in '${tf}' cache.`,
        });
      }

      const candle = symbolData.candles[symbolData.candles.length - 1];

      return res.status(200).json({ success: true, data: candle });
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      logger.error(`[API] Error in btc-candle endpoint: ${errorMsg}`, e);
      return res.status(500).json({ success: false, error: errorMsg });
    }
  },
);

// --- 404 Handler ---
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

// —————————————————————————————————————————————
// 5. START EXPRESS SERVER
// —————————————————————————————————————————————

app.listen(PORT, () => {
  logger.info(
    `🚀 [SERVER] Express server started on http://localhost:${PORT}`,
    DColors.green,
  );
  logger.info(`[SERVER] Health check: GET /health (no auth)`, DColors.cyan);
  logger.info(
    `[SERVER] API requires: Authorization: Bearer <TOKEN>`,
    DColors.cyan,
  );
});

// —————————————————————————————————————————————
// 4. START NGROK TUNNEL
// —————————————————————————————————————————————

// Kill any existing ngrok processes to avoid ERR_NGROK_108
logger.info("🔄 Cleaning up old ngrok processes...", DColors.cyan);
try {
  const killCommand = new Deno.Command("powershell", {
    args: [
      "-Command",
      "Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force",
    ],
  });
  await killCommand.output();
  logger.info("✅ Old ngrok processes cleaned up", DColors.green);
} catch (_error) {
  logger.warn("⚠️ No old ngrok processes to clean up", DColors.yellow);
}

// Wait a bit for processes to fully terminate
await new Promise((resolve) => setTimeout(resolve, 1500));

logger.info(`🚀 [NGROK] Starting tunnel for ${NGROK_URL}...`, DColors.cyan);

const ngrokProcess = new Deno.Command("ngrok", {
  args: ["http", `--url=${NGROK_URL}`, String(PORT)],
  stdout: "piped",
  stderr: "piped",
}).spawn();

logger.info(
  `✅ [NGROK] Started for ${NGROK_URL} (pid=${ngrokProcess.pid})`,
  DColors.green,
);

// Log ngrok output
const decoder = new TextDecoder();

(async () => {
  for await (const chunk of ngrokProcess.stdout) {
    console.log("[ngrok]", decoder.decode(chunk));
  }
})();

(async () => {
  for await (const chunk of ngrokProcess.stderr) {
    console.error("[ngrok]", decoder.decode(chunk));
  }
})();

// Graceful shutdown on Ctrl+C
addEventListener("SIGINT", () => {
  logger.info("\n🛑 SIGINT received, shutting down...", DColors.yellow);
  try {
    ngrokProcess.kill("SIGTERM");
  } catch {
    // ignore
  }
  Deno.exit(0);
});

logger.info("🚀 All systems running. Use Ctrl+C to stop.", DColors.green);

// —————————————————————————————————————————————
// AUTO-START JOBS ON SERVER LAUNCH
// —————————————————————————————————————————————

async function initializeJobs() {
  logger.info("🔄 Starting initial jobs (1h, 8h, 1d)...", DColors.cyan);

  try {
    const results = await Promise.allSettled([
      run1hJob(),
      run8hJob(),
      run1dJob(),
    ]);

    results.forEach((result, index) => {
      const jobName = ["1h", "8h", "1d"][index];
      if (result.status === "fulfilled") {
        logger.info(
          `✅ [${jobName}] Initial job completed successfully`,
          DColors.green,
        );
      } else {
        logger.error(
          `❌ [${jobName}] Initial job failed: ${result.reason}`,
          DColors.red,
        );
      }
    });

    logger.info("✅ Initial jobs completed", DColors.green);
  } catch (error) {
    logger.error(`❌ Error during initial jobs: ${error}`, DColors.red);
  }
}

// Start initialization after a short delay to ensure server is ready
setTimeout(() => {
  initializeJobs();
}, 2000);

// —————————————————————————————————————————————
// 6. CRON JOBS FOR AUTOMATIC CACHE UPDATES
// —————————————————————————————————————————————

async function triggerJob(jobName: string) {
  const url = `${NGROK_URL}/api/jobs/run/${jobName}`;
  logger.info(`[CRON] 🚀 Triggering job: ${jobName}`, DColors.cyan);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SECRET_TOKEN}`,
        "Content-Type": "application/json",
      },
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
logger.info("📋 Cron Schedules:", DColors.cyan);
logger.info("  • 1h:  Every hour at :00", DColors.cyan);
logger.info("  • 4h:  Every 4 hours at :00", DColors.cyan);
logger.info("  • 8h:  Every 8 hours at :00", DColors.cyan);
logger.info("  • 12h: Every 12 hours at :00", DColors.cyan);
logger.info("  • 1d:  Daily at 00:00", DColors.cyan);
