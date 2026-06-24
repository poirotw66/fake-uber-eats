import { App } from "./app-ns.js";

function getCartItems() {
    const menu = App.state.selectedRestaurant?.menu ?? [];
    return Object.entries(App.state.cart)
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
    const tip = subtotal > 0 ? App.state.tip : 0;
    return { subtotal, delivery, service, tip, grand: subtotal + delivery + service + tip };
}

function clearCart() {
    App.state.cart = {};
    updateCartBar();
}

function addToCart(id) {
    const prev = App.state.cart[id] || 0;
    setCartQty(id, prev + 1);
    if (App.state.cart[id] > prev) App.showToast("已加入購物車", "success");
}

function setCartQty(id, qty) {
    if (!App.state.selectedRestaurant) return;
    if (qty <= 0) {
        delete App.state.cart[id];
    } else {
        App.state.cart[id] = qty;
    }
    refreshMenuQtyUi();
    updateCartBar();
}

function refreshMenuQtyUi() {
    document.querySelectorAll(".menu-card").forEach((card) => {
        const id = Number(card.dataset.id);
        const qty = App.state.cart[id] || 0;
        const footer = card.querySelector(".menu-card-actions");
        if (!footer) return;
        const item = App.state.selectedRestaurant?.menu.find((m) => m.id === id);
        if (!item) return;
        footer.innerHTML = App.renderQtyControl(item, qty);
        App.bindQtyControl(footer, id);
    });
}

function openCheckout({ historyMode = "push" } = {}) {
    if (!getCartItems().length) return;
    renderCheckoutPage();
    if (historyMode === "none") {
        App.showScreen("#screenCheckout");
        App.$("#cartBar").classList.remove("visible");
        return;
    }
    App.router.navigate(App.ROUTE.CHECKOUT, { replace: historyMode === "replace" });
}

function renderCheckoutPage() {
    const fees = getFees();
    const restaurant = App.state.selectedRestaurant;
    const items = getCartItems();
    const itemCount = items.reduce((sum, item) => sum + item.qty, 0);

    App.$("#checkoutAddress").textContent = App.state.addressLine + (App.state.addressDetail ? ` · ${App.state.addressDetail}` : "");
    App.$("#addressDetail").value = App.state.addressDetail;

    if (restaurant) {
        App.$("#checkoutStoreCard").innerHTML = `
            <div class="checkout-store-thumb">
                ${App.renderThumb({ image: restaurant.coverImage, emoji: restaurant.emoji, className: "checkout-store-cover" })}
            </div>
            <div class="checkout-store-meta">
                <div class="checkout-store-name">${restaurant.name}</div>
                <div class="checkout-store-sub">${itemCount} 項 · 約 ${restaurant.deliveryMinutes} 分鐘</div>
            </div>`;
    }

    App.$("#checkoutItems").innerHTML = `
        <div class="checkout-section-head">
            <span class="checkout-section-icon">🛍️</span>
            <h3>你的訂單</h3>
        </div>
        <div class="checkout-item-list">
            ${items
                .map(
                    (item) =>
                        `<div class="checkout-item">
                            ${App.renderThumb({ image: item.image, emoji: item.emoji, className: "checkout-item-thumb" })}
                            <div class="checkout-item-body">
                                <div class="checkout-item-name">${item.name}</div>
                                <div class="checkout-item-meta">${item.qty} × ${App.formatPrice(item.price)}</div>
                            </div>
                            <span class="checkout-item-price">${App.formatPrice(item.price * item.qty)}</span>
                        </div>`
                )
                .join("")}
        </div>`;

    App.$("#checkoutSidebarItems").innerHTML = items
        .map(
            (item) =>
                `<div class="checkout-sidebar-line">
                    <span class="checkout-sidebar-qty">${item.qty}×</span>
                    <span class="checkout-sidebar-name">${item.name}</span>
                    <span class="checkout-sidebar-price">${App.formatPrice(item.price * item.qty)}</span>
                </div>`
        )
        .join("");

    App.$("#feeBreakdown").innerHTML = `
        <div class="fee-line"><span>小計</span><span>${App.formatPrice(fees.subtotal)}</span></div>
        <div class="fee-line"><span>外送費</span><span>${App.formatPrice(fees.delivery)}</span></div>
        <div class="fee-line"><span>服務費</span><span>${App.formatPrice(fees.service)}</span></div>
        <div class="fee-line"><span>小費</span><span>${App.formatPrice(fees.tip)}</span></div>
        <div class="fee-line total"><span>總計</span><span>${App.formatPrice(fees.grand)}</span></div>`;

    App.$("#checkoutTotal").textContent = App.formatPrice(fees.grand);
    renderVehiclePicker();
}

