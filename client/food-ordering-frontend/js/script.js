/*
  EtenRennen — shared JavaScript
  Features:
  - Menu rendering (cards)
  - Search filter
  - Add to cart
  - Cart counter in navbar
  - Cart storage using localStorage
  - Cart page quantity +/- and remove
  - Admin dashboard (overview stats, menu CRUD, orders + filters + fulfillment)
  - Customer order tracking page (timeline, auto-refresh)
*/

(() => {
  "use strict";

  const STORAGE_KEY = "etenrennen_cart_v1";

  /** API root: same host as this page (e.g. 127.0.0.1:5500 → 127.0.0.1:5000). Override: localStorage.setItem("etenrennen_api_base", "http://127.0.0.1:5000") */
  function getApiBase() {
    try {
      const o = localStorage.getItem("etenrennen_api_base");
      if (o && /^https?:\/\//i.test(o.trim())) return o.trim().replace(/\/$/, "");
    } catch { /* ignore */ }
    if (typeof window === "undefined" || !window.location) return "http://localhost:5000";
    const { protocol, hostname } = window.location;
    if (protocol === "file:" || !hostname) return "http://localhost:5000";
    return `${protocol}//${hostname}:5000`;
  }

  // --- Fallback menu when /foods is unavailable ---
  let MENU = [
    { id: "crash-burger", name: "Bandicoot Burger", price: 299, rating: 4.6, image: "images/food-burger.jpg", tag: "Top" },
    { id: "wumpa-wrap", name: "Wumpa Wrap", price: 189, rating: 4.4, image: "images/food-wrap.jpg", tag: "New" },
    { id: "spin-pizza", name: "Spin-Away Pizza", price: 399, rating: 4.7, image: "images/food-pizza.jpg", tag: "Hot" },
    { id: "jungle-bowl", name: "Jungle Power Bowl", price: 249, rating: 4.5, image: "images/food-bowl.jpg", tag: "Vegan" },
    { id: "tropic-tacos", name: "Tropic Tacos", price: 229, rating: 4.3, image: "images/food-tacos.jpg", tag: "Crispy" },
    { id: "lava-noodles", name: "Lava Noodles", price: 349, rating: 4.2, image: "images/food-noodles.jpg", tag: "Spicy" },
    { id: "checkpoint-fries", name: "Checkpoint Fries", price: 159, rating: 4.4, image: "images/food-fries.jpg", tag: "Snack" },
    { id: "aku-juice", name: "Aku Aku Juice", price: 149, rating: 4.1, image: "images/food-juice.jpg", tag: "Cold" }
  ];

  async function loadMenuFromBackend() {
    try {
      const response = await fetch(`${getApiBase()}/foods`);
      if (!response.ok) return;

      const foods = await response.json();
      if (!Array.isArray(foods) || foods.length === 0) return;

      MENU = foods.map((f) => ({
        id: f.slug || String(f._id),
        name: f.name,
        price: Number(f.price || 0),
        rating: 4.5,
        image: f.image || "images/food-burger.jpg",
        tag: "DB",
      }));
    } catch (error) {
      console.warn("Could not load foods from backend, using fallback menu.", error);
    }
  }

  // --- Helpers ---
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function formatMoney(n) {
    const amount = Number(n);
    if (!Number.isFinite(amount)) return "₹0.00";

    // Use Indian numbering format (e.g., ₹1,23,456.78)
    // Falls back to a simple prefix if Intl isn't available.
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `₹${amount.toFixed(2)}`;
    }
  }

  function safeParse(json, fallback) {
    try { return JSON.parse(json); } catch { return fallback; }
  }

  function readCart() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const cart = safeParse(raw, { items: {} });
    if (!cart || typeof cart !== "object" || !cart.items || typeof cart.items !== "object") {
      return { items: {} };
    }
    return cart;
  }

  function writeCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }

  function getCartCount(cart = readCart()) {
    return Object.values(cart.items).reduce((sum, qty) => sum + Number(qty || 0), 0);
  }

  function getCartLines(cart = readCart()) {
    // Returns [{ item, qty }] for items still present in MENU
    const byId = new Map(MENU.map(m => [m.id, m]));
    return Object.entries(cart.items)
      .map(([id, qty]) => ({ item: byId.get(id), qty: Number(qty || 0) }))
      .filter(x => x.item && x.qty > 0);
  }

  function setCartQty(id, qty) {
    const cart = readCart();
    const n = Math.max(0, Math.floor(Number(qty || 0)));
    if (n <= 0) delete cart.items[id];
    else cart.items[id] = n;
    writeCart(cart);
    updateCartCounter();
    return cart;
  }

  function addToCart(id, qty = 1) {
    const cart = readCart();
    const current = Number(cart.items[id] || 0);
    const next = Math.max(0, current + Number(qty || 0));
    cart.items[id] = next;
    writeCart(cart);
    updateCartCounter();
    return cart;
  }

  function updateCartCounter() {
    const countEl = $("#cartCount");
    if (!countEl) return;
    const count = getCartCount();
    countEl.textContent = String(count);
  }

  // --- Navbar active link + hamburger ---
  function initNav() {
    const page = document.body?.dataset?.page || "";
    $$("[data-nav]").forEach(a => {
      if (a.dataset.nav === page) a.classList.add("active");
    });

    const btn = $("#hamburgerBtn");
    const mobileNav = $("#mobileNav");
    if (btn && mobileNav) {
      btn.addEventListener("click", () => mobileNav.classList.toggle("open"));
      // Close when clicking a link
      $$("#mobileNav a").forEach(a => a.addEventListener("click", () => mobileNav.classList.remove("open")));
    }
  }

  function injectAdminNavLinkIfAdmin() {
    if (localStorage.getItem("role") !== "admin") return;
    const label = "Admin";
    const href = "admin.html";
    $$(".nav-links, .mobile-nav").forEach((nav) => {
      if (!nav || nav.querySelector('[data-nav="admin"]')) return;
      const a = document.createElement("a");
      a.href = href;
      a.dataset.nav = "admin";
      a.textContent = label;
      const loginLink = nav.querySelector('[data-nav="login"]');
      if (loginLink) nav.insertBefore(a, loginLink);
      else nav.appendChild(a);
    });
  }

  function formatAddress(address) {
    if (!address) return "No address saved yet. Place one order to save address.";
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.pincode,
    ].filter(Boolean);
    return parts.join(", ");
  }

  function setLoggedInNavLabel(profileName) {
    const label = profileName ? `Logged in: ${profileName}` : "Logged in";
    $$('[data-nav="login"]').forEach((link) => {
      link.textContent = label;
      link.removeAttribute("href");
      link.style.cursor = "default";
      link.title = label;
    });
  }

  function renderLoggedInAuthState(profileName) {
    const page = document.body?.dataset?.page || "";
    if (page !== "login" && page !== "signup") return;

    const formPanel = document.querySelector(".panel-b.form");
    if (!formPanel) return;

    formPanel.innerHTML = `
      <h1>Welcome, ${escapeHTML(profileName || "Player")} ✅</h1>
      <p>You are already logged in with this account.</p>
      <div class="logged-in-banner">
        <div class="logged-in-title">Logged in as ${escapeHTML(profileName || "User")}</div>
        <div class="form-actions">
          <a class="btn btn-primary" href="index.html">Go to Home</a>
          <button class="btn btn-ghost" id="logoutFromAuthPage" type="button">Logout</button>
        </div>
      </div>
    `;

    const logoutBtn = $("#logoutFromAuthPage");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("userName");
        localStorage.removeItem("role");
        window.location.href = "login.html";
      });
    }
  }

  async function initProfileUI() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    const navActions = document.querySelector(".nav-actions");
    if (!navActions) return;

    let profileName = localStorage.getItem("userName") || "User";
    let profileEmail = "";
    let profileAddress = "No address saved yet. Place one order to save address.";

    setLoggedInNavLabel(profileName);
    renderLoggedInAuthState(profileName);

    try {
      const response = await fetch(`${getApiBase()}/users/${userId}/profile`);
      if (response.ok) {
        const data = await response.json();
        profileName = data?.user?.name || profileName;
        profileEmail = data?.user?.email || "";
        profileAddress = formatAddress(data?.deliveryAddress);
        localStorage.setItem("userName", profileName);
      }
    } catch (error) {
      console.warn("Could not load profile data.", error);
    }

    const initials = profileName
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

    const existingProfile = document.querySelector(".profile-wrap");
    if (existingProfile) {
      existingProfile.remove();
    }

    const profileWrap = document.createElement("div");
    profileWrap.className = "profile-wrap";

    const profileBtn = document.createElement("button");
    profileBtn.className = "profile-btn";
    profileBtn.type = "button";
    profileBtn.setAttribute("aria-label", "Open profile");
    profileBtn.textContent = initials;

    const card = document.createElement("div");
    card.className = "profile-card";
    card.hidden = true;
    card.innerHTML = `
      <div class="profile-name">${escapeHTML(profileName)}</div>
      <div class="profile-email">${escapeHTML(profileEmail)}</div>
      <div class="profile-subtitle">Saved Address</div>
      <div class="profile-address">${escapeHTML(profileAddress)}</div>
      <button id="logoutBtn" type="button" class="btn btn-ghost profile-logout">Logout</button>
    `;

    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      card.hidden = !card.hidden;
    });

    document.addEventListener("click", (e) => {
      if (!profileWrap.contains(e.target)) {
        card.hidden = true;
      }
    });

    profileWrap.appendChild(profileBtn);
    profileWrap.appendChild(card);
    navActions.appendChild(profileWrap);

    const logoutBtn = card.querySelector("#logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("userName");
        localStorage.removeItem("role");
        window.location.href = "login.html";
      });
    }
  }

  // --- Food card templates ---
  function foodCardHTML(item, { showQuickAdd = false } = {}) {
    const tag = item.tag ? `<span class="badge"><span class="star">★</span> ${escapeHTML(item.rating)} <span style="opacity:.6">•</span> ${escapeHTML(item.tag)}</span>` :
      `<span class="badge"><span class="star">★</span> ${escapeHTML(item.rating)}</span>`;

    return `
      <article class="food-card">
        <div class="food-media">
          ${tag}
          <img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.name)} image">
        </div>
        <div class="food-body">
          <div class="food-title">
            <h3>${escapeHTML(item.name)}</h3>
            <p class="price">${formatMoney(item.price)}</p>
          </div>
          <div class="food-meta">
            <span>Rating: <b style="color:#1f2a37">${escapeHTML(item.rating)}</b></span>
            <span>Fast delivery</span>
          </div>
          <div class="card-actions">
            <button class="btn btn-add" data-add="${escapeAttr(item.id)}" type="button">Add to Cart</button>
            ${showQuickAdd ? `<button class="btn-mini" data-add="${escapeAttr(item.id)}" data-qty="2" type="button">+2</button>` : ``}
          </div>
        </div>
      </article>
    `.trim();
  }

  function escapeHTML(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(s) {
    return escapeHTML(s).replaceAll("`", "&#096;");
  }

  // --- Menu page ---
  function renderMenuGrid(items) {
    const grid = $("#menuGrid");
    if (!grid) return;
    grid.innerHTML = items.map(i => foodCardHTML(i)).join("\n");
  }

  function initMenuPage() {
    const grid = $("#menuGrid");
    if (!grid) return;

    renderMenuGrid(MENU);

    const search = $("#foodSearch");
    if (search) {
      search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        const filtered = MENU.filter(m => m.name.toLowerCase().includes(q));
        renderMenuGrid(filtered);
      });
    }
  }

  // --- Home featured section (optional render) ---
  function initFeatured() {
    const featured = $("#featuredGrid");
    if (!featured) return;
    const picks = MENU.slice(0, 6);
    featured.innerHTML = picks.map(i => foodCardHTML(i, { showQuickAdd: true })).join("\n");
  }

  // --- Add-to-cart click delegation (works on any page) ---
  function initAddToCartClicks() {
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest("[data-add]");
      if (!btn) return;

      const id = btn.getAttribute("data-add");
      const qtyAttr = btn.getAttribute("data-qty");
      const qty = qtyAttr ? Number(qtyAttr) : 1;
      if (!id) return;

      addToCart(id, qty);
      toast(`Added to cart! (${id.replaceAll("-", " ")})`);
    });
  }

  // --- Cart page ---
  function calcTotals(lines) {
    const subtotal = lines.reduce((sum, l) => sum + l.item.price * l.qty, 0);
    const delivery = subtotal > 0 ? 1.49 : 0;
    const discount = subtotal >= 20 ? 2.0 : 0; // simple promo
    const total = Math.max(0, subtotal + delivery - discount);
    return { subtotal, delivery, discount, total };
  }

  function renderCart() {
    const list = $("#cartList");
    const totalsEl = $("#cartTotals");
    const emptyEl = $("#cartEmpty");
    if (!list || !totalsEl) return;

    const lines = getCartLines();
    const { subtotal, delivery, discount, total } = calcTotals(lines);

    if (lines.length === 0) {
      list.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
    } else {
      if (emptyEl) emptyEl.hidden = true;
      list.innerHTML = lines.map(({ item, qty }) => `
        <div class="cart-item" data-id="${escapeAttr(item.id)}">
          <div class="cart-thumb">
            <img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.name)} image">
          </div>
          <div class="cart-info">
            <h3>${escapeHTML(item.name)}</h3>
            <div class="line">
              <span>${formatMoney(item.price)} each</span>
              <a class="danger-link" href="#" data-remove="${escapeAttr(item.id)}">Remove</a>
            </div>
            <div class="line">
              <div class="qty">
                <button type="button" data-dec="${escapeAttr(item.id)}">−</button>
                <span aria-label="quantity">${qty}</span>
                <button type="button" data-inc="${escapeAttr(item.id)}">+</button>
              </div>
              <b>${formatMoney(item.price * qty)}</b>
            </div>
          </div>
        </div>
      `).join("\n");
    }

    totalsEl.innerHTML = `
      <div class="totals">
        <div class="row"><span>Subtotal</span><b>${formatMoney(subtotal)}</b></div>
        <div class="row"><span>Delivery</span><b>${formatMoney(delivery)}</b></div>
        <div class="row"><span>Discount</span><b>− ${formatMoney(discount)}</b></div>
        <div class="divider"></div>
        <div class="row" style="font-size:1.1rem"><span>Total</span><b>${formatMoney(total)}</b></div>
      </div>
    `.trim();

    const totalBig = $("#totalBig");
    if (totalBig) totalBig.textContent = formatMoney(total);
  }

  function initCartPage() {
    if (!$("#cartList")) return;
    renderCart();

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const inc = target.closest("[data-inc]");
      const dec = target.closest("[data-dec]");
      const rem = target.closest("[data-remove]");

      if (inc) {
        e.preventDefault();
        const id = inc.getAttribute("data-inc");
        addToCart(id, 1);
        renderCart();
      }
      if (dec) {
        e.preventDefault();
        const id = dec.getAttribute("data-dec");
        const cart = readCart();
        const next = Number(cart.items[id] || 0) - 1;
        setCartQty(id, next);
        renderCart();
      }
      if (rem) {
        e.preventDefault();
        const id = rem.getAttribute("data-remove");
        setCartQty(id, 0);
        renderCart();
      }
    });

    const proceedPaymentBtn = $("#proceedPaymentBtn");
    const placeOrderBtn = $("#placeOrderBtn");
    const paymentStep = $("#paymentStep");

    function getAddressFormValue() {
      return {
        fullName: $("#addrFullName")?.value?.trim() || "",
        phone: $("#addrPhone")?.value?.trim() || "",
        line1: $("#addrLine1")?.value?.trim() || "",
        line2: $("#addrLine2")?.value?.trim() || "",
        city: $("#addrCity")?.value?.trim() || "",
        state: $("#addrState")?.value?.trim() || "",
        pincode: $("#addrPincode")?.value?.trim() || "",
      };
    }

    if (proceedPaymentBtn) {
      proceedPaymentBtn.addEventListener("click", () => {
        const deliveryAddress = getAddressFormValue();
        if (!deliveryAddress.fullName || !deliveryAddress.phone || !deliveryAddress.line1 || !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.pincode) {
          alert("Please fill all required address fields.");
          return;
        }
        if (paymentStep) paymentStep.hidden = false;
        proceedPaymentBtn.hidden = true;
      });
    }

    if (placeOrderBtn) {
      placeOrderBtn.addEventListener("click", async () => {
        const lines = getCartLines();
        if (lines.length === 0) {
          toast("Your cart is empty. Add something tasty first!");
          return;
        }

        const userId = localStorage.getItem("userId");
        if (!userId) {
          alert("Please login first to place an order.");
          window.location.href = "login.html";
          return;
        }

        const deliveryAddress = getAddressFormValue();

        if (!deliveryAddress.fullName || !deliveryAddress.phone || !deliveryAddress.line1 || !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.pincode) {
          alert("Please fill all required address fields.");
          return;
        }
        const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked');
        const paymentMethod = selectedPayment ? selectedPayment.value : "";
        if (!paymentMethod) {
          alert("Please choose a payment method.");
          return;
        }

        const items = lines.map(({ item, qty }) => ({
          slug: item.id,
          quantity: qty,
        }));

        function resetCheckoutUiAfterOrder() {
          writeCart({ items: {} });
          updateCartCounter();
          renderCart();
          if (paymentStep) paymentStep.hidden = true;
          if (proceedPaymentBtn) proceedPaymentBtn.hidden = false;
        }

        try {
          if (paymentMethod === "RAZORPAY") {
            if (typeof window.Razorpay !== "function") {
              alert("Razorpay script did not load. Check your network, refresh the page, and try again.");
              return;
            }

            placeOrderBtn.disabled = true;
            const createRes = await fetch(`${getApiBase()}/payments/razorpay/create-order`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, items, deliveryAddress }),
            });
            const createData = await createRes.json();
            if (!createRes.ok) {
              alert(createData.message || "Could not start Razorpay checkout");
              placeOrderBtn.disabled = false;
              return;
            }

            const { keyId, amount, currency, razorpayOrderId } = createData;

            const options = {
              key: keyId,
              amount,
              currency,
              name: "EtenRennen",
              description: "Food order",
              order_id: razorpayOrderId,
              prefill: {
                name: localStorage.getItem("userName") || deliveryAddress.fullName,
                contact: deliveryAddress.phone,
              },
              theme: { color: "#3b82f6" },
              handler: async (response) => {
                try {
                  const verifyRes = await fetch(`${getApiBase()}/payments/razorpay/verify`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                    }),
                  });
                  const verifyData = await verifyRes.json();
                  if (!verifyRes.ok) {
                    alert(verifyData.message || "Payment verification failed");
                    return;
                  }
                  toast("Payment successful — order confirmed ✅");
                  resetCheckoutUiAfterOrder();
                  const paidId = verifyData.order?._id;
                  if (paidId) {
                    window.location.href = `track-order.html?order=${paidId}`;
                  }
                } catch (e) {
                  console.error(e);
                  alert("Could not verify payment with the server.");
                } finally {
                  placeOrderBtn.disabled = false;
                }
              },
              modal: {
                ondismiss: () => {
                  placeOrderBtn.disabled = false;
                },
              },
            };

            const rzp = new window.Razorpay(options);
            rzp.on("payment.failed", () => {
              placeOrderBtn.disabled = false;
            });
            rzp.open();
            return;
          }

          const response = await fetch(`${getApiBase()}/orders/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, items, deliveryAddress, paymentMethod }),
          });
          const data = await response.json();
          if (!response.ok) {
            alert(data.message || "Checkout failed");
            return;
          }

          toast("Order placed successfully ✅");
          resetCheckoutUiAfterOrder();
          const placedId = data.order?._id;
          if (placedId) {
            window.location.href = `track-order.html?order=${placedId}`;
          }
        } catch (error) {
          console.error(error);
          alert("Checkout failed due to server error.");
          placeOrderBtn.disabled = false;
        }
      });
    }
  }

  const TRACK_FLOW = ["RECEIVED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"];
  const TRACK_LABELS = {
    RECEIVED: "Order received",
    PREPARING: "Preparing",
    OUT_FOR_DELIVERY: "Out for delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  };

  function initTrackPage() {
    const root = $("#trackPageRoot");
    if (!root) return;

    const needLogin = $("#trackNeedLogin");
    const trackContent = $("#trackContent");
    const listEl = $("#trackOrderList");
    const detailTitle = $("#trackDetailTitle");
    const detailMeta = $("#trackDetailMeta");
    const detailBody = $("#trackDetailBody");
    const refreshBtn = $("#trackRefreshBtn");
    const subtitle = $("#trackSubtitle");

    let selectedId = null;
    let pollTimer = null;
    let ordersCache = [];
    let hasAppliedUrlOrder = false;

    function bearerHeaders() {
      const token = localStorage.getItem("token");
      return { Authorization: `Bearer ${token}` };
    }

    function shortOrderId(id) {
      if (!id) return "";
      const s = String(id);
      return s.slice(-8).toUpperCase();
    }

    function renderTimeline(status) {
      if (status === "CANCELLED") {
        return `<div class="track-cancel-banner" role="status"><b>Cancelled</b> — This order will not be delivered.</div>`;
      }
      const idx = TRACK_FLOW.indexOf(status);
      const currentIdx = idx === -1 ? 0 : idx;
      const items = TRACK_FLOW.map((step, i) => {
        let cls = "pending";
        if (i < currentIdx) cls = "done";
        else if (i === currentIdx) cls = "current";
        return `<li class="track-step track-step-${cls}"><span class="track-step-dot" aria-hidden="true"></span><span>${escapeHTML(TRACK_LABELS[step] || step)}</span></li>`;
      }).join("");
      return `<ol class="track-timeline" aria-label="Order progress">${items}</ol>`;
    }

    async function fetchOrders() {
      const res = await fetch(`${getApiBase()}/orders/me`, { headers: bearerHeaders() });
      if (res.status === 401) {
        needLogin.hidden = false;
        trackContent.hidden = true;
        if (subtitle) subtitle.textContent = "Sign in to see your orders.";
        return null;
      }
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }

    function renderList() {
      if (!listEl) return;
      if (ordersCache.length === 0) {
        listEl.innerHTML = `<p class="track-empty">No orders yet. <a href="menu.html">Place one from the menu</a>.</p>`;
        return;
      }
      listEl.innerHTML = ordersCache.map((o) => {
        const id = String(o._id);
        const active = selectedId === id ? " is-active" : "";
        const fs = o.fulfillmentStatus || "RECEIVED";
        const pay = o.paymentStatus || "";
        return `
          <button type="button" class="track-order-pill${active}" data-order-id="${escapeAttr(id)}">
            <span class="track-pill-id">#${escapeHTML(shortOrderId(id))}</span>
            <span class="track-pill-status">${escapeHTML(TRACK_LABELS[fs] || fs)}</span>
            <span class="track-pill-meta">${escapeHTML(new Date(o.createdAt).toLocaleDateString())} · ${formatMoney(o.totalAmount)} · ${escapeHTML(pay)}</span>
          </button>
        `;
      }).join("");
    }

    function renderDetail(order) {
      if (!detailBody) return;
      if (!order) {
        detailBody.innerHTML = `<p class="track-placeholder">Choose an order from the list to see status and items.</p>`;
        if (detailTitle) detailTitle.textContent = "Select an order";
        if (detailMeta) detailMeta.textContent = "";
        return;
      }
      const fs = order.fulfillmentStatus || "RECEIVED";
      const payLine = `${order.paymentMethod || ""} — ${order.paymentStatus || ""}`;
      const addr = order.deliveryAddress || {};
      const addrText = [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).map((p) => escapeHTML(String(p))).join(", ");
      const itemsHtml = (order.items || []).map((it) => {
        const name = it.food?.name || "Item";
        const qty = Number(it.quantity || 0);
        const unit = it.food?.price != null ? Number(it.food.price) : 0;
        const price = unit ? formatMoney(unit * qty) : "—";
        return `<div class="track-line-item"><span>${escapeHTML(name)} × ${qty}</span><b>${price}</b></div>`;
      }).join("");

      if (detailTitle) detailTitle.textContent = `Order #${shortOrderId(order._id)}`;
      if (detailMeta) {
        detailMeta.textContent = `Placed ${new Date(order.createdAt).toLocaleString()} · Total ${formatMoney(order.totalAmount)}`;
      }

      let payNote = "";
      if (order.paymentStatus === "PENDING" && order.paymentMethod === "RAZORPAY") {
        payNote = `<p class="track-pay-warn"><b>Payment pending</b> — If checkout closed before paying, you may need to place a new order.</p>`;
      }

      detailBody.innerHTML = `
        ${payNote}
        ${renderTimeline(fs)}
        <div class="track-section">
          <h3 class="track-subh">Delivery</h3>
          <p>${escapeHTML(addr.fullName || "")} · ${escapeHTML(addr.phone || "")}<br>${addrText}</p>
        </div>
        <div class="track-section">
          <h3 class="track-subh">Payment</h3>
          <p>${escapeHTML(payLine)}</p>
        </div>
        <div class="track-section">
          <h3 class="track-subh">Items</h3>
          <div class="track-line-items">${itemsHtml || "<p>No line items.</p>"}</div>
        </div>
      `;
    }

    async function selectOrder(id) {
      selectedId = id;
      renderList();
      if (!id) {
        renderDetail(null);
        return;
      }
      const res = await fetch(`${getApiBase()}/orders/track/${encodeURIComponent(id)}`, { headers: bearerHeaders() });
      if (!res.ok) {
        if (detailBody) {
          detailBody.innerHTML = `<p class="track-error">Could not load this order (${res.status}). It may belong to another account.</p>`;
          if (detailTitle) detailTitle.textContent = "Order";
          if (detailMeta) detailMeta.textContent = "";
        }
        return;
      }
      const order = await res.json();
      renderDetail(order);
    }

    async function loadAll(silent) {
      const token = localStorage.getItem("token");
      if (!token) {
        needLogin.hidden = false;
        trackContent.hidden = true;
        return;
      }
      needLogin.hidden = true;
      trackContent.hidden = false;
      if (subtitle) {
        subtitle.textContent = "Select an order for full progress. This page refreshes every 45 seconds.";
      }
      const list = await fetchOrders();
      if (list === null) return;
      ordersCache = list;
      const urlId = new URLSearchParams(window.location.search).get("order");
      if (urlId && !hasAppliedUrlOrder) {
        selectedId = urlId;
        hasAppliedUrlOrder = true;
      } else if (!selectedId && ordersCache[0]) {
        selectedId = String(ordersCache[0]._id);
      } else if (selectedId && ordersCache.length && !ordersCache.some((o) => String(o._id) === selectedId)) {
        selectedId = String(ordersCache[0]._id);
      }
      renderList();
      if (selectedId) await selectOrder(selectedId);
      else renderDetail(null);
      if (!silent) toast("Updated");
    }

    listEl?.addEventListener("click", (e) => {
      const btn = e.target instanceof HTMLElement ? e.target.closest("[data-order-id]") : null;
      if (!btn) return;
      const id = btn.getAttribute("data-order-id");
      if (id) selectOrder(id);
    });

    refreshBtn?.addEventListener("click", () => loadAll(false));

    pollTimer = setInterval(() => loadAll(true), 45000);

    loadAll(true);

    window.addEventListener("beforeunload", () => {
      if (pollTimer) clearInterval(pollTimer);
    });
  }

  const ADMIN_FULFILLMENT = ["RECEIVED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

  function adminAuthHeaders(json = true) {
    const token = localStorage.getItem("token");
    const h = { Authorization: `Bearer ${token}` };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }

  function initAdminPage() {
    const root = $("#adminDashboard");
    if (!root) return;

    let lastFoodsList = [];
    let lastOrdersList = [];

    const foodsBody = $("#adminFoodsBody");
    const ordersBody = $("#adminOrdersBody");
    const tabOverview = $("#adminTabOverview");
    const tabFoods = $("#adminTabFoods");
    const tabOrders = $("#adminTabOrders");
    const panelOverview = $("#adminOverviewPanel");
    const panelFoods = $("#adminFoodsPanel");
    const panelOrders = $("#adminOrdersPanel");
    const foodForm = $("#adminFoodForm");
    const greeting = $("#adminGreeting");
    const refreshBtn = $("#adminRefreshBtn");
    const logoutBtn = $("#adminLogoutBtn");
    const filterFulfillment = $("#adminOrderFilterFulfillment");
    const filterPayment = $("#adminOrderFilterPayment");
    const searchOrder = $("#adminOrderSearch");

    function showTab(which) {
      [tabOverview, tabFoods, tabOrders].forEach((t) => t?.classList.remove("active"));
      [panelOverview, panelFoods, panelOrders].forEach((p) => {
        if (p) p.hidden = true;
      });
      [tabOverview, tabFoods, tabOrders].forEach((t) => t?.setAttribute("aria-selected", "false"));

      if (which === "overview") {
        tabOverview?.classList.add("active");
        if (panelOverview) panelOverview.hidden = false;
        tabOverview?.setAttribute("aria-selected", "true");
      } else if (which === "foods") {
        tabFoods?.classList.add("active");
        if (panelFoods) panelFoods.hidden = false;
        tabFoods?.setAttribute("aria-selected", "true");
      } else {
        tabOrders?.classList.add("active");
        if (panelOrders) panelOrders.hidden = false;
        tabOrders?.setAttribute("aria-selected", "true");
      }
    }

    function updateDashboardStats() {
      const menuCount = Array.isArray(lastFoodsList) ? lastFoodsList.length : 0;
      const orders = Array.isArray(lastOrdersList) ? lastOrdersList : [];
      const orderCount = orders.length;
      let revenue = 0;
      let pendingPay = 0;
      const fulfillCounts = {};
      ADMIN_FULFILLMENT.forEach((s) => { fulfillCounts[s] = 0; });

      orders.forEach((o) => {
        const fs = o.fulfillmentStatus || "RECEIVED";
        if (fulfillCounts[fs] !== undefined) fulfillCounts[fs] += 1;
        if (o.paymentStatus === "PAID") {
          revenue += Number(o.totalAmount || 0);
        }
        if (o.paymentStatus === "PENDING") pendingPay += 1;
      });

      const elMenu = $("#statMenuCount");
      const elOrd = $("#statOrderCount");
      const elRev = $("#statRevenue");
      const elPend = $("#statPendingPay");
      if (elMenu) elMenu.textContent = String(menuCount);
      if (elOrd) elOrd.textContent = String(orderCount);
      if (elRev) elRev.textContent = formatMoney(revenue);
      if (elPend) elPend.textContent = String(pendingPay);

      const dl = $("#adminPipelineDl");
      if (dl) {
        const labels = {
          RECEIVED: "Received",
          PREPARING: "Preparing",
          OUT_FOR_DELIVERY: "Out for delivery",
          DELIVERED: "Delivered",
          CANCELLED: "Cancelled",
        };
        dl.innerHTML = ADMIN_FULFILLMENT.map((s) => `
          <div class="admin-pipeline-row">
            <dt>${escapeHTML(labels[s] || s)}</dt>
            <dd><strong>${fulfillCounts[s]}</strong> orders</dd>
          </div>
        `).join("");
      }
    }

    async function gate() {
      const token = localStorage.getItem("token");
      if (!token) {
        window.location.replace("login.html?next=admin.html");
        return false;
      }
      let meRes;
      try {
        meRes = await fetch(`${getApiBase()}/admin/me`, { headers: adminAuthHeaders(false) });
      } catch (err) {
        console.error(err);
        alert(
          "Cannot reach the API at " + getApiBase() + ".\n\n" +
          "Start the backend (e.g. npm start in the backend folder on port 5000). " +
          "If your API uses another URL, run in the browser console:\n" +
          'localStorage.setItem("etenrennen_api_base", "http://127.0.0.1:5000");'
        );
        return false;
      }
      if (meRes.status === 401) {
        window.location.replace("login.html?next=admin.html&reason=session");
        return false;
      }
      if (meRes.status === 403) {
        alert("You need an admin account to open this page. Run npm run seed:admin, then log in with that admin user.");
        window.location.href = "index.html";
        return false;
      }
      if (meRes.status === 404) {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("userName");
        localStorage.removeItem("role");
        window.location.replace("login.html?next=admin.html&reason=relogin");
        return false;
      }
      if (!meRes.ok) {
        let detail = "HTTP " + meRes.status;
        try {
          const err = await meRes.json();
          if (err.message) detail = err.message;
          else if (err.error) detail = String(err.error);
        } catch { /* ignore */ }
        alert("Could not verify admin session: " + detail);
        window.location.href = "index.html";
        return false;
      }
      const me = await meRes.json();
      if (greeting) {
        greeting.textContent = `Signed in as ${me.user?.name || "Admin"} (${me.user?.email || ""})`;
      }
      if (logoutBtn) {
        logoutBtn.style.display = "";
        logoutBtn.onclick = () => {
          localStorage.removeItem("token");
          localStorage.removeItem("userId");
          localStorage.removeItem("userName");
          localStorage.removeItem("role");
          window.location.href = "login.html?next=admin.html";
        };
      }
      return true;
    }

    function resetFoodForm() {
      if (!foodForm) return;
      foodForm.reset();
      const idEl = $("#adminFoodId");
      if (idEl) idEl.value = "";
      const submitBtn = $("#adminFoodSubmitBtn");
      if (submitBtn) submitBtn.textContent = "Add item";
    }

    async function loadFoods() {
      if (!foodsBody) return;
      const res = await fetch(`${getApiBase()}/foods`);
      const foods = res.ok ? await res.json() : [];
      lastFoodsList = Array.isArray(foods) ? foods : [];
      foodsBody.innerHTML = lastFoodsList.map((f) => `
        <tr data-food-id="${escapeAttr(String(f._id))}">
          <td>${escapeHTML(f.name)}</td>
          <td><code>${escapeHTML(f.slug)}</code></td>
          <td>${formatMoney(f.price)}</td>
          <td class="admin-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit-food="${escapeAttr(String(f._id))}">Edit</button>
            <button type="button" class="btn btn-ghost btn-sm danger-text" data-delete-food="${escapeAttr(String(f._id))}">Delete</button>
          </td>
        </tr>
      `).join("") || `<tr><td colspan="4">No menu items yet.</td></tr>`;
      updateDashboardStats();
    }

    function renderOrdersTable() {
      if (!ordersBody) return;
      const ff = filterFulfillment?.value || "";
      const fp = filterPayment?.value || "";
      const q = (searchOrder?.value || "").trim().toLowerCase();

      let list = [...(Array.isArray(lastOrdersList) ? lastOrdersList : [])];
      if (ff) {
        list = list.filter((o) => (o.fulfillmentStatus || "RECEIVED") === ff);
      }
      if (fp) {
        list = list.filter((o) => (o.paymentStatus || "") === fp);
      }
      if (q) {
        list = list.filter((o) => {
          const u = o.user || {};
          const hay = `${u.name || ""} ${u.email || ""}`.toLowerCase();
          return hay.includes(q);
        });
      }

      ordersBody.innerHTML = list.map((o) => {
        const id = escapeAttr(String(o._id));
        const shortId = escapeHTML(String(o._id).slice(-8).toUpperCase());
        const user = o.user || {};
        const email = escapeHTML(user.email || "—");
        const name = escapeHTML(user.name || "—");
        const pay = escapeHTML(`${o.paymentMethod || ""} / ${o.paymentStatus || ""}`);
        const fs = o.fulfillmentStatus || "RECEIVED";
        const opts = ADMIN_FULFILLMENT.map((s) =>
          `<option value="${escapeAttr(s)}"${s === fs ? " selected" : ""}>${escapeHTML(s.replace(/_/g, " "))}</option>`
        ).join("");
        const items = (o.items || []).map((it) => {
          const fn = it.food?.name || "Item";
          return `${escapeHTML(fn)} × ${Number(it.quantity || 0)}`;
        }).join(", ");
        const addr = o.deliveryAddress || {};
        const deliveryLine = [addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
        const deliveryHtml = deliveryLine
          ? `${escapeHTML(addr.city || "")}${addr.state ? `, ${escapeHTML(addr.state)}` : ""}<br><small>${escapeHTML(addr.pincode || "")}</small>`
          : "—";
        return `
          <tr data-order-id="${id}">
            <td><code class="admin-mono">${shortId}</code></td>
            <td><small>${escapeHTML(new Date(o.createdAt).toLocaleString())}</small></td>
            <td>${name}<br><small>${email}</small></td>
            <td><small>${deliveryHtml}</small></td>
            <td>${escapeHTML(items || "—")}</td>
            <td>${formatMoney(o.totalAmount)}</td>
            <td><small>${pay}</small></td>
            <td class="admin-actions">
              <select class="admin-select" aria-label="Fulfillment status">${opts}</select>
              <button type="button" class="btn btn-primary btn-sm" data-save-order>Save</button>
            </td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="8">No orders match the filters.</td></tr>`;
    }

    async function loadOrders() {
      if (!ordersBody) return;
      const res = await fetch(`${getApiBase()}/admin/orders`, { headers: adminAuthHeaders(false) });
      if (!res.ok) {
        lastOrdersList = [];
        ordersBody.innerHTML = `<tr><td colspan="8">Failed to load orders.</td></tr>`;
        updateDashboardStats();
        return;
      }
      lastOrdersList = await res.json();
      if (!Array.isArray(lastOrdersList)) lastOrdersList = [];
      renderOrdersTable();
      updateDashboardStats();
    }

    async function refreshAll() {
      const ok = await gate();
      if (!ok) return;
      await loadFoods();
      await loadOrders();
    }

    tabOverview?.addEventListener("click", () => showTab("overview"));
    tabFoods?.addEventListener("click", () => showTab("foods"));
    tabOrders?.addEventListener("click", () => showTab("orders"));

    filterFulfillment?.addEventListener("change", () => renderOrdersTable());
    filterPayment?.addEventListener("change", () => renderOrdersTable());
    searchOrder?.addEventListener("input", () => renderOrdersTable());

    foodsBody?.addEventListener("click", async (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const del = t.closest("[data-delete-food]");
      if (del) {
        const id = del.getAttribute("data-delete-food");
        if (!id || !confirm("Delete this menu item?")) return;
        const res = await fetch(`${getApiBase()}/admin/foods/${id}`, { method: "DELETE", headers: adminAuthHeaders(false) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(data.message || data.error || "Delete failed");
          return;
        }
        toast("Item deleted");
        await loadFoods();
        await loadOrders();
        return;
      }
      const edit = t.closest("[data-edit-food]");
      if (edit && foodForm) {
        const id = edit.getAttribute("data-edit-food");
        if (!id) return;
        const f = lastFoodsList.find((x) => String(x._id) === id);
        $("#adminFoodId").value = id;
        $("#adminFoodSlug").value = f?.slug || "";
        $("#adminFoodName").value = f?.name || "";
        $("#adminFoodPrice").value = f != null && f.price !== undefined ? String(f.price) : "";
        $("#adminFoodImage").value = f?.image || "";
        $("#adminFoodDesc").value = f?.description || "";
        const submitBtn = $("#adminFoodSubmitBtn");
        if (submitBtn) submitBtn.textContent = "Save changes";
        foodForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
        showTab("foods");
      }
    });

    ordersBody?.addEventListener("click", async (e) => {
      const btn = e.target instanceof HTMLElement ? e.target.closest("[data-save-order]") : null;
      if (!btn) return;
      const row = btn.closest("tr[data-order-id]");
      const oid = row?.getAttribute("data-order-id");
      const sel = row?.querySelector("select.admin-select");
      const fulfillmentStatus = sel?.value;
      if (!oid || !fulfillmentStatus) return;
      const res = await fetch(`${getApiBase()}/admin/orders/${oid}`, {
        method: "PATCH",
        headers: adminAuthHeaders(),
        body: JSON.stringify({ fulfillmentStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || data.error || "Update failed");
        return;
      }
      toast("Order updated");
      const updated = data.order;
      if (updated && updated._id) {
        const idx = lastOrdersList.findIndex((o) => String(o._id) === String(updated._id));
        if (idx >= 0) lastOrdersList[idx] = { ...lastOrdersList[idx], ...updated };
      }
      await loadOrders();
    });

    foodForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = $("#adminFoodId")?.value?.trim();
      const slug = $("#adminFoodSlug")?.value?.trim();
      const name = $("#adminFoodName")?.value?.trim();
      const price = Number($("#adminFoodPrice")?.value);
      const image = $("#adminFoodImage")?.value?.trim() || undefined;
      const description = $("#adminFoodDesc")?.value?.trim() || undefined;
      if (!slug || !name || !Number.isFinite(price)) {
        alert("Slug, name, and a valid price are required.");
        return;
      }
      let res;
      if (id) {
        res = await fetch(`${getApiBase()}/admin/foods/${id}`, {
          method: "PUT",
          headers: adminAuthHeaders(),
          body: JSON.stringify({ slug, name, price, image, description }),
        });
      } else {
        res = await fetch(`${getApiBase()}/admin/foods`, {
          method: "POST",
          headers: adminAuthHeaders(),
          body: JSON.stringify({ slug, name, price, image, description }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || data.error || "Save failed");
        return;
      }
      toast(id ? "Item updated" : "Item added");
      resetFoodForm();
      await loadFoods();
      updateDashboardStats();
    });

    $("#adminFoodCancelBtn")?.addEventListener("click", () => resetFoodForm());
    refreshBtn?.addEventListener("click", () => refreshAll());

    showTab("overview");
    refreshAll();
  }

  // --- Simple toast (no dependency) ---
  let toastTimer = null;
  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => { el.hidden = true; }, 220);
    }, 1400);
  }

  function initLoginSessionBanner() {
    const page = document.body?.dataset?.page || "";
    if (page !== "login") return;
    const el = $("#loginSessionBanner");
    if (!el) return;
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason");
    if (!reason) return;
    const forAdmin = params.get("next") === "admin.html";
    const tail = forAdmin ? " Then open admin.html again." : "";
    const messages = {
      relogin:
        "Your saved login does not match any user in the current database (this often happens after MongoDB was reset or MONGO_URI was changed). " +
        "Sign in below. For admin, run npm run seed:admin in the backend folder, then log in with that admin email and password." +
        tail,
      session: "Your session expired or the token is invalid. Please sign in again." + tail,
    };
    const text = messages[reason];
    if (!text) return;
    el.textContent = text;
    el.hidden = false;
    el.classList.toggle("is-warn", reason === "relogin");
    if (window.history?.replaceState) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete("reason");
      const q = clean.searchParams.toString();
      window.history.replaceState({}, "", clean.pathname + (q ? `?${q}` : "") + clean.hash);
    }
  }

  function initAuth() {
    const form = document.querySelector("form");
    const page = document.body?.dataset?.page || "";
    if (!form || (page !== "login" && page !== "signup")) return;

    if (localStorage.getItem("userId")) {
      return;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        if (page === "signup") {
          const name = document.querySelector("#signupName")?.value?.trim();
          const email = document.querySelector("#signupEmail")?.value?.trim();
          const password = document.querySelector("#signupPassword")?.value;
          const confirm = document.querySelector("#signupConfirm")?.value;

          if (!name || !email || !password) {
            alert("Please fill all required fields.");
            return;
          }
          if (password !== confirm) {
            alert("Passwords do not match.");
            return;
          }

          const response = await fetch(`${getApiBase()}/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
          });
          const data = await response.json();
          if (!response.ok) {
            alert(data.message || "Signup failed");
            return;
          }
          alert("Signup successful ✅ Please login.");
          window.location.href = "login.html";
          return;
        }

        const email = document.querySelector("#loginEmail")?.value?.trim();
        const password = document.querySelector("#loginPassword")?.value;
        const response = await fetch(`${getApiBase()}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) {
          alert(data.message || "Login failed");
          return;
        }
        localStorage.setItem("token", data.token);
        if (data.userId) {
          localStorage.setItem("userId", data.userId);
        }
        if (data.name) {
          localStorage.setItem("userName", data.name);
        }
        localStorage.setItem("role", data.role || "customer");
        alert("Login Successful ✅");
        const next = new URLSearchParams(window.location.search).get("next");
        if (next === "admin.html" && (data.role || "customer") === "admin") {
          window.location.href = "admin.html";
          return;
        }
        if (next === "track-order.html") {
          window.location.href = "track-order.html";
          return;
        }
        window.location.href = "index.html";
      } catch (error) {
        console.error(error);
        alert("Server error ❌");
      }
    });
  }

  function init() {
    const page = document.body?.dataset?.page || "";

    initLoginSessionBanner();
    injectAdminNavLinkIfAdmin();
    initNav();
    initAddToCartClicks();
    updateCartCounter();
    initCartPage();
    initAuth();
    initProfileUI();
    initMenuPage();
    initFeatured();
    initAdminPage();
    initTrackPage();

    // Keep auth/cart interactions responsive even if backend is down.
    if (page === "home" || page === "menu" || page === "cart") {
      loadMenuFromBackend().then(() => {
        initMenuPage();
        initFeatured();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    init();
  });
})();

