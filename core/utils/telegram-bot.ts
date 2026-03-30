import { CONFIG } from "../../config.ts";

export class TelegramBot {
    private static instance: TelegramBot;
    private token: string;
    private userId: string;
    private baseUrl: string;

    private constructor() {
        this.token = CONFIG.TELEGRAM.BOT_TOKEN;
        this.userId = CONFIG.TELEGRAM.USER_ID;
        this.baseUrl = `https://api.telegram.org/bot${this.token}`;
    }

    public static getInstance(): TelegramBot {
        if (!TelegramBot.instance) {
            TelegramBot.instance = new TelegramBot();
        }
        return TelegramBot.instance;
    }

    private async send(message: string): Promise<void> {
        if (!this.token || !this.userId) {
            console.warn("⚠️ Telegram Bot Token or User ID is missing.");
            return;
        }

        try {
            const url = `${this.baseUrl}/sendMessage`;
            const body = {
                chat_id: this.userId,
                text: message,
                parse_mode: "HTML",
            };

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Telegram API Error (${response.status}): ${errorText}`);
            }
        } catch (error) {
            console.error("❌ Failed to send Telegram message (Network Error):", error);
        }
    }

    private getFormattedTime(): string {
        const now = new Date();
        // Format: 2026-02-09, 9:46:51 PM
        const datePart = now.toLocaleDateString("en-CA"); // YYYY-MM-DD
        const timePart = now.toLocaleTimeString("en-US", { hour12: true });
        return `${datePart}, ${timePart}`;
    }

    public async notifyStart(): Promise<void> {
        const msg = `
🚀 <b>Server Started!</b>

✅ Initial data loading requested.

🕒 <code>${this.getFormattedTime()}</code>
    `.trim();
        await this.send(msg);
    }

    public async notifyStop(reason: string = "Manual Shutdown"): Promise<void> {
        const msg = `
🛑 <b>Server Stopped</b>

⚠️ Reason: ${reason}

🕒 <code>${this.getFormattedTime()}</code>
    `.trim();
        await this.send(msg);
    }

    /**
     * Sends a pre-formatted HTML metric alert message.
     * The caller is responsible for building the full message string.
     */
    public async notifyMetricAlert(message: string): Promise<void> {
        await this.send(message);
    }

    public async notifyError(message: string, error?: unknown): Promise<void> {
        let errorDetails = "";
        if (error instanceof Error) {
            errorDetails = `\n\n📜 <i>${error.message}</i>`;
        } else if (typeof error === "string") {
            errorDetails = `\n\n📜 <i>${error}</i>`;
        }

        const msg = `
❌ <b>Error Occurred</b>

❗ <b>${message}</b>${errorDetails}

🕒 <code>${this.getFormattedTime()}</code>
    `.trim();
        await this.send(msg);
    }
}

export const telegramBot = TelegramBot.getInstance();
