import { App } from "./app-ns.js";

const CONFIG = {
    brandName: "Uber Eats Not!!",
    arcGisGeocodeUrl: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer",
    photonUrl: "https://photon.komoot.io/api",
    osrmUrl: "https://router.project-osrm.org/route/v1",
    driverNames: ["王建國", "李志明", "陳俊宇", "張雅婷", "林冠廷"],
    defaultAddress: "松仁路7-1號",
    defaultLat: 25.0382477,
    defaultLng: 121.5691055,
    deliveryLabel: "25–35 分鐘",
    locationIqKey: "",
};

const LOCATION_STORAGE_KEY = "ue_demo_location_v2";
const FEED_PAGE_SIZE = 24;
const MENU_CACHE_MAX = 24;

const VEHICLES = [
    { id: "motorcycle", name: "機車", emoji: "🛵", tag: "沿街道", weird: false, movement: "road", profile: "driving", speed: 1.0, headingOffset: 90, headingMirror: true },
    { id: "car", name: "汽車", emoji: "🚗", tag: "沿街道", weird: false, movement: "road", profile: "driving", speed: 0.95, headingOffset: 90, headingMirror: true },
    { id: "bicycle", name: "腳踏車", emoji: "🚲", tag: "單車道", weird: false, movement: "road", profile: "cycling", speed: 0.75, headingOffset: 90, headingMirror: true },
    { id: "ebike", name: "電輔車", emoji: "⚡", tag: "單車道", weird: false, movement: "road", profile: "cycling", speed: 0.9, headingOffset: 90, headingMirror: true },
    { id: "walk", name: "步行", emoji: "🚶", tag: "人行道", weird: false, movement: "road", profile: "foot", speed: 0.45, headingOffset: 90, headingMirror: true },
    { id: "horse", name: "馬匹", emoji: "🐴", tag: "慢但穩", weird: false, movement: "road", profile: "foot", speed: 0.55, headingOffset: 90, headingMirror: true },
    { id: "rollerskates", name: "溜冰鞋", emoji: "🛼", tag: "搖擺前進", weird: false, movement: "wobble", profile: "foot", speed: 1.0, headingOffset: 90, headingMirror: true },
    { id: "helicopter", name: "直升機", emoji: "🚁", tag: "空中直飛", weird: true, movement: "fly", speed: 2.2, headingOffset: 0 },
    { id: "drone", name: "空拍機", emoji: "📦", tag: "低空飛行", weird: true, movement: "fly", speed: 1.8, headingOffset: 0 },
    { id: "ufo", name: "UFO", emoji: "🛸", tag: "神秘路線", weird: true, movement: "fly", speed: 2.8, headingOffset: 0 },
    { id: "balloon", name: "熱氣球", emoji: "🎈", tag: "隨風飄移", weird: true, movement: "drift", speed: 0.55, headingOffset: 0 },
    { id: "rocket", name: "火箭", emoji: "🚀", tag: "拋物線", weird: true, movement: "arc", speed: 3.5, headingOffset: 0 },
    { id: "teleport", name: "瞬移", emoji: "✨", tag: "閃現跳躍", weird: true, movement: "teleport", profile: "driving", speed: 4.0, headingOffset: 0 },
    { id: "tank", name: "坦克", emoji: "🛡️", tag: "壓馬路", weird: true, movement: "road", profile: "driving", speed: 0.3, headingOffset: 90, headingMirror: true },
    { id: "submarine", name: "潛水艇", emoji: "🫧", tag: "地底直穿", weird: true, movement: "underground", speed: 2.0, headingOffset: 0 },
    { id: "pigeon", name: "信鴿", emoji: "🕊️", tag: "鳥類航線", weird: true, movement: "fly", speed: 1.6, headingOffset: 0 },
];

const TIMELINE_STEPS = [
    { key: "placed", text: "訂單已確認", sub: "店家已收到你的訂單" },
    { key: "preparing", text: "店家準備中", sub: "餐點正在製作，請稍候" },
    { key: "pickup", text: "外送員取餐中", sub: "外送員已抵達餐廳" },
    { key: "delivering", text: "外送中", sub: "餐點正在前往你的地址" },
    { key: "arrived", text: "已送達門口", sub: "請至門口與外送員碰面" },
];

