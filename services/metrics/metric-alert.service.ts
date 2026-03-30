import { MarketData, TF, DColors } from "../../models/types.ts";
import { METRICS_MAP } from "./metrics-registry.ts";
import { MetricResult } from "./metric.interface.ts";
import { telegramBot } from "../../core/utils/telegram-bot.ts";
import { logger } from "../../core/utils/logger.ts";

/** Shape of the new thresholds.json items */
interface ThresholdMetricConfig {
    timeframe: string;
    threshold: number;
    count: number;
    currentPercentage?: number;
}

interface ThresholdItem {
    category: string;
    key: string;
    title: string;
    description: string;
    metrics: ThresholdMetricConfig[];
}

export class MetricAlertService {
    private readonly thresholdsPath = "./thresholds.json";

    private async loadThresholds(): Promise<ThresholdItem[] | null> {
        try {
            const raw = await Deno.readTextFile(this.thresholdsPath);
            return JSON.parse(raw) as ThresholdItem[];
        } catch (e) {
            logger.error(`[MetricAlert] ❌ Failed to load thresholds.json: ${e}`, DColors.red);
            return null;
        }
    }

    private async saveThresholds(data: ThresholdItem[]): Promise<void> {
        try {
            await Deno.writeTextFile(this.thresholdsPath, JSON.stringify(data, null, 4));
        } catch (e) {
            logger.error(`[MetricAlert] ❌ Failed to save thresholds.json: ${e}`, DColors.red);
        }
    }

    public async check(data: MarketData): Promise<void> {
        const tf = data.timeframe;
        const config = await this.loadThresholds();
        if (!config) return;

        logger.info(`[MetricAlert] Checking metrics for ${tf} (${data.data.length} coins)`, DColors.cyan);

        const categoryMap = new Map<string, { desc: string; alerts: Array<{ result: MetricResult; threshold: number }> }>();
        let configChanged = false;

        for (const item of config) {
            const metricConfig = item.metrics.find((m) => m.timeframe === tf);
            if (!metricConfig) continue;

            const metricTrigger = METRICS_MAP.get(item.key);
            if (!metricTrigger) continue;

            // Compute actual value from indicator data
            const result = metricTrigger.compute(data);
            if (result !== null) {
                // UPDATE THE COUNT IN CONFIG ON DISK
                let needsUpdate = false;
                if (metricConfig.count !== result.value) {
                    metricConfig.count = result.value;
                    needsUpdate = true;
                }
                if (result.currentPercentage !== undefined && metricConfig.currentPercentage !== result.currentPercentage) {
                    metricConfig.currentPercentage = result.currentPercentage;
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    configChanged = true;
                }

                // CHECK THRESHOLD
                if (result.value >= metricConfig.threshold) {
                    if (!categoryMap.has(item.category)) {
                        categoryMap.set(item.category, { desc: item.description, alerts: [] });
                    }
                    categoryMap.get(item.category)!.alerts.push({
                        result,
                        threshold: metricConfig.threshold,
                    });
                }
            }
        }

        // Save updated counts back to thresholds.json
        if (configChanged) {
            await this.saveThresholds(config);
            logger.info(`[MetricAlert] 💾 Updated counts in thresholds.json for ${tf}`, DColors.green);
        }

        // Generate report array
        const report = Array.from(categoryMap.entries()).map(([category, data]) => ({
            category,
            desc: data.desc,
            alerts: data.alerts,
        }));

        if (report.length > 0) {
            let realOpenTimeMS = data.openTime;
            if (data.data.length > 0 && data.data[0].candles.length >= 2) {
                const candles = data.data[0].candles;
                realOpenTimeMS = candles[candles.length - 2].openTime;
            }
            await this.sendFormattedAlert(tf, report, data.data.length, realOpenTimeMS);
        } else {
            logger.info(`[MetricAlert] ${tf}: No thresholds hit.`, DColors.gray);
        }
    }

    private async sendFormattedAlert(tf: string, report: any[], totalCoins: number, openTimeMS: number): Promise<void> {
        const formatter = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Moscow",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
        const timestamp = formatter.format(new Date(openTimeMS)).replace(",", "");

        let msg = `✳️✳️✳️✳️✳️✳️✳️✳️\n\n`;
        msg += `<b>Timeframe: ${tf.toUpperCase()}</b>\n`;
        msg += `Last Candle: <code>${timestamp}</code>\n`;
        msg += `<b>Coins: ${totalCoins}</b>\n`;

        for (const block of report) {
            msg += `\n📌 <b>${block.category.toUpperCase()}</b>\n`;
            msg += `<i>${block.desc}</i>\n`;

            for (const alert of block.alerts) {
                if (alert.result.currentPercentage !== undefined) {
                    msg += `• <b>${alert.result.label}</b>: <b>${alert.result.value}</b> <i>(${alert.result.currentPercentage}%)</i>\n`;
                } else {
                    msg += `• <b>${alert.result.label}</b>: <b>${alert.result.value}</b>\n`;
                }
            }
        }

        msg += `\n✴️✴️✴️✴️✴️✴️✴️✴️`;

        await telegramBot.notifyMetricAlert(msg);
    }
}

export const metricAlertService = new MetricAlertService();
