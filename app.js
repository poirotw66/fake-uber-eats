const CONFIG = {
    nominatimUrl: "https://nominatim.openstreetmap.org",
    osrmUrl: "https://router.project-osrm.org/route/v1",
    driverNames: ["王建國", "李志明", "陳俊宇", "張雅婷", "林冠廷"],
    defaultAddress: "松仁路7-1號",
    defaultLat: 25.0382477,
    defaultLng: 121.5691055,
    deliveryLabel: "立刻",
};

const VEHICLES = [
    { id: "motorcycle", name: "機車", emoji: "🛵", tag: "沿街道", weird: false, movement: "road", profile: "driving", speed: 1.0 },
    { id: "car", name: "汽車", emoji: "🚗", tag: "沿街道", weird: false, movement: "road", profile: "driving", speed: 0.95 },
    { id: "bicycle", name: "腳踏車", emoji: "🚲", tag: "單車道", weird: false, movement: "road", profile: "cycling", speed: 0.75 },
    { id: "ebike", name: "電輔車", emoji: "⚡", tag: "單車道", weird: false, movement: "road", profile: "cycling", speed: 0.9 },
    { id: "walk", name: "步行", emoji: "🚶", tag: "人行道", weird: false, movement: "road", profile: "foot", speed: 0.45 },
    { id: "horse", name: "馬匹", emoji: "🐴", tag: "慢但穩", weird: false, movement: "road", profile: "foot", speed: 0.55 },
    { id: "rollerskates", name: "溜冰鞋", emoji: "🛼", tag: "搖擺前進", weird: false, movement: "wobble", profile: "foot", speed: 1.0 },
    { id: "helicopter", name: "直升機", emoji: "🚁", tag: "空中直飛", weird: true, movement: "fly", speed: 2.2 },
    { id: "drone", name: "空拍機", emoji: "📦", tag: "低空飛行", weird: true, movement: "fly", speed: 1.8 },
    { id: "ufo", name: "UFO", emoji: "🛸", tag: "神秘路線", weird: true, movement: "fly", speed: 2.8 },
    { id: "balloon", name: "熱氣球", emoji: "🎈", tag: "隨風飄移", weird: true, movement: "drift", speed: 0.55 },
    { id: "rocket", name: "火箭", emoji: "🚀", tag: "拋物線", weird: true, movement: "arc", speed: 3.5 },
    { id: "teleport", name: "瞬移", emoji: "✨", tag: "閃現跳躍", weird: true, movement: "teleport", profile: "driving", speed: 4.0 },
    { id: "tank", name: "坦克", emoji: "🛡️", tag: "壓馬路", weird: true, movement: "road", profile: "driving", speed: 0.3 },
    { id: "submarine", name: "潛水艇", emoji: "🫧", tag: "地底直穿", weird: true, movement: "underground", speed: 2.0 },
    { id: "pigeon", name: "信鴿", emoji: "🕊️", tag: "鳥類航線", weird: true, movement: "fly", speed: 1.6 },
];

const GENERIC_MENUS = {
    fast_food: [
        { name: "經典漢堡套餐", emoji: "🍔", price: 189, category: "套餐", desc: "漢堡 + 薯條 + 飲料", badge: "人氣" },
        { name: "炸雞桶餐", emoji: "🍗", price: 299, category: "套餐", desc: "6 塊炸雞 + 2 配菜" },
        { name: "雙層牛肉堡", emoji: "🍔", price: 129, category: "漢堡", desc: "雙層牛肉、起司、特製醬" },
        { name: "炸雞腿（2 塊）", emoji: "🍗", price: 149, category: "炸雞", desc: "外酥內嫩，現炸供應" },
        { name: "薯條（大）", emoji: "🍟", price: 65, category: "小食", desc: "金黃現炸薯條" },
        { name: "洋蔥圈", emoji: "🧅", price: 55, category: "小食", desc: "酥脆洋蔥圈" },
        { name: "可樂（中）", emoji: "🥤", price: 35, category: "飲料", desc: "冰涼氣泡飲" },
        { name: "巧克力聖代", emoji: "🍦", price: 45, category: "甜點", desc: "香草冰淇淋 + 巧克力醬" },
    ],
    cafe: [
        { name: "美式咖啡", emoji: "☕", price: 95, category: "咖啡", desc: "中焙熱美式", badge: "人氣" },
        { name: "拿鐵", emoji: "☕", price: 110, category: "咖啡", desc: "濃縮 + 蒸奶" },
        { name: "卡布奇諾", emoji: "☕", price: 115, category: "咖啡", desc: "濃縮、蒸奶、奶泡" },
        { name: "焦糖瑪奇朵", emoji: "☕", price: 135, category: "咖啡", desc: "香草糖漿、焦糖淋面" },
        { name: "冰搖檸檬茶", emoji: "🍋", price: 105, category: "茶飲", desc: "清爽檸檬茶" },
        { name: "抹茶那堤", emoji: "🍵", price: 140, category: "茶飲", desc: "宇治抹茶風味" },
        { name: "可頌", emoji: "🥐", price: 75, category: "烘焙", desc: "法式奶油可頌" },
        { name: "提拉米蘇", emoji: "🍰", price: 120, category: "甜點", desc: "經典義式甜點" },
    ],
    default: [
        { name: "招牌套餐", emoji: "🍱", price: 198, category: "套餐", desc: "主廚精選組合", badge: "人氣" },
        { name: "今日特餐", emoji: "🍲", price: 168, category: "主食", desc: "每日現做，限量供應" },
        { name: "季節限定", emoji: "✨", price: 228, category: "主食", desc: "本週限定菜色", badge: "新品" },
        { name: "主廚推薦湯品", emoji: "🍲", price: 88, category: "湯品", desc: "慢火熬煮，暖胃首選" },
        { name: "涼拌開胃菜", emoji: "🥗", price: 78, category: "小菜", desc: "清爽開胃" },
        { name: "白飯", emoji: "🍚", price: 25, category: "主食", desc: "台灣產米" },
        { name: "冰涼飲品", emoji: "🥤", price: 45, category: "飲料", desc: "季節水果調製" },
        { name: "飯後甜點", emoji: "🍮", price: 68, category: "甜點", desc: "每日更換口味" },
    ],
};

