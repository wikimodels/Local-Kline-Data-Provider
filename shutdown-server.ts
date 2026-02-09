// shutdown-server.ts
import { load } from "https://deno.land/std@0.215.0/dotenv/mod.ts";
import { green, red, yellow } from "npm:colorette@2.0.20";

// Load .env
await load({ export: true });

const PORT = 80;
const SECRET_TOKEN = Deno.env.get("SECRET_TOKEN");

if (!SECRET_TOKEN) {
    console.error(red("❌ SECRET_TOKEN is missing in .env"));
    Deno.exit(1);
}

const url = `http://localhost:${PORT}/api/admin/shutdown`;

console.log(yellow(`Attempting to stop server at ${url}...`));

try {
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${SECRET_TOKEN}`,
            "Content-Type": "application/json",
        },
    });

    if (res.ok) {
        console.log(green("✅ Shutdown signal sent successfully."));
        console.log(green("See Telegram for 'Stopped' notification."));
    } else {
        console.error(red(`❌ Failed to stop server. Status: ${res.status}`));
        const text = await res.text();
        console.error(red(`Response: ${text}`));
        Deno.exit(1);
    }
} catch (error) {
    console.error(red("❌ Could not connect to server. Is it running?"));
    console.error(red(`Error: ${(error as Error).message}`));
    Deno.exit(1);
}
