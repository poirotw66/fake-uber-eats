#!/usr/bin/env node
/**
 * Split app.legacy.js into window.App modules (classic scripts, shared via App namespace).
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const lines = readFileSync(join(ROOT, "app.legacy.js"), "utf8").split("\n");

function extract(ranges) {
    return ranges
        .map(([a, b]) => lines.slice(a - 1, b).join("\n"))
        .filter(Boolean)
        .join("\n\n");
}

const MODULE_EXPORTS = {
    core: [
        "CONFIG",
        "LOCATION_STORAGE_KEY",
        "FEED_PAGE_SIZE",
        "MENU_CACHE_MAX",
        "VEHICLES",
        "GENERIC_MENUS",
        "TIMELINE_STEPS",
        "FEED_CATEGORY_RULES",
        "state",
        "$",
        "escapeHtml",
        "escapeRegex",
        "normalizeSearch",
        "highlightText",
        "formatPrice",
        "showToast",
        "delay",
        "hashCode",
        "getAnchorLocation",
        "spreadRestaurantCoordinates",
        "resolveRestaurantLocation",
        "decorateRestaurantLocations",
        "estimateDeliveryMinutes",
        "decorateDeliveryEstimates",
        "updateHeaderDeliveryLabel",
        "getRestaurantMapLocation",
        "isLocalAssetPath",
        "applyRestaurantImages",
        "distanceKm",
        "loadSiteConfig",
    ],
    geocode: [
        "reverseGeocode",
        "forwardGeocode",
        "loadSavedLocation",
        "persistLocation",
        "updateAddressDisplay",
        "openAddressSheet",
        "closeAddressSheet",
        "saveAddress",
        "useGps",
        "commitAddressLocation",
    ],
    feed: [
        "emojiForAmenity",
        "buildMenuFromTemplate",
        "renderThumb",
        "firstLocalMenuImage",
        "setRestaurantHero",
        "loadRestaurantFeed",
        "loadSeedRestaurantsLegacy",
        "ensureRestaurantMenu",
        "setMenuCache",
        "prefetchRestaurantMenu",
        "loadSeedRestaurants",
        "groupMenuByCategory",
        "renderBadge",
        "renderQtyControl",
        "bindQtyControl",
        "renderMenuCard",
        "renderFeaturedCard",
        "fetchOsmRestaurants",
        "inferFeedCategory",
        "getFeedCategories",
        "getRestaurantDistanceKm",
        "sortRestaurantList",
        "applyFeedFilters",
        "restaurantMatchesSearch",
        "findSearchMenuMatch",
        "getSearchMenuHint",
        "applyCategoryFilter",
        "renderFeedCategories",
        "refreshRestaurants",
        "refreshLocationDependentUi",
        "initMap",
        "updateHomeMapAddress",
        "updateMapMarkers",
        "showFeedSkeleton",
        "showMenuSkeleton",
        "scrollToFirstSearchHit",
        "categorySlug",
        "shouldGroupFeedByCategory",
        "renderStoreCard",
        "bindStoreCards",
        "disconnectFeedObserver",
        "setupFeedInfiniteScroll",
        "loadMoreFeed",
        "renderRestaurantList",
        "applyMenuSearch",
        "bindSearchInputs",
        "openRestaurant",
        "renderRestaurantPage",
        "showRestaurantRouteAsync",
    ],
    cart: [
        "getCartItems",
        "getFees",
        "clearCart",
        "addToCart",
        "setCartQty",
        "refreshMenuQtyUi",
        "openCheckout",
        "renderCheckoutPage",
        "updateCartBar",
        "getVehicle",
        "renderVehiclePicker",
        "processPayment",
    ],
    tracking: [
        "cleanupTracking",
        "setTimelineStep",
        "renderTimeline",
        "startTracking",
        "syncTrackingEtaDisplay",
        "createMapPinMarker",
        "createDriverMarker",
        "clearRoutePolylines",
        "clearRouteLayer",
        "buildRemainingLatLngs",
        "updateRouteRemaining",
        "drawRouteLine",
        "initTrackingMap",
        "runTrackingStages",
        "interpolate",
        "quadraticBezier",
        "easeInOut",
        "pathLength",
        "pointAtDistance",
        "bearingBetween",
        "screenBearingBetween",
        "buildDriverMarkerTransform",
        "setDriverMarkerBearing",
        "updateDriverFacing",
        "fetchOsrmRoute",
        "fallbackRoadPath",
        "densifyPath",
        "buildArcPath",
        "buildDriftPath",
        "applyWobble",
        "buildDeliveryPath",
        "keepDriverInView",
        "animateAlongPath",
        "arriveAtDoor",
        "spawnConfetti",
        "spawnEmojiRain",
        "launchCelebration",
        "bindMeetStars",
        "showReveal",
        "resetApp",
    ],
    router: [
        "ROUTE",
        "router",
        "showScreen",
        "showHomeRoute",
        "showRestaurantRoute",
        "showCheckoutRoute",
        "showTrackingRoute",
    ],
    app: ["bindEvents", "onViewportResize", "init"],
};

const MODULE_RANGES = {
    core: [
        [1, 16],
        [18, 116],
        [200, 237],
        [354, 483],
        [577, 590],
        [811, 821],
        [823, 832],
        [1904, 1906],
    ],
    geocode: [[1037, 1383]],
    feed: [
        [515, 576],
        [592, 809],
        [834, 920],
        [922, 1035],
        [1385, 1642],
        [1644, 1734],
        [284, 304],
    ],
    cart: [
        [331, 352],
        [485, 513],
        [1736, 1848],
        [1870, 1902],
    ],
    tracking: [
        [238, 247],
        [1850, 1868],
        [1908, 2610],
    ],
    router: [
        [118, 198],
        [249, 271],
        [273, 278],
        [280, 282],
        [306, 329],
    ],
    app: [[2612, 2704]],
};

function wrapModule(name, body, exports) {
    const assign = exports.map((sym) => `    ${sym},`).join("\n");
    return `/* js/${name}.js */