const TIMELINE_STEPS = [
    { key: "placed", text: "訂單已確認", sub: "店家已收到你的訂單" },
    { key: "preparing", text: "店家準備中", sub: "廚房正在料理你的餐點" },
    { key: "pickup", text: "外送員取餐中", sub: "外送員已抵達餐廳" },
    { key: "delivering", text: "外送中", sub: "餐點正在送往你的地址" },
    { key: "arrived", text: "已送達門口", sub: "請與外送員碰面取餐" },
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
};

const $ = (sel) => document.querySelector(sel);

function formatPrice(n) {
    return `NT$${n.toLocaleString()}`;
}

function showToast(msg) {
    const toast = $("#toast");
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
}

function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("screen-active"));
    $(id).classList.add("screen-active");
    const isTracking = id === "#screenTracking";
    document.body.classList.toggle("no-scroll", isTracking);
    document.body.classList.toggle("tracking-active", isTracking);
    $("#cartBar").classList.toggle("hidden", id !== "#screenRestaurant");

    if (isTracking) {
        setTimeout(() => {
            state.trackingMap?.invalidateSize();
        }, 200);
    } else {
        setTimeout(() => {
            state.map?.invalidateSize();
        }, 150);
    }
}

function getCartItems() {
    const menu = state.selectedRestaurant?.menu ?? [];
    return Object.entries(state.cart)
        .map(([id, qty]) => {
            const item = menu.find((m) => m.id === Number(id));
            return item ? { ...item, qty } : null;
        })
        .filter(Boolean);
}

function getFees() {
    const subtotal = getCartItems().reduce((s, i) => s + i.price * i.qty, 0);
    const delivery = subtotal > 0 ? 49 : 0;
    const service = subtotal > 0 ? Math.round(subtotal * 0.05) : 0;
    const tip = subtotal > 0 ? state.tip : 0;
    return { subtotal, delivery, service, tip, grand: subtotal + delivery + service + tip };
}

function clearCart() {
    state.cart = {};
    updateCartBar();
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
        const resolved = resolveRestaurantLocation(restaurant, anchor);
        restaurant.mapLat = resolved.lat;
        restaurant.mapLng = resolved.lng;
    }
}

function getRestaurantMapLocation(restaurant) {
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

function addToCart(id) {
    const prev = state.cart[id] || 0;
    setCartQty(id, prev + 1);
    if (state.cart[id] > prev) showToast("已加入購物車");
}

function setCartQty(id, qty) {
    if (!state.selectedRestaurant) return;
    if (qty <= 0) {
        delete state.cart[id];
    } else {
        state.cart[id] = qty;
    }
    refreshMenuQtyUi();
    updateCartBar();
}

function refreshMenuQtyUi() {
    document.querySelectorAll(".menu-card").forEach((card) => {
        const id = Number(card.dataset.id);
        const qty = state.cart[id] || 0;
        const footer = card.querySelector(".menu-card-actions");
        if (!footer) return;
        const item = state.selectedRestaurant?.menu.find((m) => m.id === id);
        if (!item) return;
        footer.innerHTML = renderQtyControl(item, qty);
        bindQtyControl(footer, id);
    });
}

function emojiForAmenity(tags) {
    if (tags.amenity === "cafe") return "☕";
    if (tags.amenity === "fast_food") return "🍔";
    const cuisine = tags.cuisine || "";
    if (cuisine.includes("pizza")) return "🍕";
    if (cuisine.includes("japanese") || cuisine.includes("sushi")) return "🍣";
    if (cuisine.includes("chinese")) return "🥟";
    return "🍽️";
}

function buildMenuFromTemplate(restaurantId, tags) {
    const key =
        tags.amenity === "fast_food" ? "fast_food" : tags.amenity === "cafe" ? "cafe" : "default";
    return GENERIC_MENUS[key].map((item, index) => ({
        id: restaurantId * 10 + index,
        soldCount: 120 + (restaurantId + index) * 13,
        ...item,
    }));
}

function renderThumb({ image, emoji, className }) {
    if (image) {
        return `<div class="${className} has-image"><img src="${image}" alt="" loading="lazy" onerror="this.onerror=null;this.closest('.has-image')?.classList.remove('has-image');this.remove();const fb=this.parentElement?.querySelector('.thumb-fallback');if(fb){fb.style.display='flex';}"><span class="thumb-fallback" aria-hidden="true">${emoji}</span></div>`;
    }
    return `<div class="${className}">${emoji}</div>`;
}

function firstLocalMenuImage(restaurant) {
    return restaurant.menu?.find((item) => isLocalAssetPath(item.image))?.image;
}

function setRestaurantHero(restaurant) {
    const hero = $("#restaurantHero");
    const menuFallback = firstLocalMenuImage(restaurant);
    const coverSrc = isLocalAssetPath(restaurant.coverImage)
        ? restaurant.coverImage
        : menuFallback;

    if (coverSrc) {
        hero.classList.add("has-cover");
        const img = document.createElement("img");
        img.className = "restaurant-banner-img";
        img.alt = "";
        img.decoding = "async";
        img.src = coverSrc;
        if (menuFallback && menuFallback !== coverSrc) {
            img.addEventListener(
                "error",
                () => {
                    img.src = menuFallback;
                },
                { once: true }
            );
        }
        hero.replaceChildren(img);
        return;
    }

    hero.classList.remove("has-cover");
    hero.innerHTML = `<div class="restaurant-hero-emoji">${restaurant.emoji}</div>`;
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
    } catch {
        /* keep defaults */
    }
}

