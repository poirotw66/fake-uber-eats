/** Shared application namespace for classic App.* wiring. */
export const App = {};
if (typeof window !== "undefined") {
    window.App = App;
}
