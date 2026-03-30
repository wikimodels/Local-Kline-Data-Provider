import { metricAlertService } from "./services/metrics/metric-alert.service.ts";

async function testFullAlert() {
    console.log("Generating full test alert based on thresholds.json...");

    // Read actual thresholds.json structure
    const raw = await Deno.readTextFile("./thresholds.json");
    const configData = JSON.parse(raw);

    const categoryMap = new Map<string, { desc: string; alerts: any[] }>();

    for (const item of configData) {
        if (!categoryMap.has(item.category)) {
            categoryMap.set(item.category, { desc: item.description, alerts: [] });
        }

        // Add a fake alert for each metric
        const fakeValue = Math.floor(Math.random() * 40) + 20; // Random value between 20-60

        categoryMap.get(item.category)!.alerts.push({
            result: { key: item.key, label: item.title, value: fakeValue, coinsCount: 853 },
            threshold: 5
        });
    }

    const report = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        desc: data.desc,
        alerts: data.alerts
    }));

    console.log("Sending to Telegram...");
    // Mock open time, representing for instance specifically a custom date for testing
    // February 20, 2026 16:25:00 UTC+3 is roughly 1740057900000 UTC
    // Let's just create a Date object
    const mockOpenTime = new Date("2026-02-20T16:25:00+03:00").getTime();

    // Force sending the formatted report
    await (metricAlertService as any).sendFormattedAlert("1D", report, 154, mockOpenTime);

    console.log("Done! Check Telegram for the full report.");
    Deno.exit(0);
}

testFullAlert();
