/** Client-side dish image resolver (mirrors scripts/dish_images.py). */

let dishImageRules = null;
let itemImageMap = null;

async function loadDishImageRules() {
    if (dishImageRules && itemImageMap) {
        return { rules: dishImageRules, items: itemImageMap };
    }
    try {
        const [rulesRes, itemsRes] = await Promise.all([
            fetch("data/dish_image_rules.json"),
            fetch("data/item_images.json"),
        ]);
        dishImageRules = rulesRes.ok ? await rulesRes.json() : { rules: [], mcd_scene7: {} };
        itemImageMap = itemsRes.ok ? await itemsRes.json() : {};
    } catch {
        dishImageRules = { rules: [], mcd_scene7: {} };
        itemImageMap = {};
    }
    return { rules: dishImageRules, items: itemImageMap };
}

function resolveDishImage(itemName, itemId, shopCategory = "") {
    const explicit = itemImageMap?.[String(itemId)];
    if (explicit) return explicit;

    const mcdMap = dishImageRules?.mcd_scene7 || {};
    for (const [key, url] of Object.entries(mcdMap)) {
        if (itemName.includes(key)) return url;
    }

    const sortedRules = [...(dishImageRules?.rules || [])].sort(
        (a, b) =>
            Math.max(...(b.keywords || []).map((k) => k.length), 0) -
            Math.max(...(a.keywords || []).map((k) => k.length), 0)
    );

    for (const rule of sortedRules) {
        const keywords = rule.keywords || [];
        if (!keywords.some((kw) => itemName.includes(kw))) continue;
        const images = rule.images || [];
        if (!images.length) continue;
        return images[itemId % images.length];
    }

    const fallbacks = {
        中式: "https://images.pexels.com/photos/7282337/pexels-photo-7282337.jpeg?auto=compress&cs=tinysrgb&w=640",
        炸物: "https://images.pexels.com/photos/60616/fried-chicken-chicken-fried-crunchy-60616.jpeg?auto=compress&cs=tinysrgb&w=640",
        飲料: "https://images.pexels.com/photos/3026810/pexels-photo-3026810.jpeg?auto=compress&cs=tinysrgb&w=640",
        日式: "https://www.themealdb.com/images/media/meals/ip5xtp1769779958.jpg",
        披薩: "https://images.pexels.com/photos/1146760/pexels-photo-1146760.jpeg?auto=compress&cs=tinysrgb&w=640",
        咖啡: "https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=640",
    };
    return fallbacks[shopCategory] || null;
}
