/* js/feed.js */
window.App = window.App || {};
(function (App) {
"use strict";

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
    return App.GENERIC_MENUS[key].map((item, index) => ({
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
    return restaurant.menu?.find((item) => App.isLocalAssetPath(item.image))?.image;
}

function setRestaurantHero(restaurant) {
    const hero = App.$("#restaurantHero");
    const menuFallback = firstLocalMenuImage(restaurant);
    const coverSrc = App.isLocalAssetPath(restaurant.coverImage)
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


async function loadRestaurantFeed() {
    try {
        const res = await fetch("data/restaurants.feed.json");
        if (res.ok) {
            const data = await res.json();
            return data
                .filter((restaurant) => (restaurant.menuCount || 0) > 0)
                .map((r) => ({
                    ...r,
                    menu: null,
                    deliveryFee: r.deliveryFee ?? 49,
                }));
        }
    } catch {
        /* fallback to legacy bundle */
    }
    return loadSeedRestaurantsLegacy();
}

async function loadSeedRestaurantsLegacy() {
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
            menuCount: (r.menu || []).length,
            deliveryFee: r.deliveryFee ?? 49,
        }));
}

async function ensureRestaurantMenu(restaurant) {
    if (restaurant.menu?.length) return restaurant.menu;

    const cached = App.state.menuCache.get(restaurant.id);
    if (cached) {
        restaurant.menu = cached;
        setMenuCache(restaurant.id, cached);
        return cached;
    }

    const res = await fetch(`data/menus/${encodeURIComponent(restaurant.id)}.json`);
    if (!res.ok) {
        throw new Error(`menu missing for ${restaurant.id}`);
    }
    restaurant.menu = await res.json();
    App.applyRestaurantImages(restaurant);
    setMenuCache(restaurant.id, restaurant.menu);
    return restaurant.menu;
}

function setMenuCache(id, menu) {
    if (App.state.menuCache.has(id)) {
        const idx = App.state.menuCacheOrder.indexOf(id);
        if (idx >= 0) App.state.menuCacheOrder.splice(idx, 1);
    }
    App.state.menuCache.set(id, menu);
    App.state.menuCacheOrder.push(id);
    while (App.state.menuCacheOrder.length > App.MENU_CACHE_MAX) {
        const evictId = App.state.menuCacheOrder.shift();
        App.state.menuCache.delete(evictId);
        const evicted = App.state.restaurants.find((r) => r.id === evictId);
        if (evicted && evicted.id !== App.state.selectedRestaurant?.id) {
            evicted.menu = null;
        }
    }
}

function prefetchRestaurantMenu(restaurant) {
    if (!restaurant?.id || restaurant.menu?.length || App.state.menuCache.has(restaurant.id)) return;
    fetch(`data/menus/${encodeURIComponent(restaurant.id)}.json`)
        .then((res) => (res.ok ? res.json() : null))
        .then((menu) => {
            if (!menu) return;
            setMenuCache(restaurant.id, menu);
        })
        .catch(() => {});
}

async function loadSeedRestaurants() {
    return loadRestaurantFeed();
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
        App.addToCart(id);
    });
    container.querySelector(".qty-minus")?.addEventListener("click", (e) => {
        e.stopPropagation();
        App.setCartQty(id, (App.state.cart[id] || 0) - 1);
    });
    container.querySelector(".qty-plus")?.addEventListener("click", (e) => {
        e.stopPropagation();
        App.setCartQty(id, (App.state.cart[id] || 0) + 1);
    });
}

function renderMenuCard(item) {
    const qty = App.state.cart[item.id] || 0;
    const sold = item.soldCount ? `<span class="menu-sold">${item.soldCount}+ 人點過</span>` : "";
    return `
        <article class="menu-card" data-id="${item.id}" data-item-name="${encodeURIComponent(item.name)}" id="menu-item-${item.id}">
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
                    <span class="menu-card-price">${App.formatPrice(item.price)}</span>
                    <div class="menu-card-actions">${renderQtyControl(item, qty)}</div>
                </div>
            </div>
        </article>`;
}

