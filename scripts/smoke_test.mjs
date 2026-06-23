#!/usr/bin/env node
/**
 * Load js/* modules in browser-like order and verify App namespace exports.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const MODULE_ORDER = ["core", "geocode", "cart", "tracking", "feed", "router", "app"];

const REQUIRED_EXPORTS = [
    "init",
    "router",
    "ROUTE",
    "state",
    "refreshRestaurants",
    "showRestaurantRouteAsync",
    "cleanupTracking",
    "bindSearchInputs",
    "processPayment",
    "openAddressSheet",
    "renderRestaurantList",
];

function createSandbox() {
    const sandbox = {
        window: {},
        document: {
            addEventListener: () => {},
            querySelector: () => null,
            querySelectorAll: () => [],
            getElementById: () => null,
        },
        localStorage: {
            getItem: () => null,
            setItem: () => {},
        },
        fetch: async () => ({ ok: false }),
        setTimeout,
        clearTimeout,
        requestAnimationFrame: (fn) => {
            fn();
            return 1;
        },
        cancelAnimationFrame: () => {},
        history: { replaceState: () => {}, state: null },
        L: {
            map: () => ({
                setView: () => sandbox.map,
                remove: () => {},
                on: () => {},
                invalidateSize: () => {},
                fitBounds: () => {},
                latLngToContainerPoint: () => ({ x: 0, y: 0 }),
                removeLayer: () => {},
            }),
            marker: () => ({
                addTo: () => ({
                    bindPopup: () => {},
                    setLatLng: () => {},
                    getElement: () => ({ style: {} }),
                }),
                setLatLng: () => {},
                getElement: () => ({ style: {} }),
            }),
            circleMarker: () => ({ addTo: () => ({}) }),
            polyline: () => ({ addTo: () => ({}) }),
            divIcon: () => ({}),
            latLngBounds: () => ({ pad: () => ({}), contains: () => true }),
        },
        console,
    };
    sandbox.window = sandbox;
    sandbox.App = sandbox.window.App = {};
    return sandbox;
}

function loadModules(sandbox) {
    for (const name of MODULE_ORDER) {
        const code = readFileSync(join(ROOT, "js", `${name}.js`), "utf8");
        vm.runInNewContext(code, sandbox, { filename: `js/${name}.js` });
    }
}

function assertExports(app) {
    const missing = REQUIRED_EXPORTS.filter((key) => typeof app[key] === "undefined");
    if (missing.length) {
        throw new Error(`Missing App exports: ${missing.join(", ")}`);
    }
}

function main() {
    for (const name of MODULE_ORDER) {
        const path = join(ROOT, "js", `${name}.js`);
        readFileSync(path, "utf8");
    }

    const sandbox = createSandbox();
    loadModules(sandbox);
    assertExports(sandbox.App);

    console.log(`smoke_test OK (${Object.keys(sandbox.App).length} exports)`);
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
