import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./index.js";

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "migrations");

async function run() {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS migrations (" +
    " name TEXT PRIMARY KEY," +
    " applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
  );

  const done = new Set((await pool.query("SELECT name FROM migrations")).rows.map((r) => r.name));
  const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

  let ran = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(resolve(DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log("  + " + file);
      ran += 1;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("  x " + file + " ล้มเหลว: " + err.message);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  console.log(ran ? "  รัน migration ใหม่ " + ran + " ไฟล์" : "  ไม่มี migration ใหม่");
  await pool.end();
}

run().catch((err) => {
  console.error("  x migrate ล้มเหลว: " + err.message);
  process.exit(1);
});