function updateCartBar() {
    const fees = getFees();
    const items = getCartItems();
    const count = items.reduce((s, i) => s + i.qty, 0);
    App.$("#cartBar").classList.toggle("visible", count > 0);
    App.$("#cartBarText").textContent = "查看購物車";
    App.$("#cartBarMeta").textContent = `${count} 項餐點`;
    App.$("#cartBarTotal").textContent = App.formatPrice(fees.grand);
    App.$("#cartBarPreviews").innerHTML = items
        .slice(0, 4)
        .map(
            (i) =>
                `<span class="cart-preview" title="${i.name}">${App.renderThumb({ image: i.image, emoji: i.emoji, className: "cart-preview-thumb" })}<span class="cart-preview-qty">${i.qty}</span></span>`
        )
        .join("");
}

function getVehicle() {
    return App.VEHICLES.find((v) => v.id === App.state.selectedVehicleId) ?? App.VEHICLES[0];
}

function renderVehiclePicker() {
    const grid = App.$("#vehicleGrid");
    grid.innerHTML = App.VEHICLES.map(
        (v) => `
        <button type="button" class="vehicle-card${v.weird ? " weird" : ""}${v.id === App.state.selectedVehicleId ? " selected" : ""}" data-vehicle="${v.id}">
            <div class="vehicle-emoji">${v.emoji}</div>
            <div class="vehicle-name">${v.name}</div>
            <div class="vehicle-tag">${v.tag}</div>
        </button>`
    ).join("");

    grid.querySelectorAll(".vehicle-card").forEach((card) => {
        card.addEventListener("click", () => {
            App.state.selectedVehicleId = card.dataset.vehicle;
            renderVehiclePicker();
        });
    });
}

async function processPayment() {
    const fees = getFees();
    App.state.orderTotal = fees.grand;
    App.state.addressDetail = App.$("#addressDetail").value.trim();

    const overlay = App.$("#paymentOverlay");
    const status = App.$("#paymentStatus");
    const spinner = App.$("#paymentSpinner");
    const successIcon = App.$("#paymentSuccessIcon");
    overlay.classList.add("open");
    spinner.hidden = false;
    successIcon.hidden = true;
    overlay.classList.remove("success");

    const method = App.state.paymentMethod === "apple" ? "Apple Pay" : "Visa ···· 4242";
    status.textContent = `正在透過 ${method} 處理付款...`;

    await App.delay(1600);

    if (App.state.paymentMethod === "apple") {
        status.textContent = "請使用 Touch ID 確認";
        await App.delay(1100);
    }

    spinner.hidden = true;
    successIcon.hidden = false;
    overlay.classList.add("success");
    status.textContent = `付款成功 · ${App.formatPrice(fees.grand)}`;
    await App.delay(900);

    overlay.classList.remove("open", "success");
    App.startTracking();
}

Object.assign(App, {
    getCartItems,
    getFees,
    clearCart,
    addToCart,
    setCartQty,
    refreshMenuQtyUi,
    openCheckout,
    renderCheckoutPage,
    updateCartBar,
    getVehicle,
    renderVehiclePicker,
    processPayment,
});