function renderFeaturedCard(item) {
    return `
        <article class="featured-card" data-id="${item.id}" data-item-name="${encodeURIComponent(item.name)}">
            <div class="featured-card-media">
                ${renderThumb({ image: item.image, emoji: item.emoji, className: "featured-thumb" })}
            </div>
            <div class="featured-card-body">
                <div class="featured-card-name">${item.name}</div>
                <div class="featured-card-price">${App.formatPrice(item.price)}</div>
                <button type="button" class="featured-add-btn" data-id="${item.id}">+ 加入</button>
            </div>
        </article>`;
}

async function fetchOsmRestaurants(lat, lng) {
    const query = `
        [out:json][timeout:20];
        (
          node["amenity"~"restaurant|fast_food|cafe|food_court"](around:${App.CONFIG.osmSearchRadiusM},${lat},${lng});
          way["amenity"~"restaurant|fast_food|cafe"](around:${App.CONFIG.osmSearchRadiusM},${lat},${lng});
        );
        out center 18;
    `;
    try {
        const res = await fetch(App.CONFIG.overpassUrl, { method: "POST", body: query });
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

function inferFeedCategory(restaurant) {
    const text = `${restaurant.name} ${restaurant.tagline || ""}`;
    for (const rule of App.FEED_CATEGORY_RULES) {
        if (rule.keywords.some((kw) => text.includes(kw))) return rule.label;
    }
    return restaurant.category || "其他";
}

function getFeedCategories() {
    const counts = new Map();
    for (const restaurant of App.state.restaurants) {
        const key = inferFeedCategory(restaurant);
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    const sorted = [...counts.entries()]
        .filter(([, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);
    return ["全部", ...sorted];
}

function getRestaurantDistanceKm(restaurant) {
    const loc = App.getRestaurantMapLocation(restaurant);
    return App.distanceKm(App.state.userLocation || App.getAnchorLocation(), loc);
}

function sortRestaurantList(list) {
    const sorted = [...list];
    switch (App.state.feedSort) {
        case "rating":
            sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            break;
        case "delivery":
            sorted.sort((a, b) => (a.deliveryMinutes || 99) - (b.deliveryMinutes || 99));
            break;
        case "fee":
            sorted.sort((a, b) => (a.deliveryFee ?? 49) - (b.deliveryFee ?? 49));
            break;
        default:
            sorted.sort((a, b) => getRestaurantDistanceKm(a) - getRestaurantDistanceKm(b));
    }
    return sorted;
}

function applyFeedFilters() {
    let list = [...App.state.restaurants];
    if (App.state.activeCategory !== "全部") {
        list = list.filter((restaurant) => inferFeedCategory(restaurant) === App.state.activeCategory);
    }
    const query = App.normalizeSearch(App.state.searchQuery);
    if (query) {
        list = list.filter((restaurant) => restaurantMatchesSearch(restaurant, query));
    }
    if (App.state.minRating > 0) {
        list = list.filter((restaurant) => (restaurant.rating || 0) >= App.state.minRating);
    }
    App.state.filteredRestaurants = sortRestaurantList(list);
    App.state.feedRenderedCount = App.FEED_PAGE_SIZE;
    disconnectFeedObserver();
}

function restaurantMatchesSearch(restaurant, query) {
    if ((restaurant.searchText || "").includes(query)) return true;
    if (inferFeedCategory(restaurant).toLowerCase().includes(query)) return true;
    if ((restaurant.name || "").toLowerCase().includes(query)) return true;
    if ((restaurant.category || "").toLowerCase().includes(query)) return true;
    return false;
}

function findSearchMenuMatch(restaurant, query) {
    const names = restaurant.menuNames || (restaurant.previewItems || []).map((item) => item.name);
    return names.find((name) => (name || "").toLowerCase().includes(query)) || "";
}

function getSearchMenuHint(restaurant, query) {
    if (!query) return "";
    if ((restaurant.name || "").toLowerCase().includes(query)) return "";
    if (inferFeedCategory(restaurant).toLowerCase().includes(query)) return "";
    const hit = findSearchMenuMatch(restaurant, query);
    if (hit) return `符合餐點：${hit}`;
    if ((restaurant.searchText || "").includes(query)) {
        const names = restaurant.menuNames || [];
        const loose = names.find((name) => (name || "").toLowerCase().includes(query.slice(0, 2)));
        return loose ? `符合餐點：${loose}` : "符合菜單內容";
    }
    return "";
}

function applyCategoryFilter() {
    applyFeedFilters();
}

function renderFeedCategories() {
    const container = App.$("#feedCategories");
    if (!container) return;
    const categories = getFeedCategories();
    if (!categories.includes(App.state.activeCategory)) {
        App.state.activeCategory = "全部";
    }
    container.innerHTML = categories
        .map(
            (cat) =>
                `<button type="button" class="feed-category-btn${
                    cat === App.state.activeCategory ? " active" : ""
                }" data-category="${cat}">${cat}</button>`
        )
        .join("");
    container.querySelectorAll(".feed-category-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            App.state.activeCategory = btn.dataset.category;
            renderFeedCategories();
            applyCategoryFilter();
            renderRestaurantList();
        });
    });
}

async function refreshRestaurants() {
    showFeedSkeleton();
    const seed = await loadRestaurantFeed();
    App.state.restaurants = seed.map(App.applyRestaurantImages);
    refreshLocationDependentUi();
    renderFeedCategories();
}

function refreshLocationDependentUi() {
    App.decorateRestaurantLocations();
    applyCategoryFilter();
    renderRestaurantList();
    updateMapMarkers();
    updateHomeMapAddress();
    const subtitle = App.$("#feedSubtitle");
    if (subtitle) {
        const shown = Math.min(App.state.feedRenderedCount, App.state.filteredRestaurants.length);
        const total = App.state.filteredRestaurants.length;
        subtitle.textContent = `${App.state.addressLine || App.CONFIG.defaultAddress} · 顯示 ${shown} / ${total} 家`;
    }
    if (App.state.selectedRestaurant && App.state.route === App.ROUTE.RESTAURANT) {
        const updated = App.state.restaurants.find((r) => r.id === App.state.selectedRestaurant.id);
        if (updated) {
            App.state.selectedRestaurant.deliveryMinutes = updated.deliveryMinutes;
            const stats = App.$("#restaurantStats");
            if (stats) {
                const fee = updated.deliveryFee ?? 49;
                const count = App.state.selectedRestaurant.menu?.length ?? updated.menuCount ?? 0;
                stats.textContent = `⭐ ${updated.rating} · ${updated.deliveryMinutes} 分鐘 · 外送費 ${App.formatPrice(fee)} · ${count} 品項`;
            }
        }
    }
}

function initMap() {
    if (App.state.map) return;
    App.state.map = L.map("map", { zoomControl: false, attributionControl: false }).setView(
        [25.033, 121.565],
        14
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(
        App.state.map
    );
}

function updateHomeMapAddress() {
    const el = App.$("#homeMapAddress");
    if (el) {
        el.textContent = App.state.addressLine || App.CONFIG.defaultAddress;
    }
}

function updateMapMarkers() {
    if (!App.state.map) return;
    Object.values(App.state.markers).forEach((m) => App.state.map.removeLayer(m));
    App.state.markers = {};

    if (App.state.userLocation) {
        App.state.markers.home = L.circleMarker(
            [App.state.userLocation.lat, App.state.userLocation.lng],
            { radius: 8, color: "#06c167", fillColor: "#06c167", fillOpacity: 1, weight: 2 }
        ).addTo(App.state.map);
    }

    const nearby = sortRestaurantList([...App.state.restaurants]).slice(0, 12);
    nearby.forEach((r) => {
        const loc = App.getRestaurantMapLocation(r);
        const m = L.circleMarker([loc.lat, loc.lng], {
            radius: 5,
            color: "#000",
            fillColor: "#000",
            fillOpacity: 0.8,
            weight: 1,
        })
            .addTo(App.state.map)
            .bindPopup(r.name);
        m.on("click", () => openRestaurant(r.id));
        App.state.markers[r.id] = m;
    });

    if (App.state.userLocation) {
        App.state.map.setView([App.state.userLocation.lat, App.state.userLocation.lng], 15);
        setTimeout(() => App.state.map.invalidateSize(), 100);
    }
}

function showFeedSkeleton() {
    const container = App.$("#restaurantList");
    if (!container) return;
    container.innerHTML = Array.from({ length: 8 }, () => `
        <article class="store-card store-card-skeleton" aria-hidden="true">
            <div class="skeleton-block skeleton-cover"></div>
            <div class="store-card-body">
                <div class="skeleton-block skeleton-line lg"></div>
                <div class="skeleton-block skeleton-line"></div>
                <div class="skeleton-block skeleton-line sm"></div>
            </div>
        </article>`).join("");
}

function showMenuSkeleton() {
    App.$("#menuList").innerHTML = `
        <div class="menu-skeleton-grid" aria-hidden="true">
            ${Array.from({ length: 6 }, () => `
                <div class="menu-skeleton-card">
                    <div class="skeleton-block skeleton-thumb"></div>
                    <div class="skeleton-block skeleton-line lg"></div>
                    <div class="skeleton-block skeleton-line"></div>
                </div>`).join("")}
        </div>`;
    App.$("#featuredItems").innerHTML = "";
    App.$("#featuredBlock").style.display = "none";
    App.$("#menuNav").innerHTML = "";
}

function scrollToFirstSearchHit() {
    const q = App.normalizeSearch(App.state.searchQuery);
    if (!q) return;
    requestAnimationFrame(() => {
        const sectionTitle = [...document.querySelectorAll(".feed-section-title")].find((el) =>
            el.textContent.toLowerCase().includes(q)
        );
        if (sectionTitle) {
            sectionTitle.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }
        const card = document.querySelector(".store-card-search-hit, .store-card:not(.store-card-skeleton)");
        card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
}

function categorySlug(name) {
    return String(name).replace(/\s+/g, "-");
}

function shouldGroupFeedByCategory() {
    return App.state.activeCategory === "全部" && !App.normalizeSearch(App.state.searchQuery);
}

function renderStoreCard(r, query) {
    const loc = App.getRestaurantMapLocation(r);
    const dist = App.state.userLocation
        ? `${(App.distanceKm(App.state.userLocation, loc) * 1000).toFixed(0)} 公尺`
        : "";
    const fee = r.deliveryFee ?? 49;
    const previews = (r.previewItems || (r.menu || []).filter((m) => m.image).slice(0, 3))
        .slice(0, 3)
        .map(
            (m) =>
                `<span class="store-preview">${renderThumb({ image: m.image, emoji: m.emoji, className: "store-preview-thumb" })}</span>`
        )
        .join("");
    const menuHint = getSearchMenuHint(r, query);
    const itemCount = r.menuCount ?? r.menu?.length ?? 0;
    const menuMatch = findSearchMenuMatch(r, query);
    const hintHtml = menuHint
        ? `<div class="store-card-search-hint">${menuMatch ? App.highlightText(menuHint, menuMatch) : App.highlightText(menuHint, query)}</div>`
        : "";
    return `
        <article class="store-card${query ? " store-card-search-hit" : ""}" data-id="${r.id}">
            <div class="store-card-cover">
                ${renderThumb({ image: r.coverImage, emoji: r.emoji, className: "store-cover-thumb" })}
                <span class="store-card-time">${r.deliveryMinutes} 分鐘</span>
            </div>
            <div class="store-card-body">
                <div class="store-card-name">${App.highlightText(r.name, query)}</div>
                <div class="store-card-meta">⭐ ${r.rating} · ${dist} · 外送 ${App.formatPrice(fee)}</div>
                <div class="store-card-tagline">${App.highlightText(r.tagline || r.category || "", query)}</div>
                ${hintHtml}
                <div class="store-card-count">${itemCount} 品項可點</div>
                ${previews ? `<div class="store-card-previews">${previews}</div>` : ""}
            </div>
        </article>`;
}

function bindStoreCards(container) {
    container.querySelectorAll(".store-card").forEach((el) => {
        el.addEventListener("click", () => openRestaurant(el.dataset.id));
        el.addEventListener("mouseenter", () => {
            const restaurant = App.state.restaurants.find((r) => r.id === el.dataset.id);
            if (restaurant) prefetchRestaurantMenu(restaurant);
        });
    });
}

function disconnectFeedObserver() {
    if (App.state.feedScrollObserver) {
        App.state.feedScrollObserver.disconnect();
        App.state.feedScrollObserver = null;
    }
}

function setupFeedInfiniteScroll() {
    const sentinel = App.$("#feedLoadSentinel");
    if (!sentinel) return;
    const total = App.state.filteredRestaurants.length;
    const hasMore = App.state.feedRenderedCount < total;
    sentinel.hidden = !hasMore;

    disconnectFeedObserver();
    if (!hasMore) return;

    App.state.feedScrollObserver = new IntersectionObserver(
        (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                loadMoreFeed();
            }
        },
        { rootMargin: "240px" }
    );
    App.state.feedScrollObserver.observe(sentinel);
}

function loadMoreFeed() {
    const total = App.state.filteredRestaurants.length;
    if (App.state.feedRenderedCount >= total) {
        disconnectFeedObserver();
        const sentinel = App.$("#feedLoadSentinel");
        if (sentinel) sentinel.hidden = true;
        return;
    }
    App.state.feedRenderedCount = Math.min(App.state.feedRenderedCount + App.FEED_PAGE_SIZE, total);
    renderRestaurantList();
}

function renderRestaurantList() {
    const container = App.$("#restaurantList");
    const query = App.normalizeSearch(App.state.searchQuery);
    const list = App.state.filteredRestaurants;
    if (!list.length) {
        container.innerHTML = query
            ? `<p class="feed-empty">找不到「${App.escapeHtml(App.state.searchQuery.trim())}」相關的餐廳或料理</p>`
            : '<p class="feed-empty">尚無餐廳資料。請執行 <code>./scripts/run_scrape.sh</code> 從 Uber Eats 匯入。</p>';
        disconnectFeedObserver();
        const sentinel = App.$("#feedLoadSentinel");
        if (sentinel) sentinel.hidden = true;
        return;
    }

    const visible = list.slice(0, App.state.feedRenderedCount);
    const grouped = shouldGroupFeedByCategory();
    let html = "";

    if (grouped) {
        let currentCat = null;
        for (const r of visible) {
            const cat = inferFeedCategory(r);
            if (cat !== currentCat) {
                if (currentCat) html += "</div></section>";
                currentCat = cat;
                html += `<section class="feed-category-section" id="feed-section-${categorySlug(cat)}"><h2 class="feed-section-title">${App.escapeHtml(cat)}</h2><div class="feed-section-grid">`;
            }
            html += renderStoreCard(r, query);
        }
        if (currentCat) html += "</div></section>";
    } else {
        html = `<div class="feed-section-grid">${visible.map((r) => renderStoreCard(r, query)).join("")}</div>`;
    }

    const total = list.length;
    if (App.state.feedRenderedCount < total) {
        html += `<p class="feed-load-more">還有 ${total - App.state.feedRenderedCount} 家餐廳，繼續捲動載入…</p>`;
    }

    container.innerHTML = html;
    bindStoreCards(container);

    const subtitle = App.$("#feedSubtitle");
    if (subtitle) {
        subtitle.textContent = `${App.state.addressLine || App.CONFIG.defaultAddress} · 顯示 ${visible.length} / ${total} 家`;
    }

    setupFeedInfiniteScroll();
}

function applyMenuSearch(query) {
    const featured = document.querySelectorAll("#featuredItems .featured-card");
    let firstHit = null;

    featured.forEach((card) => {
        const name = decodeURIComponent(card.dataset.itemName || "");
        const match = !query || name.toLowerCase().includes(query);
        card.classList.toggle("search-hidden", !match);
        if (match && query && !firstHit) firstHit = card;
    });

    document.querySelectorAll(".menu-section").forEach((section) => {
        let sectionVisible = false;
        section.querySelectorAll(".menu-card").forEach((card) => {
            const name = decodeURIComponent(card.dataset.itemName || "");
            const match = !query || name.toLowerCase().includes(query);
            card.classList.toggle("search-hidden", !match);
            const nameEl = card.querySelector(".menu-card-name");
            if (nameEl) {
                const badge = nameEl.querySelector(".menu-badge");
                const badgeHtml = badge ? badge.outerHTML : "";
                nameEl.innerHTML = `${App.highlightText(name, query)} ${badgeHtml}`.trim();
            }
            if (match) {
                sectionVisible = true;
                if (query && !firstHit) firstHit = card;
            }
        });
        section.classList.toggle("search-hidden", Boolean(query) && !sectionVisible);
    });

    if (firstHit) {
        firstHit.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

function bindSearchInputs() {
    const inputs = [App.$("#headerSearch"), App.$("#headerSearchMobile")].filter(Boolean);
    if (!inputs.length) return;

    let debounceTimer = null;
    const syncSearch = (value, source) => {
        App.state.searchQuery = value;
        inputs.forEach((input) => {
            if (input !== source) input.value = value;
        });
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const q = App.normalizeSearch(value);
            if (App.state.route === App.ROUTE.HOME || !App.state.route) {
                applyFeedFilters();
                renderRestaurantList();
                scrollToFirstSearchHit();
            } else if (App.state.route === App.ROUTE.RESTAURANT) {
                applyMenuSearch(q);
            }
        }, 160);
    };

    inputs.forEach((input) => {
        input.addEventListener("input", (e) => syncSearch(e.target.value, e.target));
        input.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                input.value = "";
                syncSearch("", input);
            }
        });
    });
}

async function openRestaurant(id) {
    if (!App.state.addressLine) {
        App.showToast("請先設定外送地址");
        App.openAddressSheet();
        return;
    }
    const ok = await renderRestaurantPage(id);
    if (!ok) return;
    App.router.navigate(App.ROUTE.RESTAURANT, { restaurantId: id });
}

async function renderRestaurantPage(id) {
    const restaurant = App.state.restaurants.find((r) => r.id === id) ?? null;
    if (!restaurant) return false;

    const switchingStore = App.state.selectedRestaurant?.id !== id;
    App.state.selectedRestaurant = restaurant;
    if (switchingStore) App.clearCart();

    App.showScreen("#screenRestaurant");
    showMenuSkeleton();

    try {
        await ensureRestaurantMenu(restaurant);
    } catch {
        App.showToast("菜單載入失敗");
        return false;
    }

    const r = App.applyRestaurantImages(App.state.selectedRestaurant);
    App.state.selectedRestaurant = r;
    setRestaurantHero(r);
    App.$("#restaurantName").textContent = r.name;
    App.$("#restaurantStats").textContent = `⭐ ${r.rating} · ${r.deliveryMinutes} 分鐘 · 外送費 ${App.formatPrice(r.deliveryFee ?? 49)} · ${r.menu.length} 品項`;
    App.$("#restaurantAddress").textContent = r.address;

    App.$("#restaurantPromos").innerHTML = `
        <span class="promo-pill">滿 $400 免外送費</span>
        <span class="promo-pill accent">預計 ${r.deliveryMinutes} 分鐘送達</span>
        <span class="promo-pill muted">Uber One 會員 95 折</span>`;

    const grouped = groupMenuByCategory(r.menu);
    const categories = [...grouped.keys()];

    App.$("#menuNav").innerHTML = categories
        .map(
            (cat, i) =>
                `<button type="button" class="menu-nav-btn${i === 0 ? " active" : ""}" data-category="${cat}">${cat}</button>`
        )
        .join("");

    const featured = r.menu
        .filter((m) => m.badge === "人氣" || (m.soldCount ?? 0) > 300)
        .slice(0, 6);
    App.$("#featuredBlock").style.display = featured.length ? "" : "none";
    App.$("#featuredItems").innerHTML = featured.map(renderFeaturedCard).join("");

    App.$("#menuList").innerHTML = [...grouped.entries()]
        .map(
            ([category, items]) => `
        <section class="menu-section" id="cat-${category.replace(/\s/g, "-")}">
            <h3 class="menu-section-title">${category}</h3>
            <div class="menu-card-grid">${items.map(renderMenuCard).join("")}</div>
        </section>`
        )
        .join("");

    App.$("#menuNav").querySelectorAll(".menu-nav-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            App.$("#menuNav").querySelectorAll(".menu-nav-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            const target = document.getElementById(`cat-${btn.dataset.category.replace(/\s/g, "-")}`);
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    document.querySelectorAll(".menu-card-actions").forEach((el) => {
        bindQtyControl(el, Number(el.closest(".menu-card")?.dataset.id));
    });
    App.$("#featuredItems").querySelectorAll(".featured-add-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            App.addToCart(Number(btn.dataset.id));
        });
    });

    const q = App.normalizeSearch(App.state.searchQuery);
    if (q) applyMenuSearch(q);

    return true;
}