const state = {
    cart: {},
    tip: 30,
    paymentMethod: "visa",
    restaurants: [],
    filteredRestaurants: [],
    activeCategory: "全部",
    selectedRestaurant: null,
    userLocation: null,
    addressLine: "",
    addressDetail: "",
    map: null,
    trackingMap: null,
    markers: {},
    driverAnimationId: null,
    orderTotal: 0,
    driverName: "",
    selectedVehicleId: "motorcycle",
    routeLayer: null,
    routePolylines: null,
    routePath: null,
    routeStyle: null,
    deliveryPath: null,
    searchQuery: "",
    feedSort: "distance",
    minRating: 0,
    feedRenderedCount: FEED_PAGE_SIZE,
    feedScrollObserver: null,
    menuCache: new Map(),
    menuCacheOrder: [],
    addressPinMap: null,
    addressPinMarker: null,
    pendingLocation: null,
    addressPinPickerActive: false,
    trackingDestination: null,
    trackingAddressLine: "",
    trackingBounds: null,
    route: "home",
};

const $ = (sel) => document.querySelector(sel);

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSearch(text) {
    return String(text).trim().toLowerCase();
}

function highlightText(text, query) {
    const safe = escapeHtml(text);
    if (!query) return safe;
    const re = new RegExp(`(${escapeRegex(query)})`, "gi");
    return safe.replace(re, '<mark class="search-hit">$1</mark>');
}

function formatPrice(n) {
    return `NT$${n.toLocaleString()}`;
}

function showToast(msg, variant = "") {
    const toast = $("#toast");
    toast.textContent = msg;
    toast.classList.remove("success");
    if (variant) toast.classList.add(variant);
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show", variant), 2200);
}


