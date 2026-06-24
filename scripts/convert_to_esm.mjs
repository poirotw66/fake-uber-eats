#!/usr/bin/env node
/** Convert window.App IIFE modules to ESM that share app-ns.js. */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULES = ["core", "geocode", "cart", "tracking", "feed", "router", "app"];

const headerRe = /^\/\*[\s\S]*?\*\/\nwindow\.App[\s\S]*?\(function \(App\) \{\n"use strict";\n\n/;

for (const name of MODULES) {
    const path = join(ROOT, "js", `${name}.js`);
    let code = readFileSync(path, "utf8");
    code = code.replace(headerRe, "");
    code = code.replace(/\n\}\)\(window\.App\);\n?$/, "\n");
    code = code.replace(/\ndocument\.addEventListener\("DOMContentLoaded", init\);\n/, "\n");
    code = `import { App } from "./app-ns.js";\n\n${code}`;
    writeFileSync(path, code);
}

writeFileSync(
    join(ROOT, "js", "app-ns.js"),
    `/** Shared application namespace for classic App.* wiring. */\nexport const App = {};\nif (typeof window !== "undefined") {\n    window.App = App;\n}\n`
);

writeFileSync(
    join(ROOT, "js", "main.js"),
    `import "./core.js";\nimport "./geocode.js";\nimport "./cart.js";\nimport "./tracking.js";\nimport "./feed.js";\nimport "./router.js";\nimport "./app.js";\nimport { App } from "./app-ns.js";\n\ndocument.addEventListener("DOMContentLoaded", () => {\n    App.init();\n});\n`
);

console.log("Converted js modules to ESM");
