import { load } from "https://deno.land/std@0.215.0/dotenv/mod.ts";

await load({ export: true });
const token = Deno.env.get("SECRET_TOKEN");

console.log("Testing /api/cache/1h...");
const start = performance.now();

try {
    const res = await fetch("http://localhost:80/api/cache/1h", {
        headers: {
            Authorization: `Bearer ${token}`,
            "Accept-Encoding": "gzip, deflate, br",
        },
    });
    const ms = performance.now() - start;
    console.log(`Status: ${res.status}, Time: ${ms.toFixed(0)}ms`);

    const text = await res.text();
    console.log(`Response size: ${(text.length / 1024).toFixed(2)} KB`);
    console.log(`Content-Encoding: ${res.headers.get("content-encoding") || "none"}`);
} catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error("Error:", errorMsg);
}
