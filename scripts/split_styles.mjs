#!/usr/bin/env node
/** Split styles.css into focused stylesheets. */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const lines = readFileSync(join(ROOT, "styles.css"), "utf8").split("\n");

const chunks = {
    "css/base.css": [1, 375],
    "css/home.css": [376, 920],
    "css/restaurant.css": [921, 1550],
    "css/checkout.css": [1551, 2006],
    "css/tracking.css": [2007, 3351],
    "css/responsive.css": [3352, lines.length],
};

mkdirSync(join(ROOT, "css"), { recursive: true });

for (const [file, [start, end]] of Object.entries(chunks)) {
    const body = lines.slice(start - 1, end).join("\n").trimEnd() + "\n";
    writeFileSync(join(ROOT, file), `/* ${file} */\n${body}`);
}

const imports = Object.keys(chunks)
    .map((file) => `@import url("${file}");`)
    .join("\n");

writeFileSync(
    join(ROOT, "styles.css"),
    `/* Aggregated styles — load css/*.css directly in index.html for clarity. */\n${imports}\n`
);

console.log("Wrote", Object.keys(chunks).join(", "));