async function loadSeedRestaurants() {
    const enrichedRes = await fetch("data/restaurants.enriched.json");
    if (!enrichedRes.ok) {
        throw new Error("restaurant data missing: data/restaurants.enriched.json");
    }
    const data = await enrichedRes.json();
    return data
        .filter((restaurant) => (restaurant.menu || []).length > 0)
        .map((r) => ({
            ...r,
            menu: (r.menu || []).map((m) => ({
                ...m,
                desc: m.desc || "人氣餐點",
                category: m.category || "精選",
            })),
            deliveryFee: r.deliveryFee ?? 49,
        }));
}

function groupMenuByCategory(menu) {
    const groups = new Map();
    for (const item of menu) {
        const key = item.category || "精選";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    }
    return groups;
}

function renderBadge(item) {
    if (!item.badge) return "";
    const cls =
        item.badge === "辣" ? " spicy" : item.badge === "新品" ? " new" : item.badge === "超值" ? " deal" : "";
    return `<span class="menu-badge${cls}">${item.badge}</span>`;
}

function renderQtyControl(item, qty) {
    if (qty > 0) {
        return `
            <div class="qty-stepper" data-id="${item.id}">
                <button type="button" class="qty-btn qty-minus" data-id="${item.id}" aria-label="減少">−</button>
                <span class="qty-value">${qty}</span>
                <button type="button" class="qty-btn qty-plus" data-id="${item.id}" aria-label="增加">+</button>
            </div>`;
    }
    return `<button type="button" class="menu-add-btn" data-id="${item.id}">加入</button>`;
}

function bindQtyControl(container, id) {
    container.querySelector(".menu-add-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        addToCart(id);
    });
    container.querySelector(".qty-minus")?.addEventListener("click", (e) => {
        e.stopPropagation();
        setCartQty(id, (state.cart[id] || 0) - 1);
    });
    container.querySelector(".qty-plus")?.addEventListener("click", (e) => {
        e.stopPropagation();
        setCartQty(id, (state.cart[id] || 0) + 1);
    });
}

function renderMenuCard(item) {
    const qty = state.cart[item.id] || 0;
    const sold = item.soldCount ? `<span class="menu-sold">${item.soldCount}+ 人點過</span>` : "";
    return `
        <article class="menu-card" data-id="${item.id}" id="menu-item-${item.id}">
            <div class="menu-card-media">
                ${renderThumb({ image: item.image, emoji: item.emoji, className: "menu-card-thumb" })}
            </div>
            <div class="menu-card-body">
                <div class="menu-card-top">
                    <h3 class="menu-card-name">${item.name} ${renderBadge(item)}</h3>
                    ${sold}
                </div>
                <p class="menu-card-desc">${item.desc || ""}</p>
                <div class="menu-card-footer">
                    <span class="menu-card-price">${formatPrice(item.price)}</span>
                    <div class="menu-card-actions">${renderQtyControl(item, qty)}</div>
                </div>
            </div>
        </article>`;
}

function renderFeaturedCard(item) {
    return `
        <article class="featured-card" data-id="${item.id}">
            <div class="featured-card-media">
                ${renderThumb({ image: item.image, emoji: item.emoji, className: "featured-thumb" })}
            </div>
            <div class="featured-card-body">
                <div class="featured-card-name">${item.name}</div>
                <div class="featured-card-price">${formatPrice(item.price)}</div>
                <button type="button" class="featured-add-btn" data-id="${item.id}">+ 加入</button>
            </div>
        </article>`;
}

