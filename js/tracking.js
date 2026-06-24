import { App } from "./app-ns.js";

function cleanupTracking() {
    if (App.state.driverAnimationId) cancelAnimationFrame(App.state.driverAnimationId);
    App.state.driverAnimationId = null;
    clearRouteLayer();
    if (App.state.trackingMap) {
        App.state.trackingMap.remove();
        App.state.trackingMap = null;
    }
    App.state.trackingBounds = null;
}

function setTimelineStep(index) {
    document.querySelectorAll(".timeline-item").forEach((el, i) => {
        el.classList.toggle("done", i < index);
        el.classList.toggle("active", i === index);
    });
}

function renderTimeline() {
    App.$("#timeline").innerHTML = App.TIMELINE_STEPS.map(
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

function startTracking() {
    const restaurant = App.state.selectedRestaurant;
    const destination = App.state.userLocation
        ? { lat: App.state.userLocation.lat, lng: App.state.userLocation.lng }
        : { lat: App.CONFIG.defaultLat, lng: App.CONFIG.defaultLng };
    App.state.trackingDestination = { ...destination };
    App.state.trackingAddressLine = App.state.addressLine || App.CONFIG.defaultAddress;
    const restaurantLoc = App.getRestaurantMapLocation(restaurant);
    const restaurantForMap = { ...restaurant, lat: restaurantLoc.lat, lng: restaurantLoc.lng };
    const vehicle = App.getVehicle();

    App.state.driverName = App.CONFIG.driverNames[Math.floor(Math.random() * App.CONFIG.driverNames.length)];

    App.$("#driverName").textContent = App.state.driverName;
    App.$("#driverMeta").textContent = `${vehicle.emoji} ${vehicle.name} · ${vehicle.tag}`;
    App.$("#driverAvatar").textContent = vehicle.emoji;
    App.$("#orderPaidBanner").textContent = `已透過 ${App.state.paymentMethod === "apple" ? "Apple Pay" : "Visa ···· 4242"} 付款 ${App.formatPrice(App.state.orderTotal)}`;
    App.$("#meetDriverBtn").disabled = true;
    App.$("#meetDriverBtn").classList.remove("ready");
    const arrivedBanner = App.$("#trackingArrivedBanner");
    if (arrivedBanner) arrivedBanner.hidden = true;
    const etaLabel = App.$("#etaLabel");
    if (etaLabel) etaLabel.textContent = "預計送達";

    const etaBase = restaurant.deliveryMinutes / vehicle.speed;
    const etaMin = Math.max(3, Math.round(etaBase - 3));
    const etaMax = Math.round(etaBase + 3);
    App.$("#etaTime").textContent = `${etaMin}–${etaMax}`;
    syncTrackingEtaDisplay(`${etaMin}–${etaMax}`);

    const chip = App.$("#trackingOrderChip");
    if (chip) {
        chip.innerHTML = `
            <span class="tracking-order-emoji">${restaurant.emoji || "🍽️"}</span>
            <span class="tracking-order-text">${restaurant.name}</span>
            <span class="tracking-order-badge">進行中</span>`;
    }

    renderTimeline();
    setTimelineStep(0);
    App.router.navigate(App.ROUTE.TRACKING);

    setTimeout(() => initTrackingMap(restaurantForMap, destination, vehicle), 400);
}

function syncTrackingEtaDisplay(value) {
    App.$("#etaTime").textContent = value;
    const floatEl = App.$("#etaTimeFloat");
    if (floatEl) {
        const numeric = String(value).match(/\d+/);
        floatEl.textContent = numeric ? numeric[0] : value;
    }
}

function createMapPinMarker(className, label, emoji = "") {
    return L.divIcon({
        className: `map-pin ${className}`,
        html: `<div class="map-pin-bubble">${emoji || label.slice(0, 1)}</div><div class="map-pin-stem"></div>`,
        iconSize: [40, 48],
        iconAnchor: [20, 48],
    });
}

function createDriverMarker(vehicle, lat, lng) {
    const flying = ["fly", "drift", "arc"].includes(vehicle.movement);
    return L.marker([lat, lng], {
        icon: L.divIcon({
            className: "driver-marker",
            html: `<div class="driver-marker-pulse"></div><div class="driver-marker-shell" id="driverMarkerShell" style="transform: rotate(0deg)"><div class="driver-marker-inner${flying ? " flying" : ""}" id="driverMarkerInner">${vehicle.emoji}</div></div>`,
            iconSize: [48, 48],
            iconAnchor: [24, 24],
        }),
        zIndexOffset: 1000,
    });
}

function clearRoutePolylines() {
    if (!App.state.trackingMap || !App.state.routePolylines) return;
    const { white, color } = App.state.routePolylines;
    if (white) App.state.trackingMap.removeLayer(white);
    if (color) App.state.trackingMap.removeLayer(color);
    App.state.routePolylines = null;
}

function clearRouteLayer() {
    clearRoutePolylines();
    if (App.state.routeLayer && App.state.trackingMap) {
        App.state.trackingMap.removeLayer(App.state.routeLayer);
    }
    App.state.routeLayer = null;
    App.state.routePath = null;
    App.state.routeStyle = null;
    App.state.deliveryPath = null;
}

function buildRemainingLatLngs(path, progress) {
    if (!path?.length || progress >= 1) return [];

    const clamped = Math.min(Math.max(progress, 0), 0.9999);
    const pos = pointAtDistance(path, pathLength(path) * clamped);
    const startIdx = Math.min(path.length - 2, Math.floor(clamped * (path.length - 1)));
    const latlngs = [[pos.lat, pos.lng]];

    for (let j = startIdx; j < path.length; j += 1) {
        const pt = path[j];
        const last = latlngs[latlngs.length - 1];
        if (Math.abs(last[0] - pt.lat) < 1e-8 && Math.abs(last[1] - pt.lng) < 1e-8) continue;
        latlngs.push([pt.lat, pt.lng]);
    }
    return latlngs.length >= 2 ? latlngs : [];
}

function updateRouteRemaining(progress, path = App.state.deliveryPath) {
    const style = App.state.routeStyle;
    if (!path?.length || !style || !App.state.trackingMap) return;

    clearRoutePolylines();
    const latlngs = buildRemainingLatLngs(path, progress);
    if (latlngs.length < 2) return;

    const white = L.polyline(latlngs, { ...style.whiteOpts, pane: "overlayPane" }).addTo(App.state.trackingMap);
    const colorLine = L.polyline(latlngs, { ...style.colorOpts, pane: "overlayPane" }).addTo(App.state.trackingMap);
    App.state.routePolylines = { white, color: colorLine };
}

function drawRouteLine(points, vehicle) {
    clearRouteLayer();
    if (!App.state.trackingMap || points.length < 2) return;

    const isAerial = ["fly", "drift", "arc"].includes(vehicle.movement);
    const isUnder = vehicle.movement === "underground";
    const color = isUnder ? "#2563eb" : isAerial ? "#7c3aed" : "#06c167";

    App.state.routePath = points;
    App.state.deliveryPath = points;
    App.state.routeStyle = {
        whiteOpts: {
            color: "#ffffff",
            weight: isUnder ? 7 : 9,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round",
        },
        colorOpts: {
            color,
            weight: isUnder ? 4 : 5,
            opacity: isUnder ? 0.65 : 0.92,
            dashArray: isUnder ? "6 10" : isAerial ? "10 8" : null,
            lineCap: "round",
            lineJoin: "round",
        },
    };
    updateRouteRemaining(0, points);
}

async function initTrackingMap(restaurant, destination, vehicle) {
    if (App.state.trackingMap) {
        App.state.trackingMap.remove();
        App.state.trackingMap = null;
    }

    App.state.trackingMap = L.map("trackingMap", {
        zoomControl: false,
        attributionControl: false,
    }).setView([restaurant.lat, restaurant.lng], 14);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 20,
        subdomains: "abcd",
    }).addTo(App.state.trackingMap);

    L.marker([restaurant.lat, restaurant.lng], {
        icon: createMapPinMarker("map-pin-store", restaurant.name, restaurant.emoji || "🍽️"),
    })
        .addTo(App.state.trackingMap)
        .bindPopup(restaurant.name);

    L.marker([destination.lat, destination.lng], {
        icon: L.divIcon({
            className: "map-pin map-pin-home",
            html: `<div class="map-pin-home-ring"></div><div class="map-pin-home-dot">🏠</div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 22],
        }),
    })
        .addTo(App.state.trackingMap)
        .bindPopup(App.state.trackingAddressLine || App.state.addressLine || "你的地址");

    const driverMarker = createDriverMarker(vehicle, restaurant.lat, restaurant.lng);
    driverMarker.addTo(App.state.trackingMap);
    setDriverMarkerBearing(restaurant, destination, vehicle);

    const start = { lat: restaurant.lat, lng: restaurant.lng };
    const end = { lat: destination.lat, lng: destination.lng };
    const path = await buildDeliveryPath(start, end, vehicle);
    App.state.deliveryPath = path;
    drawRouteLine(path, vehicle);

    App.state.trackingMap.fitBounds(
        L.latLngBounds(path.map((p) => [p.lat, p.lng])).pad(0.15)
    );
    App.state.trackingBounds = L.latLngBounds(path.map((p) => [p.lat, p.lng])).pad(0.08);

    setTimeout(() => {
        App.state.trackingMap?.invalidateSize();
        setDriverMarkerBearing(restaurant, destination, vehicle);
    }, 250);
    runTrackingStages(driverMarker, path, vehicle);
}

function runTrackingStages(driverMarker, path, vehicle) {
    const stages = [
        { step: 1, delay: 3000 },
        { step: 2, delay: 3500, sub: `${App.state.driverName} 已抵達餐廳 · ${vehicle.emoji}` },
        { step: 3, delay: 3000, sub: `搭乘${vehicle.name}前往你的地址` },
        { step: 4, delay: 0, animate: true },
    ];

    let i = 0;

    function next() {
        if (i >= stages.length) return;
        const stage = stages[i];
        setTimelineStep(stage.step);
        if (stage.sub) {
            const subEl = App.$(`#timelineSub${stage.step}`);
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
        total += App.distanceKm(points[i - 1], points[i]);
    }
    return total;
}

function pointAtDistance(points, targetKm) {
    let walked = 0;
    for (let i = 1; i < points.length; i++) {
        const seg = App.distanceKm(points[i - 1], points[i]);
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

function screenBearingBetween(from, to) {
    if (!App.state.trackingMap || !from || !to) return null;
    const p1 = App.state.trackingMap.latLngToContainerPoint([from.lat, from.lng]);
    const p2 = App.state.trackingMap.latLngToContainerPoint([to.lat, to.lng]);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (Math.hypot(dx, dy) < 1) return null;
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

function buildDriverMarkerTransform(deg, vehicle) {
    if (vehicle?.headingMirror) {
        const baseRotate = vehicle.headingOffset ?? 90;
        return `rotate(${deg}deg) scaleX(-1) rotate(${baseRotate}deg)`;
    }
    return `rotate(${deg + (vehicle?.headingOffset ?? 0)}deg)`;
}

function setDriverMarkerBearing(from, to, vehicle = App.getVehicle()) {
    const shellEl = document.getElementById("driverMarkerShell");
    if (!shellEl || !from || !to) return;
    const deg = screenBearingBetween(from, to);
    if (deg == null) return;
    shellEl.style.setProperty("transform", buildDriverMarkerTransform(deg, vehicle), "important");
}

function updateDriverFacing(currentPos, path, progress, vehicle) {
    if (!path?.length) return;
    const clamped = Math.min(Math.max(progress, 0), 1);
    const lookAhead = Math.min(clamped + 0.04, 1);
    const target =
        lookAhead > clamped + 1e-6
            ? pointAtDistance(path, pathLength(path) * lookAhead)
            : path[path.length - 1];
    setDriverMarkerBearing(currentPos, target, vehicle);
}

async function fetchOsrmRoute(start, end, profile) {
    const url = `${App.CONFIG.osrmUrl}/${profile}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                await App.delay(350 * (attempt + 1));
                continue;
            }
            const data = await res.json();
            const coords = data.routes?.[0]?.geometry?.coordinates;
            if (!coords?.length) {
                await App.delay(350 * (attempt + 1));
                continue;
            }
            return coords.map(([lng, lat]) => ({ lat, lng }));
        } catch {
            await App.delay(350 * (attempt + 1));
        }
    }
    return null;
}

function fallbackRoadPath(start, end, segments = 48) {
    const points = [];
    for (let i = 0; i <= segments; i++) {
        points.push(interpolate(start, end, i / segments));
    }
    return points;
}

function densifyPath(points, maxSegKm = 0.025) {
    if (points.length < 2) return points.slice();
    const dense = [{ ...points[0] }];
    for (let i = 1; i < points.length; i += 1) {
        const prev = dense[dense.length - 1];
        const next = points[i];
        const segKm = App.distanceKm(prev, next);
        if (segKm <= maxSegKm) {
            dense.push({ ...next });
            continue;
        }
        const steps = Math.ceil(segKm / maxSegKm);
        for (let step = 1; step <= steps; step += 1) {
            dense.push(interpolate(prev, next, step / steps));
        }
    }
    return dense;
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
    let path;

    switch (vehicle.movement) {
        case "road":
            path = roadPath ?? fallbackRoadPath(start, end);
            break;
        case "wobble": {
            const base = roadPath ?? fallbackRoadPath(start, end);
            path = applyWobble(base, 0.00004);
            break;
        }
        case "fly":
            path = buildArcPath(start, end, 0.28);
            break;
        case "drift":
            path = buildDriftPath(start, end);
            break;
        case "arc":
            path = buildArcPath(start, end, 0.55);
            break;
        case "underground":
            path = fallbackRoadPath(start, end, 24);
            break;
        case "teleport": {
            const base = densifyPath(roadPath ?? fallbackRoadPath(start, end));
            const jumps = 6;
            const telePoints = [];
            const total = pathLength(base);
            for (let i = 0; i <= jumps; i++) {
                telePoints.push(pointAtDistance(base, (total * i) / jumps));
            }
            path = telePoints;
            break;
        }
        default:
            path = roadPath ?? fallbackRoadPath(start, end);
    }

    return densifyPath(path);
}

function keepDriverInView(lat, lng) {
    if (!App.state.trackingMap || !App.state.trackingBounds) return;
    const point = L.latLng(lat, lng);
    if (!App.state.trackingBounds.contains(point)) {
        App.state.trackingMap.panTo(point, { animate: true, duration: 0.9 });
    }
}

function animateAlongPath(marker, path, vehicle) {
    if (App.state.driverAnimationId) cancelAnimationFrame(App.state.driverAnimationId);

    const baseDuration = 22000;
    const duration = baseDuration / vehicle.speed;
    const totalKm = Math.max(pathLength(path), 0.001);
    const t0 = performance.now();
    setTimelineStep(3);

    const inner = () => document.getElementById("driverMarkerInner");
    const isTeleport = vehicle.movement === "teleport";
    const isRoadLike = ["road", "wobble"].includes(vehicle.movement);
    let lastViewAt = 0;

    function frame(now) {
        const progress = Math.min((now - t0) / duration, 1);
        const eased = isTeleport ? progress : isRoadLike ? progress : easeInOut(progress);
        const traveledKm = totalKm * eased;
        const pos = pointAtDistance(path, traveledKm);
        marker.setLatLng([pos.lat, pos.lng]);

        if (App.state.trackingMap && now - lastViewAt > 1800) {
            keepDriverInView(pos.lat, pos.lng);
            lastViewAt = now;
        }

        updateDriverFacing(pos, path, eased, vehicle);

        const innerEl = inner();
        if (innerEl && isTeleport && progress > 0 && progress < 1) {
            const jumpStep = Math.floor(progress * 6);
            if (jumpStep !== innerEl.dataset.jump) {
                innerEl.dataset.jump = String(jumpStep);
                innerEl.classList.remove("teleporting");
                void innerEl.offsetWidth;
                innerEl.classList.add("teleporting");
            }
        }

        const remain = Math.max(0, Math.ceil((1 - progress) * 8 / vehicle.speed));
        syncTrackingEtaDisplay(remain > 0 ? String(remain) : "0");
        App.$("#timelineSub3").textContent =
            vehicle.movement === "underground"
                ? `地底全速前進中…還有 ${remain} 分鐘`
                : `預計 ${remain} 分鐘後抵達 · ${vehicle.emoji} ${vehicle.name}`;

        updateRouteRemaining(eased, path);

        if (progress < 1) {
            App.state.driverAnimationId = requestAnimationFrame(frame);
        } else {
            marker.setLatLng([path[path.length - 1].lat, path[path.length - 1].lng]);
            clearRouteLayer();
            arriveAtDoor(vehicle);
        }
    }

    App.state.driverAnimationId = requestAnimationFrame(frame);
}

function arriveAtDoor(vehicle) {
    const v = vehicle ?? App.getVehicle();
    setTimelineStep(4);
    App.$("#timelineSub4").textContent = `${App.state.driverName} 駕駛 ${v.emoji} ${v.name} 在門口等你`;
    App.$("#etaTime").textContent = "已送達";
    const etaLabel = App.$("#etaLabel");
    if (etaLabel) etaLabel.textContent = "外送員在門口等你";
    syncTrackingEtaDisplay("0");
    App.$("#meetDriverBtn").disabled = false;
    App.$("#meetDriverBtn").classList.add("ready");
    const arrivedBanner = App.$("#trackingArrivedBanner");
    if (arrivedBanner) arrivedBanner.hidden = false;
    App.showToast("外送員已抵達", "success");
    navigator.vibrate?.([12, 40, 12]);
}

function spawnConfetti(root, count = 120) {
    if (!root) return;
    const colors = ["#06c167", "#111111", "#34d399", "#fbbf24", "#60a5fa", "#f472b6", "#fff", "#ff2d55"];
    for (let i = 0; i < count; i += 1) {
        const piece = document.createElement("span");
        const isRound = i % 3 === 0;
        piece.className = isRound ? "confetti-piece confetti-round" : "confetti-piece";
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.background = colors[i % colors.length];
        piece.style.animationDelay = `${Math.random() * 0.5}s`;
        piece.style.animationDuration = `${1.4 + Math.random() * 1.8}s`;
        piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 180}px`);
        piece.style.setProperty("--spin", `${Math.random() * 720 - 360}deg`);
        root.appendChild(piece);
        setTimeout(() => piece.remove(), 4000);
    }
}

function spawnEmojiRain(root, emojis, count = 24) {
    if (!root || !emojis.length) return;
    for (let i = 0; i < count; i += 1) {
        const piece = document.createElement("span");
        piece.className = "meet-emoji-drop";
        piece.textContent = emojis[i % emojis.length];
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.animationDelay = `${Math.random() * 0.8}s`;
        piece.style.animationDuration = `${2 + Math.random() * 2}s`;
        piece.style.fontSize = `${1.2 + Math.random() * 1.4}rem`;
        root.appendChild(piece);
        setTimeout(() => piece.remove(), 4500);
    }
}

function launchCelebration(items) {
    const confettiRoot = App.$("#revealConfetti");
    const emojiRoot = App.$("#meetEmojiRain");
    const flash = App.$("#meetFlash");
    if (confettiRoot) confettiRoot.innerHTML = "";
    if (emojiRoot) emojiRoot.innerHTML = "";

    flash?.classList.remove("active");
    void flash?.offsetWidth;
    flash?.classList.add("active");

    const foodEmojis = items.map((i) => i.emoji || "🍽️");
    const extras = ["🎉", "✨", "🥳", "⭐", "💚", "🔥"];
    const pool = [...foodEmojis, ...extras];

    spawnConfetti(confettiRoot, 140);
    setTimeout(() => spawnConfetti(confettiRoot, 90), 350);
    setTimeout(() => spawnConfetti(confettiRoot, 70), 700);
    spawnEmojiRain(emojiRoot, pool, 28);
    setTimeout(() => spawnEmojiRain(emojiRoot, pool, 18), 500);

    navigator.vibrate?.([20, 50, 20, 50, 30]);
}

function bindMeetStars() {
    const stars = App.$("#meetStars");
    if (!stars || stars.dataset.bound) return;
    stars.dataset.bound = "1";
    stars.querySelectorAll(".meet-star").forEach((btn) => {
        btn.addEventListener("click", () => {
            const rating = Number(btn.dataset.star);
            stars.querySelectorAll(".meet-star").forEach((star, index) => {
                star.classList.toggle("active", index < rating);
                star.classList.toggle("pop", index < rating);
            });
            const hint = App.$("#meetRatingHint");
            if (hint) {
                hint.textContent =
                    rating >= 5 ? "太棒了！感謝你的五星好評 ⭐" : "感謝你的評價，我們會持續改進";
            }
            App.showToast("感謝你的評價！");
        });
    });
}

function showReveal() {
    const restaurant = App.state.selectedRestaurant;
    const vehicle = App.getVehicle();
    const items = App.getCartItems();
    const overlay = App.$("#revealOverlay");

    const cheers = [
        "準備迎接你的美味時刻！",
        "肚子準備好了嗎？開動！",
        "今日份快樂已送達 doorstep ✨",
        "香氣正在敲你的門 🚪",
    ];
    App.$("#meetSubtitle").textContent = `${App.state.driverName} 已將餐點送到門口`;
    const cheer = App.$("#meetCheer");
    if (cheer) cheer.textContent = cheers[Math.floor(Math.random() * cheers.length)];

    App.$("#meetDriverHero").innerHTML = `
        <div class="meet-driver-avatar-wrap">
            <div class="meet-driver-avatar-lg">${vehicle.emoji}</div>
        </div>
        <div class="meet-driver-copy">
            <div class="meet-driver-name">${App.state.driverName}</div>
            <div class="meet-driver-vehicle">${vehicle.emoji} ${vehicle.name} · ${vehicle.tag}</div>
            <div class="meet-driver-store">${restaurant?.name || "你的訂單"}</div>
        </div>
        <span class="meet-driver-badge">完美送達</span>`;

    const parade = App.$("#meetFoodParade");
    if (parade) {
        parade.innerHTML = items
            .map(
                (item, i) =>
                    `<span class="meet-parade-item" style="animation-delay:${i * 0.12}s">${App.renderThumb({ image: item.image, emoji: item.emoji, className: "meet-parade-thumb" })}</span>`
            )
            .join("");
    }

    App.$("#meetOrderItems").innerHTML = items
        .map(
            (item, i) =>
                `<div class="meet-order-line" style="animation-delay:${i * 0.08}s">
                    ${App.renderThumb({ image: item.image, emoji: item.emoji, className: "meet-order-thumb" })}
                    <div class="meet-order-body">
                        <span class="meet-order-name">${item.name}</span>
                        <span class="meet-order-qty">× ${item.qty}</span>
                    </div>
                    <span class="meet-order-price">${App.formatPrice(item.price * item.qty)}</span>
                </div>`
        )
        .join("");

    App.$("#meetOrderTotal").textContent = App.formatPrice(App.state.orderTotal);

    const stars = App.$("#meetStars");
    if (stars) {
        stars.querySelectorAll(".meet-star").forEach((star) => {
            star.classList.remove("active", "pop");
        });
    }
    const hint = App.$("#meetRatingHint");
    if (hint) hint.textContent = "點擊星星分享你的體驗";

    overlay.classList.add("open");
    document.body.classList.add("meet-active");
    bindMeetStars();
    requestAnimationFrame(() => launchCelebration(items));
}

function resetApp() {
    cleanupTracking();
    App.state.trackingDestination = null;
    App.state.trackingAddressLine = "";
    App.$("#revealOverlay").classList.remove("open");
    document.body.classList.remove("meet-active");
    App.$("#revealConfetti").innerHTML = "";
    App.$("#meetEmojiRain").innerHTML = "";
    App.$("#meetFlash")?.classList.remove("active");
    App.clearCart();
    App.state.selectedRestaurant = null;
    App.router.navigate(App.ROUTE.HOME, { replace: true });
}

Object.assign(App, {
    cleanupTracking,
    setTimelineStep,
    renderTimeline,
    startTracking,
    syncTrackingEtaDisplay,
    createMapPinMarker,
    createDriverMarker,
    clearRoutePolylines,
    clearRouteLayer,
    buildRemainingLatLngs,
    updateRouteRemaining,
    drawRouteLine,
    initTrackingMap,
    runTrackingStages,
    interpolate,
    quadraticBezier,
    easeInOut,
    pathLength,
    pointAtDistance,
    bearingBetween,
    screenBearingBetween,
    buildDriverMarkerTransform,
    setDriverMarkerBearing,
    updateDriverFacing,
    fetchOsrmRoute,
    fallbackRoadPath,
    densifyPath,
    buildArcPath,
    buildDriftPath,
    applyWobble,
    buildDeliveryPath,
    keepDriverInView,
    animateAlongPath,
    arriveAtDoor,
    spawnConfetti,
    spawnEmojiRain,
    launchCelebration,
    bindMeetStars,
    showReveal,
    resetApp,
});
