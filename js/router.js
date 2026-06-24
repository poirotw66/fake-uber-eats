import { App } from "./app-ns.js";

const ROUTE = {
    HOME: "home",
    RESTAURANT: "restaurant",
    CHECKOUT: "checkout",
    TRACKING: "tracking",
};

const router = {
    suppress: false,

    hashFor(route, restaurantId = null) {
        switch (route) {
            case App.ROUTE.RESTAURANT:
                return `#/restaurant/${encodeURIComponent(restaurantId || "")}`;
            case App.ROUTE.CHECKOUT:
                return "#/checkout";
            case App.ROUTE.TRACKING:
                return "#/tracking";
            default:
                return "#/";
        }
    },

    parseHash(hash = location.hash) {
        if (!hash || hash === "#") return { route: App.ROUTE.HOME, restaurantId: null };
        const match = hash.match(/^#\/restaurant\/(.+)$/);
        if (match) {
            return { route: App.ROUTE.RESTAURANT, restaurantId: decodeURIComponent(match[1]) };
        }
        if (hash === "#/checkout") return { route: App.ROUTE.CHECKOUT, restaurantId: null };
        if (hash === "#/tracking") return { route: App.ROUTE.TRACKING, restaurantId: null };
        return { route: App.ROUTE.HOME, restaurantId: null };
    },

    navigate(route, { restaurantId = null, replace = false } = {}) {
        const next = { route, restaurantId };
        const hash = this.hashFor(route, restaurantId);
        this.suppress = true;
        if (replace) {
            history.replaceState(next, "", hash);
        } else {
            history.pushState(next, "", hash);
        }
        this.apply(next);
        this.suppress = false;
    },

    back() {
        if (history.length > 1) {
            history.back();
            return;
        }
        this.navigate(App.ROUTE.HOME, { replace: true });
    },

    apply(routeState) {
        App.state.route = routeState.route;
        switch (routeState.route) {
            case App.ROUTE.HOME:
                showHomeRoute();
                break;
            case App.ROUTE.RESTAURANT:
                void showRestaurantRoute(routeState.restaurantId);
                break;
            case App.ROUTE.CHECKOUT:
                showCheckoutRoute();
                break;
            case App.ROUTE.TRACKING:
                showTrackingRoute();
                break;
            default:
                showHomeRoute();
        }
    },

    syncInitial() {
        const initial = this.parseHash();
        history.replaceState(initial, "", this.hashFor(initial.route, initial.restaurantId));
        this.apply(initial);
    },
};

function showScreen(id) {
    const wasTracking = App.$("#screenTracking").classList.contains("screen-active");
    if (wasTracking && id !== "#screenTracking") {
        App.cleanupTracking();
    }

    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("screen-active"));
    App.$(id).classList.add("screen-active");
    const isTracking = id === "#screenTracking";
    document.body.classList.toggle("no-scroll", isTracking);
    document.body.classList.toggle("tracking-active", isTracking);
    App.$("#cartBar").classList.toggle("hidden", id !== "#screenRestaurant");

    if (isTracking) {
        setTimeout(() => {
            App.state.trackingMap?.invalidateSize();
        }, 200);
    } else {
        setTimeout(() => {
            App.state.map?.invalidateSize();
        }, 150);
    }
}

function showHomeRoute() {
    App.state.selectedRestaurant = null;
    App.clearCart();
    showScreen("#screenHome");
    App.updateCartBar();
}

function showRestaurantRoute(restaurantId) {
    return App.showRestaurantRouteAsync(restaurantId);
}

function showCheckoutRoute() {
    if (!App.state.selectedRestaurant) {
        App.router.navigate(App.ROUTE.HOME, { replace: true });
        return;
    }
    if (!App.getCartItems().length) {
        App.router.navigate(App.ROUTE.RESTAURANT, {
            restaurantId: App.state.selectedRestaurant.id,
            replace: true,
        });
        return;
    }
    App.renderCheckoutPage();
    showScreen("#screenCheckout");
    App.$("#cartBar").classList.remove("visible");
}

function showTrackingRoute() {
    if (!App.state.selectedRestaurant) {
        App.router.navigate(App.ROUTE.HOME, { replace: true });
        return;
    }
    showScreen("#screenTracking");
}

Object.assign(App, {
    ROUTE,
    router,
    showScreen,
    showHomeRoute,
    showRestaurantRoute,
    showCheckoutRoute,
    showTrackingRoute,
});
