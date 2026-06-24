import { App } from "./app-ns.js";

function bindEvents() {
    App.$("#addressChip").addEventListener("click", App.openAddressSheet);
    App.$("#overlay").addEventListener("click", App.closeAddressSheet);
    App.$("#saveAddress").addEventListener("click", App.saveAddress);
    App.$("#useGps").addEventListener("click", App.useGps);

    App.$("#feedSort")?.addEventListener("change", (e) => {
        App.state.feedSort = e.target.value;
        App.applyFeedFilters();
        App.renderRestaurantList();
    });
    App.$("#feedMinRating")?.addEventListener("change", (e) => {
        App.state.minRating = Number(e.target.value);
        App.applyFeedFilters();
        App.renderRestaurantList();
    });

    document.querySelector(".ue-logo")?.addEventListener("click", () => {
        App.router.navigate(App.ROUTE.HOME);
    });

    App.$("#backHome").addEventListener("click", () => App.router.back());
    App.$("#backFromCheckout").addEventListener("click", () => App.router.back());
    App.$("#backFromTracking")?.addEventListener("click", () => App.router.back());
    App.$("#cartBar").addEventListener("click", App.openCheckout);
    App.$("#placeOrderBtn").addEventListener("click", () => {
        if (!App.state.addressLine) {
            App.showToast("請設定外送地址");
            return;
        }
        if (!App.state.userLocation) {
            App.showToast("請使用 GPS 定位以啟用配送追蹤");
            App.openAddressSheet();
            return;
        }
        App.processPayment();
    });

    document.querySelectorAll(".payment-card").forEach((card) => {
        card.addEventListener("click", () => {
            document.querySelectorAll(".payment-card").forEach((c) => c.classList.remove("selected"));
            card.classList.add("selected");
            App.state.paymentMethod = card.dataset.method;
        });
    });

    App.$("#tipRow").querySelectorAll(".tip-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            App.$("#tipRow").querySelectorAll(".tip-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            App.state.tip = Number(btn.dataset.tip);
            App.openCheckout({ historyMode: "replace" });
        });
    });

    App.$("#meetDriverBtn").addEventListener("click", App.showReveal);
    App.$("#orderAgain").addEventListener("click", App.resetApp);

    window.addEventListener("popstate", () => {
        if (App.router.suppress) return;
        App.router.apply(history.state || App.router.parseHash());
    });
}

function onViewportResize() {
    App.state.map?.invalidateSize();
    App.state.trackingMap?.invalidateSize();
    App.state.addressPinMap?.invalidateSize();
}

async function init() {
    App.showFeedSkeleton();
    await App.loadSiteConfig();
    await loadDishImageRules();
    const saved = App.loadSavedLocation();
    if (saved) {
        App.state.addressLine = saved.addressLine;
        App.state.userLocation = saved.userLocation;
    } else {
        App.state.addressLine = App.CONFIG.defaultAddress;
        App.state.userLocation = { lat: App.CONFIG.defaultLat, lng: App.CONFIG.defaultLng };
    }
    bindEvents();
    App.bindSearchInputs();
    App.initMap();
    await App.refreshRestaurants();
    App.updateAddressDisplay();
    App.updateHomeMapAddress();
    App.router.syncInitial();
    window.addEventListener("resize", onViewportResize);
}


Object.assign(App, {
    bindEvents,
    onViewportResize,
    init,
});
