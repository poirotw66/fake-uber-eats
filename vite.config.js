import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
    build: {
        outDir: "js",
        emptyOutDir: false,
        lib: {
            entry: resolve(root, "js/main.js"),
            formats: ["iife"],
            name: "FakeUberEatsApp",
            fileName: () => "app.bundle.js",
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
        minify: true,
        sourcemap: false,
    },
});