async function fetchOsmRestaurants(lat, lng) {
    const query = `
        [out:json][timeout:20];
        (
          node["amenity"~"restaurant|fast_food|cafe|food_court"](around:${CONFIG.osmSearchRadiusM},${lat},${lng});
          way["amenity"~"restaurant|fast_food|cafe"](around:${CONFIG.osmSearchRadiusM},${lat},${lng});
        );
        out center 18;
    `;
    try {
        const res = await fetch(CONFIG.overpassUrl, { method: "POST", body: query });
        if (!res.ok) return [];
        const data = await res.json();
        return data.elements
            .map((el, index) => {
                const latVal = el.lat ?? el.center?.lat;
                const lngVal = el.lon ?? el.center?.lon;
                if (!latVal || !lngVal) return null;
                const tags = el.tags || {};
                const name = tags.name || tags["name:zh"] || tags.brand || "附近餐廳";
                const cuisine = tags.cuisine || "";
                let category = "中式";
                if (tags.amenity === "cafe") category = "咖啡";
                else if (tags.amenity === "fast_food") category = "炸物";
                else if (cuisine.includes("pizza")) category = "披薩";
                else if (cuisine.includes("japanese") || cuisine.includes("sushi")) category = "日式";
                return {
                    id: `osm-${el.id}-${index}`,
                    name,
                    emoji: emojiForAmenity(tags),
                    category,
                    tagline: cuisine ? `${cuisine} · 附近人氣餐廳` : "附近人氣餐廳",
                    address: tags["addr:full"] || tags["addr:street"] || "附近",
                    lat: latVal,
                    lng: lngVal,
                    rating: (4.0 + Math.random() * 0.8).toFixed(1),
                    deliveryMinutes: 18 + Math.floor(Math.random() * 15),
                    deliveryFee: 39 + Math.floor(Math.random() * 3) * 10,
                    source: "osm",
                    menu: buildMenuFromTemplate(el.id, tags),
                };
            })
            .filter(Boolean);
    } catch {
        return [];
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

function inferFeedCategory(restaurant) {
    const text = `${restaurant.name} ${restaurant.tagline || ""}`;
    for (const rule of FEED_CATEGORY_RULES) {
        if (rule.keywords.some((kw) => text.includes(kw))) return rule.label;
    }
    return restaurant.category || "其他";
}

function getFeedCategories() {
    const counts = new Map();
    for (const restaurant of state.restaurants) {
        const key = inferFeedCategory(restaurant);
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    const sorted = [...counts.entries()]
        .filter(([, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);
    return ["全部", ...sorted];
}

function applyCategoryFilter() {
    if (state.activeCategory === "全部") {
        state.filteredRestaurants = state.restaurants;
        return;
    }
    state.filteredRestaurants = state.restaurants.filter(
        (restaurant) => inferFeedCategory(restaurant) === state.activeCategory
    );
}

function renderFeedCategories() {
    const container = $("#feedCategories");
    if (!container) return;
    const categories = getFeedCategories();
    if (!categories.includes(state.activeCategory)) {
        state.activeCategory = "全部";
    }
    container.innerHTML = categories
        .map(
            (cat) =>
                `<button type="button" class="feed-category-btn${
                    cat === state.activeCategory ? " active" : ""
                }" data-category="${cat}">${cat}</button>`
        )
        .join("");
    container.querySelectorAll(".feed-category-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            state.activeCategory = btn.dataset.category;
            renderFeedCategories();
            applyCategoryFilter();
            renderRestaurantList();
        });
    });
}

async function refreshRestaurants() {
    const seed = await loadSeedRestaurants();
    state.restaurants = seed.map(applyRestaurantImages);
    decorateRestaurantLocations();
    applyCategoryFilter();
    renderFeedCategories();
    renderRestaurantList();
    updateMapMarkers();
    const subtitle = $("#feedSubtitle");
    if (subtitle) {
        subtitle.textContent = `${state.addressLine || CONFIG.defaultAddress} · ${state.restaurants.length} 家餐廳`;
    }
}

function initMap() {
    if (state.map) return;
    state.map = L.map("map", { zoomControl: false, attributionControl: false }).setView(
        [25.033, 121.565],
        14
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(
        state.map
    );
}

function updateMapMarkers() {
    if (!state.map) return;
    Object.values(state.markers).forEach((m) => state.map.removeLayer(m));
    state.markers = {};

    if (state.userLocation) {
        state.markers.home = L.circleMarker(
            [state.userLocation.lat, state.userLocation.lng],
            { radius: 8, color: "#06c167", fillColor: "#06c167", fillOpacity: 1, weight: 2 }
        ).addTo(state.map);
    }

    state.restaurants.slice(0, 12).forEach((r) => {
        const loc = getRestaurantMapLocation(r);
        const m = L.circleMarker([loc.lat, loc.lng], {
            radius: 5,
            color: "#000",
            fillColor: "#000",
            fillOpacity: 0.8,
            weight: 1,
        })
            .addTo(state.map)
            .bindPopup(r.name);
        m.on("click", () => openRestaurant(r.id));
        state.markers[r.id] = m;
    });

    if (state.userLocation) {
        state.map.setView([state.userLocation.lat, state.userLocation.lng], 15);
        setTimeout(() => state.map.invalidateSize(), 100);
    }
}

async function reverseGeocode(lat, lng) {
    try {
        const url = `${CONFIG.nominatimUrl}/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-TW`;
        const res = await fetch(url, { headers: { "Accept-Language": "zh-TW" } });
        if (!res.ok) return "";
        const data = await res.json();
        return data.display_name || "";
    } catch {
        return "";
    }
}

function updateAddressDisplay() {
    const text = state.addressLine || CONFIG.defaultAddress;
    $("#addressDisplay").textContent = text.length > 22 ? `${text.slice(0, 22)}…` : text;
    const label = $("#deliveryTimeLabel");
    if (label) label.textContent = CONFIG.deliveryLabel;
}

function openAddressSheet() {
    $("#overlay").classList.add("open");
    $("#addressSheet").classList.add("open");
    if (state.addressLine) $("#addressLine").value = state.addressLine;
}

function closeAddressSheet() {
    $("#overlay").classList.remove("open");
    $("#addressSheet").classList.remove("open");
}

function saveAddress() {
    state.addressLine = $("#addressLine").value.trim();
    if (!state.addressLine) {
        showToast("請輸入地址");
        return;
    }
    updateAddressDisplay();
    closeAddressSheet();
    showToast("地址已更新");
}

async function useGps() {
    if (!navigator.geolocation) {
        showToast("瀏覽器不支援定位");
        return;
    }
    showToast("定位中...");
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const addr = await reverseGeocode(state.userLocation.lat, state.userLocation.lng);
            state.addressLine = addr || `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
            $("#addressLine").value = state.addressLine;
            updateAddressDisplay();
            await refreshRestaurants();
            closeAddressSheet();
            showToast("已使用目前位置");
        },
        () => showToast("定位失敗，請手動輸入"),
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function renderRestaurantList() {
    const container = $("#restaurantList");
    const list = state.filteredRestaurants.length ? state.filteredRestaurants : state.restaurants;
    if (!list.length) {
        container.innerHTML =
            '<p class="feed-empty">尚無餐廳資料。請執行 <code>./scripts/run_scrape.sh</code> 從 Uber Eats 匯入。</p>';
        return;
    }

    container.innerHTML = list
        .map((r) => {
            const loc = getRestaurantMapLocation(r);
            const dist = state.userLocation
                ? `${(distanceKm(state.userLocation, loc) * 1000).toFixed(0)} 公尺`
                : "";
            const fee = r.deliveryFee ?? 49;
            const previews = (r.menu || [])
                .filter((m) => m.image)
                .slice(0, 3)
                .map(
                    (m) =>
                        `<span class="store-preview">${renderThumb({ image: m.image, emoji: m.emoji, className: "store-preview-thumb" })}</span>`
                )
                .join("");
            return `
            <article class="store-card" data-id="${r.id}">
                <div class="store-card-cover">
                    ${renderThumb({ image: r.coverImage, emoji: r.emoji, className: "store-cover-thumb" })}
                    <span class="store-card-time">${r.deliveryMinutes} 分鐘</span>
                </div>
                <div class="store-card-body">
                    <div class="store-card-name">${r.name}</div>
                    <div class="store-card-meta">⭐ ${r.rating} · ${dist} · 外送 ${formatPrice(fee)}</div>
                    <div class="store-card-tagline">${r.tagline || r.category}</div>
                    <div class="store-card-count">${r.menu?.length ?? 0} 品項可點</div>
                    ${previews ? `<div class="store-card-previews">${previews}</div>` : ""}
                </div>
            </article>`;
        })
        .join("");

    container.querySelectorAll(".store-card").forEach((el) => {
        el.addEventListener("click", () => openRestaurant(el.dataset.id));
    });
}

function openRestaurant(id) {
    if (!state.addressLine) {
        showToast("請先設定外送地址");
        openAddressSheet();
        return;
    }
    state.selectedRestaurant = state.restaurants.find((r) => r.id === id) ?? null;
    if (!state.selectedRestaurant) return;
    clearCart();

    const r = applyRestaurantImages(state.selectedRestaurant);
    state.selectedRestaurant = r;
    setRestaurantHero(r);
    $("#restaurantName").textContent = r.name;
    $("#restaurantStats").textContent = `⭐ ${r.rating} · ${r.deliveryMinutes} 分鐘 · 外送費 ${formatPrice(r.deliveryFee ?? 49)} · ${r.menu.length} 品項`;
    $("#restaurantAddress").textContent = r.address;

    $("#restaurantPromos").innerHTML = `
        <span class="promo-pill">滿 $400 免外送費</span>
        <span class="promo-pill accent">預計 ${r.deliveryMinutes} 分鐘送達</span>
        <span class="promo-pill muted">Uber One 會員 95 折</span>`;

    const grouped = groupMenuByCategory(r.menu);
    const categories = [...grouped.keys()];

    $("#menuNav").innerHTML = categories
        .map(
            (cat, i) =>
                `<button type="button" class="menu-nav-btn${i === 0 ? " active" : ""}" data-category="${cat}">${cat}</button>`
        )
        .join("");

    const featured = r.menu
        .filter((m) => m.badge === "人氣" || (m.soldCount ?? 0) > 300)
        .slice(0, 6);
    $("#featuredBlock").style.display = featured.length ? "" : "none";
    $("#featuredItems").innerHTML = featured.map(renderFeaturedCard).join("");

    $("#menuList").innerHTML = [...grouped.entries()]
        .map(
            ([category, items]) => `
        <section class="menu-section" id="cat-${category.replace(/\s/g, "-")}">
            <h3 class="menu-section-title">${category}</h3>
            <div class="menu-card-grid">${items.map(renderMenuCard).join("")}</div>
        </section>`
        )
        .join("");

    $("#menuNav").querySelectorAll(".menu-nav-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            $("#menuNav").querySelectorAll(".menu-nav-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            const target = document.getElementById(`cat-${btn.dataset.category.replace(/\s/g, "-")}`);
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    document.querySelectorAll(".menu-card-actions").forEach((el) => {
        bindQtyControl(el, Number(el.closest(".menu-card")?.dataset.id));
    });
    $("#featuredItems").querySelectorAll(".featured-add-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            addToCart(Number(btn.dataset.id));
        });
    });

    showScreen("#screenRestaurant");
    updateCartBar();
}

function updateCartBar() {
    const fees = getFees();
    const items = getCartItems();
    const count = items.reduce((s, i) => s + i.qty, 0);
    $("#cartBar").classList.toggle("visible", count > 0);
    $("#cartBarText").textContent = `查看購物車 · ${count} 項`;
    $("#cartBarTotal").textContent = formatPrice(fees.grand);
    $("#cartBarPreviews").innerHTML = items
        .slice(0, 4)
        .map(
            (i) =>
                `<span class="cart-preview" title="${i.name}">${renderThumb({ image: i.image, emoji: i.emoji, className: "cart-preview-thumb" })}<span class="cart-preview-qty">${i.qty}</span></span>`
        )
        .join("");
}

function openCheckout() {
    if (!getCartItems().length) return;
    const fees = getFees();
    $("#checkoutAddress").textContent = state.addressLine + (state.addressDetail ? ` · ${state.addressDetail}` : "");
    $("#addressDetail").value = state.addressDetail;

    $("#checkoutItems").innerHTML = `
        <h3>訂單內容 · ${state.selectedRestaurant?.name ?? ""}</h3>
        ${getCartItems()
            .map(
                (i) =>
                    `<div class="checkout-item">
                        ${renderThumb({ image: i.image, emoji: i.emoji, className: "checkout-item-thumb" })}
                        <span class="checkout-item-name"><span class="checkout-item-qty">${i.qty}×</span>${i.name}</span>
                        <span class="checkout-item-price">${formatPrice(i.price * i.qty)}</span>
                    </div>`
            )
            .join("")}`;

    $("#feeBreakdown").innerHTML = `
        <div class="fee-line"><span>小計</span><span>${formatPrice(fees.subtotal)}</span></div>
        <div class="fee-line"><span>外送費</span><span>${formatPrice(fees.delivery)}</span></div>
        <div class="fee-line"><span>服務費</span><span>${formatPrice(fees.service)}</span></div>
        <div class="fee-line"><span>小費</span><span>${formatPrice(fees.tip)}</span></div>
        <div class="fee-line total"><span>總計</span><span>${formatPrice(fees.grand)}</span></div>`;

    $("#checkoutTotal").textContent = formatPrice(fees.grand);
    renderVehiclePicker();
    showScreen("#screenCheckout");
    $("#cartBar").classList.remove("visible");
}

function getVehicle() {
    return VEHICLES.find((v) => v.id === state.selectedVehicleId) ?? VEHICLES[0];
}

function renderVehiclePicker() {
    const grid = $("#vehicleGrid");
    grid.innerHTML = VEHICLES.map(
        (v) => `
        <button type="button" class="vehicle-card${v.weird ? " weird" : ""}${v.id === state.selectedVehicleId ? " selected" : ""}" data-vehicle="${v.id}">
            <div class="vehicle-emoji">${v.emoji}</div>
            <div class="vehicle-name">${v.name}</div>
            <div class="vehicle-tag">${v.tag}</div>
        </button>`
    ).join("");

    grid.querySelectorAll(".vehicle-card").forEach((card) => {
        card.addEventListener("click", () => {
            state.selectedVehicleId = card.dataset.vehicle;
            renderVehiclePicker();
        });
    });
}

function setTimelineStep(index) {
    document.querySelectorAll(".timeline-item").forEach((el, i) => {
        el.classList.toggle("done", i < index);
        el.classList.toggle("active", i === index);
    });
}

function renderTimeline() {
    $("#timeline").innerHTML = TIMELINE_STEPS.map(
        (step, i) => `
        <div class="timeline-item" data-step="${i}">
            <div class="timeline-dot"></div>
            <div>
                <div class="timeline-text">${step.text}</div>
                <div class="timeline-sub" id="timelineSub${i}">${step.sub}</div>
            </div>
        </div>`
    ).join("");
}

async function processPayment() {
    const fees = getFees();
    state.orderTotal = fees.grand;
    state.addressDetail = $("#addressDetail").value.trim();

    const overlay = $("#paymentOverlay");
    const status = $("#paymentStatus");
    overlay.classList.add("open");

    const method = state.paymentMethod === "apple" ? "Apple Pay" : "Visa ···· 4242";
    status.textContent = "正在處理付款...";

    await delay(1800);

    if (state.paymentMethod === "apple") {
        status.textContent = "請使用 Touch ID 確認...";
        await delay(1200);
    }

    status.textContent = `付款成功 · ${formatPrice(fees.grand)}`;
    await delay(1000);

    overlay.classList.remove("open");
    startTracking();
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function startTracking() {
    const restaurant = state.selectedRestaurant;
    const destination = state.userLocation || {
        lat: CONFIG.defaultLat,
        lng: CONFIG.defaultLng,
    };
    const restaurantLoc = getRestaurantMapLocation(restaurant);
    const restaurantForMap = { ...restaurant, lat: restaurantLoc.lat, lng: restaurantLoc.lng };
    const vehicle = getVehicle();

    state.driverName = CONFIG.driverNames[Math.floor(Math.random() * CONFIG.driverNames.length)];

    $("#driverName").textContent = state.driverName;
    $("#driverMeta").textContent = `${vehicle.emoji} ${vehicle.name} · ${vehicle.tag}`;
    $("#driverAvatar").textContent = vehicle.emoji;
    $("#orderPaidBanner").textContent = `已使用 ${state.paymentMethod === "apple" ? "Apple Pay" : "Visa ···· 4242"} 付款 ${formatPrice(state.orderTotal)}`;
    $("#meetDriverBtn").disabled = true;

    const etaBase = restaurant.deliveryMinutes / vehicle.speed;
    $("#etaTime").textContent = `${Math.max(3, Math.round(etaBase - 3))}–${Math.round(etaBase + 3)}`;

    renderTimeline();
    setTimelineStep(0);
    showScreen("#screenTracking");

    setTimeout(() => initTrackingMap(restaurantForMap, destination, vehicle), 400);
}

function createDriverMarker(vehicle, lat, lng) {
    const flying = ["fly", "drift", "arc"].includes(vehicle.movement);
    return L.marker([lat, lng], {
        icon: L.divIcon({
            className: "driver-marker",
            html: `<div class="driver-marker-inner${flying ? " flying" : ""}" id="driverMarkerInner">${vehicle.emoji}</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
        }),
    });
}

