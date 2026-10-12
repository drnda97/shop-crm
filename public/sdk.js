/**
 * ShopCRM — veza između sajta prodavnice i CRM-a. Radi na bilo kom sajtu
 * (običan HTML, WordPress, React, Vue…), bez dodatnih biblioteka:
 *
 *   <script src="https://crm.mojsajt.rs/sdk.js"></script>
 *   <script>
 *     const shop = ShopCRM.init();
 *     const { products } = await shop.getProducts();
 *     shop.cart.add(products[0].slug, 1);
 *     const result = await shop.placeOrder({ customer: { name, phone, email, street, city, postalCode, note } });
 *   </script>
 *
 * Korpa se čuva u pregledaču kupca (localStorage). Cene, popust i dostava se
 * uvek računaju u CRM-u: sajt šalje samo šta je u korpi.
 */
(function (global) {
  "use strict";

  // Adresa CRM-a se čita iz adrese ovog fajla, pa je dovoljno ubaciti <script>.
  var scriptOrigin = "";
  try {
    scriptOrigin = new URL(document.currentScript.src).origin;
  } catch {
    scriptOrigin = "";
  }

  function init(options) {
    options = options || {};
    var baseUrl = (options.baseUrl || scriptOrigin || "").replace(/\/+$/, "");
    var api = baseUrl + "/api/v1";
    var storageKey = "shopcrm-cart:" + baseUrl;
    var discountKey = "shopcrm-discount:" + baseUrl;
    var listeners = [];

    function request(path, body) {
      return fetch(api + path, {
        method: body === undefined ? "GET" : "POST",
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }).then(function (response) {
        return response.json();
      });
    }

    function read(key, fallback) {
      try {
        var raw = global.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    }

    function write(key, value) {
      try {
        if (value === null) global.localStorage.removeItem(key);
        else global.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Privatni režim ili pun localStorage: korpa važi do zatvaranja kartice.
      }
    }

    var items = read(storageKey, []);
    if (!Array.isArray(items)) items = [];
    var discountCode = read(discountKey, "") || "";

    function changed() {
      write(storageKey, items);
      listeners.forEach(function (listener) {
        listener(cart.items());
      });
    }

    /** Stavka se prepoznaje po proizvodu i varijanti: isti proizvod u drugoj varijanti je druga stavka. */
    function find(slug, variant) {
      for (var index = 0; index < items.length; index++) {
        if (items[index].slug === slug && (items[index].variant || "") === (variant || "")) return items[index];
      }
      return null;
    }

    function entry(slug, qty, variant) {
      return variant ? { slug: slug, qty: qty, variant: variant } : { slug: slug, qty: qty };
    }

    var cart = {
      /** Stavke korpe: [{ slug, qty, variant? }]. */
      items: function () {
        return items.map(function (item) {
          return entry(item.slug, item.qty, item.variant);
        });
      },
      /** Ukupan broj komada, za oznaku na ikoni korpe. */
      count: function () {
        return items.reduce(function (sum, item) {
          return sum + item.qty;
        }, 0);
      },
      /** `variant` je id varijante (product.variants[n].id); obavezan kod proizvoda koji imaju varijante. */
      add: function (slug, qty, variant) {
        var amount = Math.max(1, Math.round(qty || 1));
        var item = find(slug, variant);
        if (item) item.qty += amount;
        else items.push(entry(slug, amount, variant));
        changed();
      },
      /** Količina 0 uklanja stavku. */
      setQty: function (slug, qty, variant) {
        var amount = Math.round(qty);
        if (amount < 1) return cart.remove(slug, variant);
        var item = find(slug, variant);
        if (item) item.qty = amount;
        else items.push(entry(slug, amount, variant));
        changed();
      },
      remove: function (slug, variant) {
        items = items.filter(function (item) {
          return !(item.slug === slug && (item.variant || "") === (variant || ""));
        });
        changed();
      },
      clear: function () {
        items = [];
        changed();
      },
      /** Poziva `listener(items)` pri svakoj promeni korpe; vraća funkciju za odjavu. */
      subscribe: function (listener) {
        listeners.push(listener);
        return function () {
          listeners = listeners.filter(function (candidate) {
            return candidate !== listener;
          });
        };
      },
      /** Kod za popust koji je kupac upisao; pamti se do porudžbine. Prazno ga uklanja. */
      setDiscountCode: function (code) {
        discountCode = (code || "").trim();
        write(discountKey, discountCode || null);
      },
      discountCode: function () {
        return discountCode;
      },
      /**
       * Stavke sa proizvodima i obračun (međuzbir, popust, dostava, ukupno) sa servera.
       * Stavke kojih više nema na stanju se izbacuju iz korpe i vraćaju u `removed`.
       */
      price: function (options) {
        // options: { deliveryMethod, postalCode } — dostava se računa izabranim načinom za tu adresu.
        options = options || {};
        return request("/cart", {
          items: items,
          discountCode: discountCode,
          deliveryMethod: options.deliveryMethod || "",
          postalCode: options.postalCode || "",
        }).then(function (result) {
          var removed = result.removedItems || [];
          if (removed.length > 0) {
            items = items.filter(function (item) {
              return !removed.some(function (gone) {
                return gone.slug === item.slug && (gone.variant || "") === (item.variant || "");
              });
            });
            changed();
          }
          return result;
        });
      },
    };

    // Korpa izmenjena u drugoj kartici se vidi i u ovoj.
    global.addEventListener("storage", function (event) {
      if (event.key !== storageKey) return;
      var next = read(storageKey, []);
      items = Array.isArray(next) ? next : [];
      listeners.forEach(function (listener) {
        listener(cart.items());
      });
    });

    function query(params) {
      var parts = [];
      for (var key in params || {}) {
        if (params[key]) parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));
      }
      return parts.length > 0 ? "?" + parts.join("&") : "";
    }

    return {
      baseUrl: baseUrl,
      cart: cart,
      /** Naziv, valuta, dostava, načini plaćanja, boje, logo. */
      getStore: function () {
        return request("/store");
      },
      /** params: { category, collection, q } — sve neobavezno. */
      getProducts: function (params) {
        return request("/products" + query(params));
      },
      getProduct: function (slug) {
        return request("/products/" + encodeURIComponent(slug));
      },
      getCategories: function () {
        return request("/categories");
      },
      getCollections: function () {
        return request("/collections");
      },
      /** Kolekcija sa svojim proizvodima. */
      getCollection: function (id) {
        return request("/collections/" + encodeURIComponent(id));
      },
      getPages: function () {
        return request("/pages");
      },
      getPage: function (slug) {
        return request("/pages/" + encodeURIComponent(slug));
      },
      /** { ok: true, discount: { code, percent } } ili { ok: false, message }. */
      checkDiscount: function (code) {
        return request("/discounts/check", { code: code });
      },
      /**
       * Šalje porudžbinu sa onim što je u korpi. order: { customer, paymentMethod? }.
       * Uspeh: { ok: true, orderNumber, total, paymentMethod, paymentInstructions? } i korpa se prazni.
       * Greška: { ok: false, errors: { polje: poruka }, message? }.
       */
      placeOrder: function (order) {
        return request("/orders", {
          customer: order.customer,
          paymentMethod: order.paymentMethod || "",
          // Id načina dostave iz store.shipping.methods; bez njega važi prvi za adresu kupca.
          deliveryMethod: order.deliveryMethod || "",
          items: items,
          discountCode: discountCode,
        }).then(function (result) {
          if (result.ok) {
            cart.setDiscountCode("");
            cart.clear();
          }
          return result;
        });
      },
      /** Iznos iz API-ja (najmanje jedinice valute) kao tekst: formatPrice(125000, store.currency) → "1.250,00 €". */
      formatPrice: function (value, currency) {
        if (value === null || value === undefined) return "";
        var decimals = currency.decimals || 0;
        var abs = Math.abs(Math.round(value));
        var factor = Math.pow(10, decimals);
        var whole = String(Math.floor(abs / factor)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        var rest = decimals ? "," + ("0000" + (abs % factor)).slice(-decimals) : "";
        return (value < 0 ? "−" : "") + whole + rest + " " + currency.code;
      },
    };
  }

  global.ShopCRM = { init: init };
})(window);
