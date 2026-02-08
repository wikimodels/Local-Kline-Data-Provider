// Error logging utility for saving detailed error information to file
import { DColors } from "../../models/types.ts";
import { logger } from "./logger.ts";

const ERROR_LOG_FILE = "logs/error-logs.txt";

/**
 * Ensure logs directory exists
 */
async function ensureLogsDir() {
    try {
        await Deno.mkdir("logs", { recursive: true });
    } catch (error) {
        // Directory already exists, ignore
    }
}

/**
 * Format timestamp for log entries
 */
function getTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Log detailed error information to file
 */
export async function logErrorToFile(
    context: string,
    symbol: string,
    error: Error | string,
    additionalData?: Record<string, unknown>,
) {
    await ensureLogsDir();

    const timestamp = getTimestamp();
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : "N/A";

    const logEntry = [
        `\n${"=".repeat(80)}`,
        `[${timestamp}] ERROR in ${context}`,
        `Symbol: ${symbol}`,
        `Error: ${errorMessage}`,
        `Stack: ${errorStack}`,
    ];

    if (additionalData) {
        logEntry.push(`Additional Data:`);
        for (const [key, value] of Object.entries(additionalData)) {
            logEntry.push(`  ${key}: ${JSON.stringify(value, null, 2)}`);
        }
    }

    logEntry.push(`${"=".repeat(80)}\n`);

    const logText = logEntry.join("\n");

    try {
        await Deno.writeTextFile(ERROR_LOG_FILE, logText, { append: true });
        logger.info(
            `[ERROR LOG] Saved to ${ERROR_LOG_FILE}`,
            DColors.yellow,
        );
    } catch (writeError) {
        logger.error(
            `[ERROR LOG] Failed to write to file: ${writeError}`,
            DColors.red,
        );
    }
}

/**
 * Log Bybit API response error with full response details
 */
export async function logBybitApiError(
    symbol: string,
    url: string,
    responseStatus: number,
    responseBody: unknown,
) {
    await ensureLogsDir();

    const timestamp = getTimestamp();

    const logEntry = [
        `\n${"=".repeat(80)}`,
        `[${timestamp}] BYBIT API ERROR`,
        `Symbol: ${symbol}`,
        `URL: ${url}`,
        `HTTP Status: ${responseStatus}`,
        `Response Body:`,
        JSON.stringify(responseBody, null, 2),
        `${"=".repeat(80)}\n`,
    ];

    const logText = logEntry.join("\n");

    try {
        await Deno.writeTextFile(ERROR_LOG_FILE, logText, { append: true });
        logger.warn(
            `[BYBIT ERROR] Logged API error for ${symbol} to ${ERROR_LOG_FILE}`,
            DColors.yellow,
        );
    } catch (writeError) {
        logger.error(
            `[ERROR LOG] Failed to write to file: ${writeError}`,
            DColors.red,
        );
    }
}