function clearRouteLayer() {
    if (state.routeLayer && state.trackingMap) {
        state.trackingMap.removeLayer(state.routeLayer);
        state.routeLayer = null;
    }
}

function drawRouteLine(points, vehicle) {
    clearRouteLayer();
    if (!state.trackingMap || points.length < 2) return;

    const latlngs = points.map((p) => [p.lat, p.lng]);
    const isAerial = ["fly", "drift", "arc"].includes(vehicle.movement);
    const isUnder = vehicle.movement === "underground";

    state.routeLayer = L.polyline(latlngs, {
        color: isUnder ? "#2563eb" : isAerial ? "#9333ea" : "#06c167",
        weight: isUnder ? 3 : 4,
        opacity: isUnder ? 0.55 : 0.85,
        dashArray: isUnder ? "4 10" : isAerial ? "10 8" : null,
    }).addTo(state.trackingMap);
}

async function initTrackingMap(restaurant, destination, vehicle) {
    if (state.trackingMap) {
        state.trackingMap.remove();
        state.trackingMap = null;
    }

    state.trackingMap = L.map("trackingMap", { zoomControl: false, attributionControl: false }).setView(
        [restaurant.lat, restaurant.lng],
        14
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(state.trackingMap);

    L.marker([restaurant.lat, restaurant.lng]).addTo(state.trackingMap).bindPopup(restaurant.name);

    L.marker([destination.lat, destination.lng], {
        icon: L.divIcon({
            className: "home-marker",
            html: "🏠",
            iconSize: [32, 32],
            iconAnchor: [16, 28],
        }),
    })
        .addTo(state.trackingMap)
        .bindPopup("你的地址");

    const driverMarker = createDriverMarker(vehicle, restaurant.lat, restaurant.lng);
    driverMarker.addTo(state.trackingMap);

    const start = { lat: restaurant.lat, lng: restaurant.lng };
    const end = { lat: destination.lat, lng: destination.lng };
    const path = await buildDeliveryPath(start, end, vehicle);
    drawRouteLine(path, vehicle);

    state.trackingMap.fitBounds(
        L.latLngBounds(path.map((p) => [p.lat, p.lng])).pad(0.12)
    );

    setTimeout(() => state.trackingMap?.invalidateSize(), 250);
    runTrackingStages(driverMarker, path, vehicle);
}

function runTrackingStages(driverMarker, path, vehicle) {
    const stages = [
        { step: 1, delay: 3000 },
        { step: 2, delay: 3500, sub: `${state.driverName} 已抵達餐廳 · ${vehicle.emoji}` },
        { step: 3, delay: 3000, sub: `搭乘${vehicle.name}前往你的地址` },
        { step: 4, delay: 0, animate: true },
    ];

    let i = 0;

    function next() {
        if (i >= stages.length) return;
        const stage = stages[i];
        setTimelineStep(stage.step);
        if (stage.sub) {
            const subEl = $(`#timelineSub${stage.step}`);
            if (subEl) subEl.textContent = stage.sub;
        }
        i += 1;

        if (stage.animate) {
            animateAlongPath(driverMarker, path, vehicle);
        } else if (stage.delay > 0) {
            setTimeout(next, stage.delay);
        } else {
            next();
        }
    }

    setTimeout(next, 2000);
}

function interpolate(a, b, t) {
    return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function quadraticBezier(a, control, b, t) {
    const u = 1 - t;
    return {
        lat: u * u * a.lat + 2 * u * t * control.lat + t * t * b.lat,
        lng: u * u * a.lng + 2 * u * t * control.lng + t * t * b.lng,
    };
}

function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function pathLength(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += distanceKm(points[i - 1], points[i]);
    }
    return total;
}

function pointAtDistance(points, targetKm) {
    let walked = 0;
    for (let i = 1; i < points.length; i++) {
        const seg = distanceKm(points[i - 1], points[i]);
        if (walked + seg >= targetKm) {
            const t = (targetKm - walked) / seg;
            return interpolate(points[i - 1], points[i], t);
        }
        walked += seg;
    }
    return points[points.length - 1];
}

function bearingBetween(a, b) {
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

async function fetchOsrmRoute(start, end, profile) {
    const url = `${CONFIG.osrmUrl}/${profile}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const coords = data.routes?.[0]?.geometry?.coordinates;
        if (!coords?.length) return null;
        return coords.map(([lng, lat]) => ({ lat, lng }));
    } catch {
        return null;
    }
}

function fallbackRoadPath(start, end, segments = 14) {
    const points = [{ ...start }];
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpLat = (-dx / len) * 0.00035;
    const perpLng = (dy / len) * 0.00035;

    for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const base = interpolate(start, end, t);
        const sign = i % 2 === 0 ? 1 : -1;
        points.push({
            lat: base.lat + perpLat * sign,
            lng: base.lng + perpLng * sign,
        });
    }
    points.push({ ...end });
    return points;
}

function buildArcPath(start, end, heightFactor = 0.35) {
    const mid = interpolate(start, end, 0.5);
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const control = {
        lat: mid.lat + (-dx / len) * len * heightFactor,
        lng: mid.lng + (dy / len) * len * heightFactor,
    };
    const points = [];
    for (let i = 0; i <= 80; i++) {
        points.push(quadraticBezier(start, control, end, i / 80));
    }
    return points;
}

function buildDriftPath(start, end) {
    const points = [];
    const steps = 70;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const base = interpolate(start, end, t);
        const wave = Math.sin(t * Math.PI * 4) * 0.0004;
        const dx = end.lng - start.lng;
        const dy = end.lat - start.lat;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        points.push({
            lat: base.lat + (-dx / len) * wave,
            lng: base.lng + (dy / len) * wave,
        });
    }
    return points;
}

function applyWobble(points, amplitude = 0.00012) {
    return points.map((p, i) => {
        if (i === 0 || i === points.length - 1) return p;
        const wave = Math.sin(i * 0.8) * amplitude;
        return { lat: p.lat + wave, lng: p.lng + wave * 0.6 };
    });
}

async function buildDeliveryPath(start, end, vehicle) {
    const roadPath = await fetchOsrmRoute(start, end, vehicle.profile || "driving");

    switch (vehicle.movement) {
        case "road":
            return roadPath ?? fallbackRoadPath(start, end);
        case "wobble": {
            const base = roadPath ?? fallbackRoadPath(start, end);
            return applyWobble(base);
        }
        case "fly":
            return buildArcPath(start, end, 0.28);
        case "drift":
            return buildDriftPath(start, end);
        case "arc":
            return buildArcPath(start, end, 0.55);
        case "underground":
            return [start, end];
        case "teleport": {
            const base = roadPath ?? fallbackRoadPath(start, end);
            const jumps = 6;
            const telePoints = [];
            for (let i = 0; i <= jumps; i++) {
                telePoints.push(pointAtDistance(base, (pathLength(base) * i) / jumps));
            }
            return telePoints;
        }
        default:
            return roadPath ?? fallbackRoadPath(start, end);
    }
}

function animateAlongPath(marker, path, vehicle) {
    if (state.driverAnimationId) cancelAnimationFrame(state.driverAnimationId);

    const baseDuration = 22000;
    const duration = baseDuration / vehicle.speed;
    const totalKm = Math.max(pathLength(path), 0.001);
    const t0 = performance.now();
    setTimelineStep(3);

    const inner = () => document.getElementById("driverMarkerInner");
    const isTeleport = vehicle.movement === "teleport";
    let lastSegment = -1;
    let lastPanAt = 0;

    function frame(now) {
        const progress = Math.min((now - t0) / duration, 1);
        const eased = isTeleport ? progress : easeInOut(progress);
        const pos = pointAtDistance(path, totalKm * eased);
        marker.setLatLng([pos.lat, pos.lng]);

        if (state.trackingMap && now - lastPanAt > 800) {
            state.trackingMap.panTo([pos.lat, pos.lng], { animate: true, duration: 0.6 });
            lastPanAt = now;
        }

        const segIdx = Math.floor(eased * (path.length - 1));
        if (segIdx !== lastSegment && segIdx < path.length - 1) {
            const angle = bearingBetween(path[segIdx], path[segIdx + 1]);
            const el = inner();
            if (el && !["fly", "drift", "arc", "underground"].includes(vehicle.movement)) {
                el.style.transform = `rotate(${angle - 90}deg)`;
            }
            if (el && isTeleport) {
                el.classList.remove("teleporting");
                void el.offsetWidth;
                el.classList.add("teleporting");
            }
            lastSegment = segIdx;
        }

        const remain = Math.max(0, Math.ceil((1 - progress) * 8 / vehicle.speed));
        $("#etaTime").textContent = remain > 0 ? String(remain) : "0";
        $("#timelineSub3").textContent =
            vehicle.movement === "underground"
                ? `地底全速前進中…還有 ${remain} 分鐘`
                : `預計 ${remain} 分鐘後抵達 · ${vehicle.emoji} ${vehicle.name}`;

        if (progress < 1) {
            state.driverAnimationId = requestAnimationFrame(frame);
        } else {
            arriveAtDoor(vehicle);
        }
    }

    state.driverAnimationId = requestAnimationFrame(frame);
}

function arriveAtDoor(vehicle) {
    const v = vehicle ?? getVehicle();
    setTimelineStep(4);
    $("#timelineSub4").textContent = `${state.driverName} 駕駛${v.emoji}${v.name}在門口等你`;
    $("#etaTime").textContent = "0";
    $("#meetDriverBtn").disabled = false;
    showToast("外送員已抵達");
}

function showReveal() {
    $("#revealOrderAmount").textContent = formatPrice(state.orderTotal);
    $("#revealOverlay").classList.add("open");
}

function resetApp() {
    if (state.driverAnimationId) cancelAnimationFrame(state.driverAnimationId);
    clearRouteLayer();
    if (state.trackingMap) {
        state.trackingMap.remove();
        state.trackingMap = null;
    }
    $("#revealOverlay").classList.remove("open");
    clearCart();
    state.selectedRestaurant = null;
    showScreen("#screenHome");
    updateCartBar();
}

function bindEvents() {
    $("#addressChip").addEventListener("click", openAddressSheet);
    $("#overlay").addEventListener("click", closeAddressSheet);
    $("#saveAddress").addEventListener("click", saveAddress);
    $("#useGps").addEventListener("click", useGps);

    $("#backHome").addEventListener("click", () => {
        state.selectedRestaurant = null;
        clearCart();
        showScreen("#screenHome");
        updateCartBar();
    });

    $("#cartBar").addEventListener("click", openCheckout);
    $("#backFromCheckout").addEventListener("click", () => showScreen("#screenRestaurant"));
    $("#placeOrderBtn").addEventListener("click", () => {
        if (!state.addressLine) {
            showToast("請設定外送地址");
            return;
        }
        if (!state.userLocation) {
            showToast("請使用 GPS 定位以啟用配送追蹤");
            openAddressSheet();
            return;
        }
        processPayment();
    });

    document.querySelectorAll(".payment-card").forEach((card) => {
        card.addEventListener("click", () => {
            document.querySelectorAll(".payment-card").forEach((c) => c.classList.remove("selected"));
            card.classList.add("selected");
            state.paymentMethod = card.dataset.method;
        });
    });

    $("#tipRow").querySelectorAll(".tip-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            $("#tipRow").querySelectorAll(".tip-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            state.tip = Number(btn.dataset.tip);
            openCheckout();
        });
    });

    $("#meetDriverBtn").addEventListener("click", showReveal);
    $("#orderAgain").addEventListener("click", resetApp);
}

function onViewportResize() {
    state.map?.invalidateSize();
    state.trackingMap?.invalidateSize();
}

async function init() {
    await loadSiteConfig();
    await loadDishImageRules();
    state.addressLine = CONFIG.defaultAddress;
    state.userLocation = { lat: CONFIG.defaultLat, lng: CONFIG.defaultLng };
    bindEvents();
    initMap();
    await refreshRestaurants();
    updateAddressDisplay();
    window.addEventListener("resize", onViewportResize);
}

document.addEventListener("DOMContentLoaded", init);
