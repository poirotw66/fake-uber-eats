/* js/geocode.js */
window.App = window.App || {};
(function (App) {
"use strict";

async function reverseGeocode(lat, lng) {
    try {
        const params = new URLSearchParams({
            f: "json",
            location: `${lng},${lat}`,
            langCode: "zh-TW",
        });
        const res = await fetch(`${App.CONFIG.arcGisGeocodeUrl}/reverseGeocode?${params}`);
        if (!res.ok) return "";
        const data = await res.json();
        return data.address?.Match_addr || data.address?.LongLabel || "";
    } catch {
        return "";
    }
}

function loadSavedLocation() {
    try {
        const raw = localStorage.getItem(App.LOCATION_STORAGE_KEY);
        if (!raw) return null;
        const saved = JSON.parse(raw);
        if (!saved?.userLocation?.lat || !saved?.userLocation?.lng) return null;
        return saved;
    } catch {
        return null;
    }
}

function persistLocation() {
    if (!App.state.addressLine || !App.state.userLocation) return;
    localStorage.setItem(
        App.LOCATION_STORAGE_KEY,
        JSON.stringify({
            addressLine: App.state.addressLine,
            userLocation: App.state.userLocation,
        })
    );
}

function normalizeGeocodeQuery(query) {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const hasTaipei = /台北|臺北/.test(trimmed);
    const hasTaiwan = /台灣|臺灣|taiwan/i.test(trimmed);
    const candidates = [];

    if (!hasTaipei && !hasTaiwan) {
        candidates.push(`台北市${trimmed}`);
    }
    candidates.push(trimmed);

    const spaced = trimmed.replace(/(路|街|段|巷|弄|大道)(\d+)/, "$1 $2");
    if (spaced !== trimmed) {
        candidates.push(!hasTaipei && !hasTaiwan ? `台北市${spaced}` : spaced);
    }

    const simplifiedHouse = trimmed.replace(/(\d+)-\d+(號)?/, "$1$2");
    if (simplifiedHouse !== trimmed) {
        candidates.push(!hasTaipei && !hasTaiwan ? `台北市${simplifiedHouse}` : simplifiedHouse);
    }

    if (!hasTaiwan) {
        candidates.push(`${trimmed}, 台灣`);
    }

    return [...new Set(candidates)];
}

function formatPhotonDisplayName(props) {
    const street = [props.housenumber, props.street].filter(Boolean).join("");
    const area = [props.district, props.city].filter(Boolean).join("");
    if (street && area) return `${street}, ${area}`;
    return props.name || street || area || "";
}

function pickTaiwanPhotonFeature(features) {
    const taiwan = (features || []).filter(
        (feature) => (feature.properties?.countrycode || "").toUpperCase() === "TW"
    );
    return taiwan[0] || features?.[0] || null;
}

function isLikelyDefaultAreaSnap(query, lat, lng) {
    const distDefault = App.distanceKm(
        { lat: App.CONFIG.defaultLat, lng: App.CONFIG.defaultLng },
        { lat, lng }
    );
    if (distDefault > 0.2) return false;
    return !/(松仁|國泰|信義|安康)/i.test(query);
}

async function geocodeWithLocationIq(query, apiKey) {
    const params = new URLSearchParams({
        key: apiKey,
        q: query,
        format: "json",
        countrycodes: "tw",
        limit: "1",
        "accept-language": "zh-TW",
    });
    const res = await fetch(`https://us1.locationiq.com/v1/search?${params}`);
    if (!res.ok) return null;
    const results = await res.json();
    const hit = results?.[0];
    if (!hit) return null;
    return {
        lat: parseFloat(hit.lat),
        lng: parseFloat(hit.lon),
        displayName: hit.display_name || query,
        score: 100,
    };
}

async function geocodeWithArcGis(query) {
    const params = new URLSearchParams({
        f: "json",
        countryCode: "TWN",
        maxLocations: "5",
        singleLine: query,
        outFields: "Match_addr,Addr_type,Score",
        langCode: "zh-TW",
    });
    const res = await fetch(`${App.CONFIG.arcGisGeocodeUrl}/findAddressCandidates?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const candidate = (data.candidates || [])
        .filter((item) => item.score >= 75)
        .sort((a, b) => b.score - a.score)[0];
    if (!candidate) return null;
    return {
        lat: candidate.location.y,
        lng: candidate.location.x,
        displayName: candidate.address || query,
        score: candidate.score,
    };
}

async function geocodeWithPhoton(query) {
    const params = new URLSearchParams({
        q: query,
        limit: "5",
    });
    const res = await fetch(`${App.CONFIG.photonUrl}/?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = pickTaiwanPhotonFeature(data.features || []);
    if (!feature) return null;
    const [lng, lat] = feature.geometry.coordinates;
    const props = feature.properties || {};
    return {
        lat,
        lng,
        displayName: formatPhotonDisplayName(props) || query,
        score: 70,
    };
}

async function tryGeocodeCandidate(query, originalQuery) {
    const providers = [];

    if (App.CONFIG.locationIqKey) {
        providers.push(() => geocodeWithLocationIq(query, App.CONFIG.locationIqKey));
    }
    providers.push(() => geocodeWithArcGis(query));
    providers.push(() => geocodeWithPhoton(query));

    for (const provider of providers) {
        try {
            const hit = await provider();
            if (!hit) continue;
            if (isLikelyDefaultAreaSnap(originalQuery, hit.lat, hit.lng)) continue;
            return hit;
        } catch {
            /* try next provider */
        }
    }

    return null;
}

async function forwardGeocode(query) {
    const candidates = normalizeGeocodeQuery(query);

    for (const candidate of candidates) {
        const hit = await tryGeocodeCandidate(candidate, query);
        if (hit) return hit;
    }

    return null;
}

function shortenAddress(line, max = 28) {
    if (line.length <= max) return line;
    return `${line.slice(0, max)}…`;
}
function updateAddressDisplay() {
    const text = App.state.addressLine || App.CONFIG.defaultAddress;
    App.$("#addressDisplay").textContent = text.length > 22 ? `${text.slice(0, 22)}…` : text;
    App.updateHeaderDeliveryLabel();
}

function openAddressSheet() {
    App.$("#overlay").classList.add("open");
    App.$("#addressSheet").classList.add("open");
    if (App.state.addressLine) App.$("#addressLine").value = App.state.addressLine;
    hideAddressPinPicker();
    const btn = App.$("#saveAddress");
    if (btn) btn.textContent = "查詢地址";
}

function closeAddressSheet() {
    App.$("#overlay").classList.remove("open");
    App.$("#addressSheet").classList.remove("open");
    hideAddressPinPicker();
}

function createAddressPinIcon() {
    return L.divIcon({
        className: "address-pin-marker",
        html: '<div class="address-pin-marker-dot"></div>',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
    });
}

function initAddressPinMap() {
    if (App.state.addressPinMap) return;
    App.state.addressPinMap = L.map("addressPinMap", {
        zoomControl: false,
        attributionControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(
        App.state.addressPinMap
    );
}

function hideAddressPinPicker() {
    App.state.addressPinPickerActive = false;
    App.state.pendingLocation = null;
    App.$("#addressPinSection")?.classList.add("hidden");
    const btn = App.$("#saveAddress");
    if (btn) btn.textContent = "查詢地址";
}

async function showAddressPinPicker(lat, lng, label = "") {
    initAddressPinMap();
    App.state.pendingLocation = { lat, lng };
    App.state.addressPinPickerActive = true;
    App.$("#addressPinSection")?.classList.remove("hidden");
    App.$("#addressPinResolved").textContent = label || "拖曳圖釘確認位置";
    const btn = App.$("#saveAddress");
    if (btn) btn.textContent = "確認此位置";

    if (App.state.addressPinMarker) {
        App.state.addressPinMap.removeLayer(App.state.addressPinMarker);
    }
    App.state.addressPinMarker = L.marker([lat, lng], {
        icon: createAddressPinIcon(),
        draggable: true,
    }).addTo(App.state.addressPinMap);

    App.state.addressPinMarker.on("dragend", async () => {
        const pos = App.state.addressPinMarker.getLatLng();
        App.state.pendingLocation = { lat: pos.lat, lng: pos.lng };
        const addr = await reverseGeocode(pos.lat, pos.lng);
        if (addr) {
            App.$("#addressPinResolved").textContent = addr;
        }
    });

    App.state.addressPinMap.setView([lat, lng], 17);
    setTimeout(() => App.state.addressPinMap.invalidateSize(), 120);
}

async function commitAddressLocation() {
    if (!App.state.pendingLocation) return false;

    const wasTracking = App.state.route === App.ROUTE.TRACKING && App.state.trackingDestination;
    App.state.userLocation = { ...App.state.pendingLocation };
    const resolved = App.$("#addressPinResolved")?.textContent?.trim();
    const inputLine = App.$("#addressLine").value.trim();
    App.state.addressLine = shortenAddress(resolved || inputLine || App.CONFIG.defaultAddress, 48);
    updateAddressDisplay();
    persistLocation();
    App.refreshLocationDependentUi();
    hideAddressPinPicker();
    closeAddressSheet();

    if (wasTracking) {
        App.showToast("本次訂單仍送往原地址，新地址將套用於下次訂單");
    } else {
        App.showToast(`已定位：${App.state.addressLine}`, "success");
    }
    return true;
}

async function saveAddress() {
    const line = App.$("#addressLine").value.trim();
    if (!line) {
        App.showToast("請輸入地址");
        return;
    }

    if (App.state.addressPinPickerActive) {
        const btn = App.$("#saveAddress");
        if (btn) btn.disabled = true;
        await commitAddressLocation();
        if (btn) btn.disabled = false;
        return;
    }

    const btn = App.$("#saveAddress");
    if (btn) btn.disabled = true;
    App.showToast("正在查詢地址…");

    const geo = await forwardGeocode(line);
    if (geo) {
        await showAddressPinPicker(geo.lat, geo.lng, geo.displayName || line);
        App.showToast("請拖曳圖釘確認送達位置");
    } else {
        App.showToast("無法定位此地址，請輸入完整地址（含縣市、區）或改用 GPS");
    }

    if (btn) btn.disabled = false;
}

async function useGps() {
    if (!navigator.geolocation) {
        App.showToast("瀏覽器不支援定位");
        return;
    }
    App.showToast("定位中...");
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const addr = await reverseGeocode(lat, lng);
            const line = addr || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            App.state.addressLine = line;
            App.$("#addressLine").value = line;
            await showAddressPinPicker(lat, lng, line);
            App.showToast("請拖曳圖釘確認送達位置");
        },
        () => App.showToast("定位失敗，請手動輸入"),
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

Object.assign(App, {
    reverseGeocode,
    forwardGeocode,
    loadSavedLocation,
    persistLocation,
    updateAddressDisplay,
    openAddressSheet,
    closeAddressSheet,
    saveAddress,
    useGps,
    commitAddressLocation,
});
})(window.App);
