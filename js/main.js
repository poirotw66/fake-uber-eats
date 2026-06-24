import "./core.js";
import "./geocode.js";
import "./cart.js";
import "./tracking.js";
import "./feed.js";
import "./router.js";
import "./app.js";
import { App } from "./app-ns.js";

document.addEventListener("DOMContentLoaded", () => {
    App.init();
});