function hashCode(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getAnchorLocation() {
    return (
        state.userLocation || {
            lat: CONFIG.defaultLat,
            lng: CONFIG.defaultLng,
        }
    );
}

function spreadRestaurantCoordinates(storeId, anchor) {
    const hash = hashCode(`ue-spread:${storeId}`);
    const angle = ((hash % 360) * Math.PI) / 180;
    const radiusKm = 0.35 + (hash % 15) * 0.07;
    const latRad = (anchor.lat * Math.PI) / 180;
    return {
        lat: anchor.lat + (radiusKm / 111) * Math.cos(angle),
        lng: anchor.lng + (radiusKm / (111 * Math.cos(latRad))) * Math.sin(angle),
    };
}

function resolveRestaurantLocation(restaurant, anchor = getAnchorLocation()) {
    const distKm = distanceKm(
        { lat: restaurant.lat, lng: restaurant.lng },
        anchor
    );
    if (distKm > 0.05) {
        return { lat: restaurant.lat, lng: restaurant.lng };
    }
    return spreadRestaurantCoordinates(restaurant.id || restaurant.name, anchor);
}

function decorateRestaurantLocations() {
    const anchor = getAnchorLocation();
    for (const restaurant of state.restaurants) {
        if (restaurant.coordsSource === "api") {
            restaurant.mapLat = restaurant.lat;
            restaurant.mapLng = restaurant.lng;
            continue;
        }
        const resolved = resolveRestaurantLocation(restaurant, anchor);
        restaurant.mapLat = resolved.lat;
        restaurant.mapLng = resolved.lng;
    }
    decorateDeliveryEstimates();
}

function estimateDeliveryMinutes(restaurant, userLocation = state.userLocation) {
    const loc = getRestaurantMapLocation(restaurant);
    const user = userLocation || getAnchorLocation();
    const distKm = distanceKm(user, loc);
    const idHash = hashCode(String(restaurant.id || restaurant.name));

    const prepMinutes = 10 + (idHash % 9);
    const travelMinutes = Math.max(3, Math.ceil(distKm / 0.32));
    const buffer = 2 + (idHash % 3);
    const eta = prepMinutes + travelMinutes + buffer;

    return Math.max(12, Math.min(60, eta));
}

function decorateDeliveryEstimates() {
    for (const restaurant of state.restaurants) {
        restaurant.deliveryMinutes = estimateDeliveryMinutes(restaurant);
    }
    updateHeaderDeliveryLabel();
    if (state.selectedRestaurant) {
        const updated = state.restaurants.find((r) => r.id === state.selectedRestaurant.id);
        if (updated) state.selectedRestaurant.deliveryMinutes = updated.deliveryMinutes;
    }
}

function updateHeaderDeliveryLabel() {
    const label = $("#deliveryTimeLabel");
    if (!label || !state.restaurants.length) return;
    const times = state.restaurants.map((r) => r.deliveryMinutes);
    const min = Math.min(...times);
    const max = Math.max(...times);
    label.textContent = min === max ? `${min} 分鐘` : `${min}–${max} 分鐘`;
}

function getRestaurantMapLocation(restaurant) {
    if (restaurant.coordsSource === "api") {
        return { lat: restaurant.lat, lng: restaurant.lng };
    }
    if (restaurant.mapLat != null && restaurant.mapLng != null) {
        return { lat: restaurant.mapLat, lng: restaurant.mapLng };
    }
    return resolveRestaurantLocation(restaurant);
}

function isLocalAssetPath(path) {
    return Boolean(path) && !String(path).startsWith("http");
}

function applyRestaurantImages(restaurant) {
    const cat = restaurant.category || "default";
    if (!restaurant.menu?.length) return restaurant;

    restaurant.menu = restaurant.menu.map((item, index) => {
        const itemId = item.id ?? index;
        const mappedImage = resolveDishImage(item.name, itemId, cat);
        const localImage =
            item.image && !item.image.startsWith("http") ? item.image : null;
        return {
            ...item,
            category: item.category || "精選",
            desc: item.desc || "人氣餐點",
            soldCount: item.soldCount ?? 100 + (hashCode(`${restaurant.id}-${itemId}`) % 500),
            image: localImage || mappedImage || item.image,
        };
    });

    if (!isLocalAssetPath(restaurant.coverImage)) {
        const heroItem = restaurant.menu.find((m) => isLocalAssetPath(m.image));
        restaurant.coverImage =
            heroItem?.image ||
            resolveDishImage(restaurant.name, 0, cat) ||
            restaurant.coverImage;
    }
    return restaurant;
}

async function loadSiteConfig() {
    try {
        const res = await fetch("data/config.json");
        if (!res.ok) return;
        const config = await res.json();
        CONFIG.defaultAddress = config.defaultAddress || CONFIG.defaultAddress;
        CONFIG.defaultLat = config.defaultLat ?? CONFIG.defaultLat;
        CONFIG.defaultLng = config.defaultLng ?? CONFIG.defaultLng;
        CONFIG.deliveryLabel = config.deliveryLabel || CONFIG.deliveryLabel;
        CONFIG.locationIqKey = config.locationIqKey || CONFIG.locationIqKey;
    } catch {
        /* keep defaults */
    }
}

function distanceKm(a, b) {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) *
            Math.cos((b.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const FEED_CATEGORY_RULES = [
    { label: "咖啡甜點", keywords: ["咖啡", "甜點", "蛋糕", "烘焙", "可頌", "星巴克", "路易莎"] },
    { label: "日式料理", keywords: ["寿司", "壽司", "拉麵", "日式", "丼", "居酒屋", "便當"] },
    { label: "韓式", keywords: ["韓式", "韓國", "炸雞", "部隊鍋", "泡菜"] },
    { label: "中式料理", keywords: ["中式", "滷味", "水餃", "麵店", "熱炒", "便當"] },
    { label: "西式快餐", keywords: ["漢堡", "披薩", "炸雞", "McDonald", "肯德基", "必勝客"] },
    { label: "健康輕食", keywords: ["Poke", "沙拉", "輕食", "健康", "優格"] },
    { label: "鍋物燒烤", keywords: ["火鍋", "燒肉", "燒烤", "鍋", "麻辣"] },
    { label: "飲料冰品", keywords: ["飲料", "茶", "手搖", "冰品", "珍珠奶茶"] },
];

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

Object.assign(App, {
    CONFIG,
    LOCATION_STORAGE_KEY,
    FEED_PAGE_SIZE,
    MENU_CACHE_MAX,
    VEHICLES,
    TIMELINE_STEPS,
    FEED_CATEGORY_RULES,
    state,
    $,
    escapeHtml,
    escapeRegex,
    normalizeSearch,
    highlightText,
    formatPrice,
    showToast,
    delay,
    hashCode,
    getAnchorLocation,
    spreadRestaurantCoordinates,
    resolveRestaurantLocation,
    decorateRestaurantLocations,
    estimateDeliveryMinutes,
    decorateDeliveryEstimates,
    updateHeaderDeliveryLabel,
    getRestaurantMapLocation,
    isLocalAssetPath,
    applyRestaurantImages,
    distanceKm,
    loadSiteConfig,
});