window.App = window.App || {};
(function (App) {
"use strict";

${body}

Object.assign(App, {
${assign}
});
})(window.App);
`;
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patchReferences(body, { members = [], calls = [], idents = [] }) {
    let out = body;
    for (const sym of members) {
        const re = new RegExp(`(?<!App\\.)\\b${escapeRegExp(sym)}\\.`, "g");
        out = out.replace(re, `App.${sym}.`);
    }
    for (const sym of idents) {
        const re = new RegExp(`(?<!App\\.)\\b${escapeRegExp(sym)}\\b`, "g");
        out = out.replace(re, `App.${sym}`);
    }
    for (const sym of calls) {
        if (sym === "$") {
            out = out.replace(/(?<!App\.)\$\(/g, "App.$(");
            continue;
        }
        const re = new RegExp(`(?<!function )(?<!App\\.)\\b${escapeRegExp(sym)}\\(`, "g");
        out = out.replace(re, `App.${sym}(`);
    }
    out = out.replace(/App\.App\./g, "App.");
    return out;
}

function patchCrossModule(name, body) {
    let out = body;
    if (name === "router") {
        out = out.replace(/\bcleanupTracking\(\)/g, "App.cleanupTracking()");
    }
    if (name === "core") return out;

    const coreIdents = [
        "LOCATION_STORAGE_KEY",
        "FEED_PAGE_SIZE",
        "MENU_CACHE_MAX",
        "VEHICLES",
        "GENERIC_MENUS",
        "TIMELINE_STEPS",
        "FEED_CATEGORY_RULES",
    ];
    const coreMembers = ["CONFIG", "state", ...coreIdents];
    const depMap = {
        geocode: {
            members: [...coreMembers, "ROUTE"],
            calls: ["distanceKm", "showToast", "updateHeaderDeliveryLabel", "refreshLocationDependentUi", "$"],
        },
        feed: {
            members: [...coreMembers, "ROUTE", "router"],
            calls: [
                "escapeHtml",
                "formatPrice",
                "showToast",
                "normalizeSearch",
                "highlightText",
                "hashCode",
                "distanceKm",
                "getAnchorLocation",
                "spreadRestaurantCoordinates",
                "resolveRestaurantLocation",
                "decorateRestaurantLocations",
                "estimateDeliveryMinutes",
                "getRestaurantMapLocation",
                "applyRestaurantImages",
                "showScreen",
                "clearCart",
                "openAddressSheet",
                "addToCart",
                "setCartQty",
                "isLocalAssetPath",
                "updateCartBar",
                "$",
            ],
        },
        cart: {
            members: [...coreMembers, "ROUTE", "router"],
            calls: [
                "formatPrice",
                "showToast",
                "renderThumb",
                "delay",
                "getRestaurantMapLocation",
                "showScreen",
                "startTracking",
                "applyRestaurantImages",
                "ensureRestaurantMenu",
                "setRestaurantHero",
                "groupMenuByCategory",
                "renderMenuCard",
                "renderFeaturedCard",
                "showMenuSkeleton",
                "applyMenuSearch",
                "normalizeSearch",
                "renderQtyControl",
                "bindQtyControl",
                "$",
            ],
        },
        tracking: {
            members: [...coreMembers, "ROUTE", "router"],
            calls: [
                "formatPrice",
                "showToast",
                "distanceKm",
                "delay",
                "getRestaurantMapLocation",
                "showScreen",
                "getVehicle",
                "getFees",
                "getCartItems",
                "renderThumb",
                "clearCart",
                "$",
            ],
        },
        router: {
            members: [...coreMembers, "ROUTE", "router"],
            calls: [
                "clearCart",
                "updateCartBar",
                "getCartItems",
                "renderCheckoutPage",
                "showRestaurantRouteAsync",
                "renderRestaurantPage",
                "applyMenuSearch",
                "normalizeSearch",
                "$",
            ],
        },
        app: {
            members: [...coreMembers, "ROUTE", "router"],
            calls: [
                "showToast",
                "loadSiteConfig",
                "loadSavedLocation",
                "openAddressSheet",
                "closeAddressSheet",
                "saveAddress",
                "useGps",
                "updateAddressDisplay",
                "refreshRestaurants",
                "bindSearchInputs",
                "initMap",
                "updateHomeMapAddress",
                "applyFeedFilters",
                "renderRestaurantList",
                "openCheckout",
                "clearCart",
                "processPayment",
                "updateCartBar",
                "resetApp",
                "showReveal",
                "showFeedSkeleton",
                "$",
            ],
        },
    };

    const patch = depMap[name];
    if (!patch) return out;
    out = patchReferences(out, {
        members: patch.members,
        calls: patch.calls,
        idents: coreIdents,
    });
    if (name === "app") {
        const handlerRefs = [
            "openAddressSheet",
            "closeAddressSheet",
            "saveAddress",
            "useGps",
            "openCheckout",
            "showReveal",
            "resetApp",
        ];
        for (const sym of handlerRefs) {
            const re = new RegExp(
                `addEventListener\\(([^,]+),\\s*${escapeRegExp(sym)}\\)`,
                "g"
            );
            out = out.replace(re, `addEventListener($1, App.${sym})`);
        }
    }
    if (name === "feed") {
        out = out.replace(/\.map\(applyRestaurantImages\)/g, ".map(App.applyRestaurantImages)");
    }
    return out;
}

function patchBody(name, body) {
    return patchCrossModule(name, body);
}

mkdirSync(join(ROOT, "js"), { recursive: true });

for (const [name, ranges] of Object.entries(MODULE_RANGES)) {
    const body = patchBody(name, extract(ranges));
    const content = wrapModule(name, body, MODULE_EXPORTS[name]);
    writeFileSync(join(ROOT, "js", `${name}.js`), content);
}

// Thin root app.js loader note
writeFileSync(
    join(ROOT, "app.js"),
    `/* Loader: modules live in js/. Kept for backwards compatibility. */
console.warn("Load js/app.js via index.html script tags, not app.js root.");
`
);

console.log("Built js/core.js, geocode.js, feed.js, cart.js, tracking.js, router.js, app.js");