async function showRestaurantRouteAsync(restaurantId) {
    if (!restaurantId) {
        App.router.navigate(App.ROUTE.HOME, { replace: true });
        return;
    }
    if (!App.state.restaurants.length) return;
    if (App.state.selectedRestaurant?.id === restaurantId && App.state.selectedRestaurant.menu?.length) {
        App.showScreen("#screenRestaurant");
        App.updateCartBar();
        const q = App.normalizeSearch(App.state.searchQuery);
        if (q) applyMenuSearch(q);
        return;
    }
    const ok = await renderRestaurantPage(restaurantId);
    if (!ok) {
        App.router.navigate(App.ROUTE.HOME, { replace: true });
        return;
    }
    App.showScreen("#screenRestaurant");
    App.updateCartBar();
}

Object.assign(App, {
    emojiForAmenity,
    buildMenuFromTemplate,
    renderThumb,
    firstLocalMenuImage,
    setRestaurantHero,
    loadRestaurantFeed,
    loadSeedRestaurantsLegacy,
    ensureRestaurantMenu,
    setMenuCache,
    prefetchRestaurantMenu,
    loadSeedRestaurants,
    groupMenuByCategory,
    renderBadge,
    renderQtyControl,
    bindQtyControl,
    renderMenuCard,
    renderFeaturedCard,
    fetchOsmRestaurants,
    inferFeedCategory,
    getFeedCategories,
    getRestaurantDistanceKm,
    sortRestaurantList,
    applyFeedFilters,
    restaurantMatchesSearch,
    findSearchMenuMatch,
    getSearchMenuHint,
    applyCategoryFilter,
    renderFeedCategories,
    refreshRestaurants,
    refreshLocationDependentUi,
    initMap,
    updateHomeMapAddress,
    updateMapMarkers,
    showFeedSkeleton,
    showMenuSkeleton,
    scrollToFirstSearchHit,
    categorySlug,
    shouldGroupFeedByCategory,
    renderStoreCard,
    bindStoreCards,
    disconnectFeedObserver,
    setupFeedInfiniteScroll,
    loadMoreFeed,
    renderRestaurantList,
    applyMenuSearch,
    bindSearchInputs,
    openRestaurant,
    renderRestaurantPage,
    showRestaurantRouteAsync,
});
})(window.App);
