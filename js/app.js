/**
 * App Module for CPE Polo Shirt Ordering Web Application
 * Handles Shirt Configurator, Cart Drawer, Checkout, PromptPay QR & Order Tracking
 */

class CPEPoloApp {
  constructor() {
    this.cartKey = 'cpe_shopping_cart';
    this.ordersKey = 'cpe_orders';
    this.cart = [];
    this.selectedSize = 'M';
    this.currentView = 'front';
    this.selectedProduct = 'polo'; // 'polo' or 'jacket'
    this.customEmbroideryFee = 30;

    this.products = {
      polo: {
        id: 'polo',
        title: 'เสื้อโปโลสาขาวิศวกรรมคอมพิวเตอร์ (CPE Polo Shirt)',
        batch: 'LXVIII (รุ่น 68)',
        basePrice: 240,
        largeFee: 10,
        originalPrice: 350,
        badgeText: 'ราคาสาขาพิเศษ ฿240',
        images: {
          front: 'assets/shirt_front.jpg',
          back: 'assets/shirt_back.jpg',
          sleeve: 'assets/shirt_sleeve.jpg'
        },
        specs: [
          'อกซ้าย: <strong>ปักตรา CPE PSRU</strong>',
          'ด้านหลัง: <strong>สกรีนวงจร Computer Eng</strong>',
          'แขนเสื้อ: <strong>ปักเลขโรมัน LXVIII</strong>'
        ]
      },
      jacket: {
        id: 'jacket',
        title: 'เสื้อคลุมสาขาวิศวกรรมคอมพิวเตอร์ (CPE 69 Jacket)',
        batch: 'LXIX (รุ่น 69)',
        basePrice: 920,
        largeFee: 100,
        originalPrice: 1200,
        badgeText: 'สำหรับน้อง CPE 69 (3XL+ +฿100)',
        images: {
          front: 'assets/jacket_banner.png',
          back: 'assets/jacket_banner.png',
          sleeve: 'assets/jacket_banner.png'
        },
        specs: [
          'ผ้าไมโครโพลีเอสเตอร์: <strong>ระบายอากาศได้ดี</strong>',
          'อกซ้าย: <strong>ปักตรา CPE PSRU</strong>',
          'แขนขวา: <strong>ปักเลขโรมัน LXIX</strong>'
        ]
      }
    };
    
    this.init();
  }

  init() {
    this.loadCart();
    this.renderShirtSVG();
    this.bindConfiguratorEvents();
    this.bindCartDrawerEvents();
    this.bindCheckoutEvents();
    this.bindTrackingEvents();
    this.bindModalEvents();
    this.initBannerSlider();
    this.updateCartUI();
    this.ensureDemoOrders();
  }

  /* HERO BANNER AUTO SLIDER & CONTROLS */
  initBannerSlider() {
    this.currentSlideIndex = 0;
    const slides = document.querySelectorAll('.banner-slide');
    const dots = document.querySelectorAll('.slider-dots .dot');
    const prevBtn = document.getElementById('bannerPrevBtn');
    const nextBtn = document.getElementById('bannerNextBtn');

    if (!slides.length) return;

    const goToSlide = (index) => {
      this.currentSlideIndex = (index + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle('active', i === this.currentSlideIndex));
      dots.forEach((d, i) => d.classList.toggle('active', i === this.currentSlideIndex));
    };

    const nextSlide = () => goToSlide(this.currentSlideIndex + 1);
    const prevSlide = () => goToSlide(this.currentSlideIndex - 1);

    if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); this.resetAutoSlide(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); this.resetAutoSlide(); });

    dots.forEach((dot, idx) => {
      dot.addEventListener('click', () => { goToSlide(idx); this.resetAutoSlide(); });
    });

    this.startAutoSlide();
  }

  startAutoSlide() {
    this.stopAutoSlide();
    this.bannerTimer = setInterval(() => {
      const slides = document.querySelectorAll('.banner-slide');
      if (slides.length) {
        this.currentSlideIndex = (this.currentSlideIndex + 1) % slides.length;
        slides.forEach((s, i) => s.classList.toggle('active', i === this.currentSlideIndex));
        document.querySelectorAll('.slider-dots .dot').forEach((d, i) => d.classList.toggle('active', i === this.currentSlideIndex));
      }
    }, 5000);
  }

  stopAutoSlide() {
    if (this.bannerTimer) clearInterval(this.bannerTimer);
  }

  resetAutoSlide() {
    this.startAutoSlide();
  }

  selectProductFromBanner(prodKey) {
    const tabBtn = prodKey === 'jacket' ? document.getElementById('prodTabJacket') : document.getElementById('prodTabPolo');
    if (tabBtn) tabBtn.click();

    const orderSection = document.getElementById('ordering');
    if (orderSection) orderSection.scrollIntoView({ behavior: 'smooth' });
  }

  ensureDemoOrders() {
    const existing = localStorage.getItem(this.ordersKey);
    if (!existing) {
      const demoOrders = [
        {
          id: 'CPE-2026-8819',
          studentId: '6812345678',
          name: 'สมชาย ใจดี (CPE68)',
          items: [
            { size: 'L', qty: 1, customName: 'ต้อม CPE', price: 270, title: 'เสื้อโปโลสาขาวิศวกรรมคอมพิวเตอร์ (CPE Polo Shirt)' }
          ],
          total: 270,
          status: 'shipping', // pending, paid, preparing, shipping, completed
          date: '2026-08-04 14:30',
          trackingNumber: 'TH6800192837'
        }
      ];
      localStorage.setItem(this.ordersKey, JSON.stringify(demoOrders));
    }
  }

  loadCart() {
    const saved = localStorage.getItem(this.cartKey);
    if (saved) {
      try {
        this.cart = JSON.parse(saved);
      } catch (e) {
        this.cart = [];
      }
    }
  }

  saveCart() {
    localStorage.setItem(this.cartKey, JSON.stringify(this.cart));
    this.updateCartUI();
  }

  /* RENDER REAL SHIRT PHOTO PREVIEW */
  renderShirtSVG() {
    const display = document.getElementById('productSvgDisplay');
    if (!display) return;

    const prod = this.products[this.selectedProduct] || this.products['polo'];
    let imgSrc = prod.images[this.currentView] || prod.images['front'];
    let imgAlt = `${prod.title} - ${this.currentView}`;
    let objPos = this.selectedProduct === 'jacket' ? 'center center' : (this.currentView === 'sleeve' ? 'center 35%' : 'center 10%');

    const currentCustomText = document.getElementById('customNameInput') ? document.getElementById('customNameInput').value.trim() : '';

    display.innerHTML = `
      <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:12px;">
        <img src="${imgSrc}" alt="${imgAlt}" style="width:100%; height:100%; object-fit:${this.selectedProduct === 'jacket' ? 'contain' : 'cover'}; object-position:${objPos}; border-radius:10px; transition:all 0.4s ease;" class="shirt-photo-preview" />
        <div id="svgCustomNameText" style="position:absolute; bottom:15px; background:rgba(139,12,26,0.92); border:1px solid var(--accent-gold); color:var(--accent-gold-bright); padding:6px 16px; border-radius:20px; font-size:0.88rem; font-weight:600; box-shadow:0 4px 15px rgba(0,0,0,0.7); display:${currentCustomText ? 'block' : 'none'}; z-index:10;">
          ${currentCustomText ? `ปักชื่อ: ${currentCustomText}` : ''}
        </div>
      </div>
    `;
  }

  bindConfiguratorEvents() {
    // Product Switcher Tabs (Polo vs Jacket)
    const prodTabPolo = document.getElementById('prodTabPolo');
    const prodTabJacket = document.getElementById('prodTabJacket');

    const switchProduct = (prodKey) => {
      this.selectedProduct = prodKey;
      if (prodTabPolo && prodTabJacket) {
        prodTabPolo.classList.toggle('active', prodKey === 'polo');
        prodTabJacket.classList.toggle('active', prodKey === 'jacket');
      }

      const prod = this.products[prodKey];
      const titleEl = document.getElementById('productTitleDisplay');
      const badgeEl = document.getElementById('productBadgeDisplay');
      const origPriceEl = document.getElementById('productOriginalPriceDisplay');

      if (titleEl) titleEl.textContent = prod.title;
      if (badgeEl) badgeEl.textContent = prod.badgeText;
      if (origPriceEl) origPriceEl.textContent = `฿${prod.originalPrice.toLocaleString()}`;

      // Update Size Pills Surcharge Labels
      document.querySelectorAll('.size-pill').forEach(pill => {
        const size = pill.dataset.size;
        const isLarge = ['3XL', '4XL', '5XL', '6XL', '7XL', '8XL'].includes(size);
        const surchargeText = isLarge ? `<span style="font-size:0.72rem; color:#F5D061; display:block">+${prod.largeFee}฿</span>` : '';
        const baseLabels = {
          'SS': 'SS (34")', 'S': 'S (36")', 'M': 'M (38")', 'L': 'L (40")', 'XL': 'XL (42")',
          '2XL': '2XL (44")', '3XL': '3XL (46")', '4XL': '4XL (48")', '5XL': '5XL (50")',
          '6XL': '6XL (52")', '7XL': '7XL (54")', '8XL': '8XL (56")'
        };
        pill.innerHTML = `${baseLabels[size] || size} ${surchargeText}`;
      });

      // Update Specs Badges
      const specsContainer = document.getElementById('shirtDetailBadges');
      if (specsContainer) {
        specsContainer.innerHTML = prod.specs.map(spec => `
          <div class="detail-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
            ${spec}
          </div>
        `).join('');
      }

      // Update Hero Banner Image if present
      const heroImg = document.querySelector('.banner-img');
      if (heroImg) {
        heroImg.src = prodKey === 'jacket' ? 'assets/jacket_banner.png' : 'assets/banner.png';
      }

      this.renderShirtSVG();
      this.calculateProductPrice();
    };

    if (prodTabPolo) prodTabPolo.addEventListener('click', () => switchProduct('polo'));
    if (prodTabJacket) prodTabJacket.addEventListener('click', () => switchProduct('jacket'));

    // Front / Back / Sleeve View Toggle
    const viewFrontBtn = document.getElementById('viewFrontBtn');
    const viewBackBtn = document.getElementById('viewBackBtn');
    const viewSleeveBtn = document.getElementById('viewSleeveBtn');

    const updateActiveView = (view, activeBtn) => {
      this.currentView = view;
      [viewFrontBtn, viewBackBtn, viewSleeveBtn].forEach(b => { if (b) b.classList.remove('active'); });
      if (activeBtn) activeBtn.classList.add('active');
      this.renderShirtSVG();
    };

    if (viewFrontBtn) viewFrontBtn.addEventListener('click', () => updateActiveView('front', viewFrontBtn));
    if (viewBackBtn) viewBackBtn.addEventListener('click', () => updateActiveView('back', viewBackBtn));
    if (viewSleeveBtn) viewSleeveBtn.addEventListener('click', () => updateActiveView('sleeve', viewSleeveBtn));

    // Size Selection Pills
    const sizePills = document.querySelectorAll('.size-pill');
    sizePills.forEach(pill => {
      pill.addEventListener('click', () => {
        sizePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.selectedSize = pill.dataset.size;
        const displaySize = document.getElementById('selectedSizeDisplay');
        if (displaySize) {
          const prod = this.products[this.selectedProduct];
          const isLarge = ['3XL', '4XL', '5XL', '6XL', '7XL', '8XL'].includes(this.selectedSize);
          displaySize.innerHTML = `${this.selectedSize} ${isLarge ? `<span style="font-size:0.8rem; color:#F5D061">(+${prod.largeFee}฿ ไซส์พิเศษ)</span>` : ''}`;
        }
        this.calculateProductPrice();
      });
    });

    // Quantity Controls
    const qtyMinus = document.getElementById('qtyMinus');
    const qtyPlus = document.getElementById('qtyPlus');
    const qtyInput = document.getElementById('qtyInput');

    if (qtyMinus && qtyPlus && qtyInput) {
      qtyMinus.addEventListener('click', () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val > 1) {
          qtyInput.value = val - 1;
          this.calculateProductPrice();
        }
      });

      qtyPlus.addEventListener('click', () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val < 50) {
          qtyInput.value = val + 1;
          this.calculateProductPrice();
        }
      });
    }

    // Custom Name Input Live Sync with SVG
    const customNameInput = document.getElementById('customNameInput');
    if (customNameInput) {
      customNameInput.addEventListener('input', (e) => {
        const text = e.target.value.trim();
        const badge = document.getElementById('svgCustomNameText');
        if (badge) {
          badge.textContent = text ? `ปักชื่อ: ${text}` : '';
          badge.style.display = text ? 'block' : 'none';
        }
        this.calculateProductPrice();
      });
    }

    // Add to Cart Button
    const addToCartBtn = document.getElementById('addToCartBtn');
    if (addToCartBtn) {
      addToCartBtn.addEventListener('click', () => {
        const qty = parseInt(document.getElementById('qtyInput').value) || 1;
        const customName = document.getElementById('customNameInput').value.trim();
        const studentId = document.getElementById('orderStudentIdInput').value.trim();

        if (!studentId && authApp && !authApp.currentUser) {
          showToast('กรุณากรอกรหัสนักศึกษา หรือ เข้าสู่ระบบก่อนสั่งซื้อ', 'error');
          document.getElementById('orderStudentIdInput').focus();
          return;
        }

        const prod = this.products[this.selectedProduct];
        const pricePerUnit = this.getUnitPrice(this.selectedSize, customName);

        const cartItem = {
          id: Date.now(),
          productKey: this.selectedProduct,
          title: prod.title,
          size: this.selectedSize,
          qty: qty,
          customName: customName,
          price: pricePerUnit,
          totalPrice: pricePerUnit * qty
        };

        this.cart.push(cartItem);
        this.saveCart();
        showToast(`เพิ่ม ${prod.title} ลงในตะกร้าเรียบร้อยแล้ว!`, 'success');
        this.openCartDrawer();
      });
    }
  }

  getUnitPrice(size, customName) {
    const prod = this.products[this.selectedProduct] || this.products['polo'];
    let price = prod.basePrice;
    if (['3XL', '4XL', '5XL', '6XL', '7XL', '8XL'].includes(size)) {
      price += prod.largeFee; // +10 for polo, +100 for jacket
    }
    if (customName) {
      price += this.customEmbroideryFee; // +30 Baht
    }
    return price;
  }

  calculateProductPrice() {
    const qty = parseInt(document.getElementById('qtyInput').value) || 1;
    const customName = document.getElementById('customNameInput') ? document.getElementById('customNameInput').value.trim() : '';
    const unitPrice = this.getUnitPrice(this.selectedSize, customName);
    const total = unitPrice * qty;

    const priceDisplay = document.getElementById('productPriceDisplay');
    if (priceDisplay) {
      priceDisplay.textContent = `฿${total.toLocaleString()}`;
    }
  }

  /* CART DRAWER & MANAGEMENT */
  bindCartDrawerEvents() {
    const cartBtn = document.getElementById('cartBtn');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const drawerBackdrop = document.getElementById('drawerBackdrop');
    const checkoutCartBtn = document.getElementById('checkoutCartBtn');

    if (cartBtn) cartBtn.addEventListener('click', () => this.openCartDrawer());
    if (closeCartBtn) closeCartBtn.addEventListener('click', () => this.closeCartDrawer());
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', () => this.closeCartDrawer());

    if (checkoutCartBtn) {
      checkoutCartBtn.addEventListener('click', () => {
        if (this.cart.length === 0) {
          showToast('ตะกร้าสินค้าว่างเปล่า', 'error');
          return;
        }
        this.closeCartDrawer();
        this.openCheckoutModal();
      });
    }
  }

  openCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('drawerBackdrop');
    if (drawer && backdrop) {
      drawer.classList.add('show');
      backdrop.classList.add('show');
    }
  }

  closeCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('drawerBackdrop');
    if (drawer && backdrop) {
      drawer.classList.remove('show');
      backdrop.classList.remove('show');
    }
  }

  updateCartUI() {
    const badge = document.getElementById('cartBadge');
    const list = document.getElementById('cartItemsList');
    const subtotalEl = document.getElementById('cartSubtotal');
    const grandTotalEl = document.getElementById('cartGrandTotal');

    const totalQty = this.cart.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = this.cart.reduce((sum, item) => sum + item.totalPrice, 0);

    if (badge) badge.textContent = totalQty;

    if (list) {
      if (this.cart.length === 0) {
        list.innerHTML = `<div class="empty-cart-msg">ยังไม่มีสินค้าในตะกร้า</div>`;
      } else {
        list.innerHTML = this.cart.map(item => `
          <div class="cart-item">
            <div class="cart-item-img">
              <img src="assets/logo.png" alt="CPE Logo" style="width:100%; height:100%; object-fit:contain; border-radius:4px; padding:2px;">
            </div>
            <div class="cart-item-details">
              <div class="cart-item-title">${item.title}</div>
              <div class="cart-item-meta">ไซส์: <strong>${item.size}</strong> | จำนวน: ${item.qty} ตัว</div>
              ${item.customName ? `<div class="cart-item-meta" style="color:#D4AF37">ปักชื่อ: ${item.customName}</div>` : ''}
              <div class="cart-item-price">฿${item.totalPrice.toLocaleString()}</div>
            </div>
            <button class="cart-item-remove" onclick="app.removeCartItem(${item.id})">&times;</button>
          </div>
        `).join('');
      }
    }

    if (subtotalEl) subtotalEl.textContent = `฿${totalPrice.toLocaleString()}`;
    if (grandTotalEl) grandTotalEl.textContent = `฿${totalPrice.toLocaleString()}`;
  }

  removeCartItem(id) {
    this.cart = this.cart.filter(item => item.id !== id);
    this.saveCart();
    showToast('ลบรายการสินค้าแล้ว', 'info');
  }

  /* CHECKOUT & PROMPTPAY MODAL */
  openCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (!modal) return;

    const total = this.cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const amountDisplay = document.getElementById('checkoutTotalAmount');
    if (amountDisplay) amountDisplay.textContent = `฿${total.toLocaleString()}`;

    // Auto fill user details if logged in
    if (authApp && authApp.currentUser) {
      const u = authApp.currentUser;
      const nameInput = document.getElementById('checkoutName');
      const studentIdInput = document.getElementById('checkoutStudentId');
      const phoneInput = document.getElementById('checkoutPhone');

      if (nameInput) nameInput.value = u.name;
      if (studentIdInput) studentIdInput.value = u.studentId;
      if (phoneInput) phoneInput.value = u.phone || '';
    }

    // Render PromptPay QR image (using static generated visual PromptPay QR mockup canvas/svg)
    this.generatePromptPayQR(total);

    modal.classList.add('show');
  }

  generatePromptPayQR(amount) {
    const qrContainer = document.getElementById('qrCodeWrapper');
    if (!qrContainer) return;

    // Create custom styled PromptPay SVG QR code
    qrContainer.innerHTML = `
      <div style="background:#fff; padding:15px; border-radius:12px; border:2px solid #8B0C1A; display:inline-block">
        <div style="background:#003B71; color:#fff; padding:6px 12px; font-weight:bold; font-size:12px; border-radius:4px; margin-bottom:10px;">
          PromptPay | พร้อมเพย์ CPE PSRU
        </div>
        <svg viewBox="0 0 160 160" width="180" height="180">
          <!-- QR Corners -->
          <rect x="10" y="10" width="40" height="40" fill="#000"/>
          <rect x="16" y="16" width="28" height="28" fill="#fff"/>
          <rect x="22" y="22" width="16" height="16" fill="#8B0C1A"/>

          <rect x="110" y="10" width="40" height="40" fill="#000"/>
          <rect x="116" y="16" width="28" height="28" fill="#fff"/>
          <rect x="122" y="22" width="16" height="16" fill="#8B0C1A"/>

          <rect x="10" y="110" width="40" height="40" fill="#000"/>
          <rect x="16" y="116" width="28" height="28" fill="#fff"/>
          <rect x="22" y="122" width="16" height="16" fill="#8B0C1A"/>

          <!-- Random QR Grid Pattern -->
          <rect x="60" y="15" width="10" height="25" fill="#000"/>
          <rect x="80" y="20" width="20" height="10" fill="#8B0C1A"/>
          <rect x="15" y="60" width="25" height="10" fill="#000"/>
          <rect x="60" y="60" width="40" height="40" fill="#8B0C1A"/>
          <rect x="70" y="70" width="20" height="20" fill="#fff"/>
          <circle cx="80" cy="80" r="6" fill="#D4AF37"/>
          <rect x="115" y="60" width="20" height="30" fill="#000"/>
          <rect x="60" y="115" width="30" height="20" fill="#000"/>
          <rect x="105" y="110" width="40" height="15" fill="#8B0C1A"/>
          <rect x="125" y="130" width="20" height="20" fill="#000"/>
        </svg>
        <div style="color:#000; font-weight:bold; font-size:14px; margin-top:8px;">
          จำนวนเงิน: <span style="color:#8B0C1A">฿${amount.toLocaleString()}</span>
        </div>
        <div style="color:#64748B; font-size:11px;">บัญชี: สาขาวิชาวิศวกรรมคอมพิวเตอร์ มรพ.พิบูลสงคราม</div>
      </div>
    `;
  }

  bindCheckoutEvents() {
    const closeCheckoutBtn = document.getElementById('closeCheckoutBtn');
    const checkoutModal = document.getElementById('checkoutModal');
    const checkoutForm = document.getElementById('checkoutForm');
    const slipFileInput = document.getElementById('slipFileInput');
    const slipPreviewContainer = document.getElementById('slipPreviewContainer');

    if (closeCheckoutBtn && checkoutModal) {
      closeCheckoutBtn.addEventListener('click', () => checkoutModal.classList.remove('show'));
    }

    if (slipFileInput) {
      slipFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && slipPreviewContainer) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            slipPreviewContainer.innerHTML = `
              <div style="margin-top:10px; text-align:center">
                <img src="${evt.target.result}" style="max-height:160px; border-radius:8px; border:1px solid var(--accent-gold)"/>
                <div style="font-size:0.8rem; color:#22c55e; margin-top:4px">✓ อัปโหลดสลิปเรียบร้อยแล้ว</div>
              </div>
            `;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (checkoutForm) {
      checkoutForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('checkoutName').value.trim();
        const studentId = document.getElementById('checkoutStudentId').value.trim();
        const phone = document.getElementById('checkoutPhone').value.trim();
        const deliveryMethod = document.getElementById('checkoutDelivery').value;

        if (!name || !studentId || !phone) {
          showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
          return;
        }

        const total = this.cart.reduce((sum, item) => sum + item.totalPrice, 0);
        const orderId = 'CPE-2026-' + Math.floor(1000 + Math.random() * 9000);

        const newOrder = {
          id: orderId,
          studentId: studentId,
          name: name,
          phone: phone,
          deliveryMethod: deliveryMethod,
          items: [...this.cart],
          total: total,
          status: 'paid', // paid, preparing, shipping, completed
          date: new Date().toLocaleString('th-TH'),
          trackingNumber: 'TH68' + Math.floor(100000000 + Math.random() * 900000000)
        };

        // Save order to LocalStorage
        const savedOrders = JSON.parse(localStorage.getItem(this.ordersKey) || '[]');
        savedOrders.unshift(newOrder);
        localStorage.setItem(this.ordersKey, JSON.stringify(savedOrders));

        // Clear cart
        this.cart = [];
        this.saveCart();

        // Close checkout modal
        checkoutModal.classList.remove('show');

        // Show Success Alert Modal / Notification
        showToast(`แจ้งชำระเงินสำเร็จ! หมายเลขออเดอร์ของคุณคือ ${orderId}`, 'success');
        
        // Auto display order in tracker
        this.displayTrackingResult(newOrder);
      });
    }
  }

  /* ORDER TRACKING SYSTEM */
  bindTrackingEvents() {
    const searchBtn = document.getElementById('searchTrackingBtn');
    const input = document.getElementById('trackingSearchInput');

    if (searchBtn && input) {
      const handleSearch = () => {
        const query = input.value.trim();
        if (!query) {
          showToast('กรุณากรอกเลขที่ออเดอร์ หรือ รหัสนักศึกษา', 'error');
          return;
        }

        const orders = JSON.parse(localStorage.getItem(this.ordersKey) || '[]');
        const found = orders.find(o => o.id.toLowerCase() === query.toLowerCase() || o.studentId === query);

        if (found) {
          this.displayTrackingResult(found);
          showToast('พบข้อมูลออเดอร์แล้ว!', 'success');
        } else {
          showToast('ไม่พบข้อมูลการสั่งซื้อ กรุณาตรวจสอบอีกครั้ง', 'error');
        }
      };

      searchBtn.addEventListener('click', handleSearch);
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
      });
    }
  }

  displayTrackingResult(order) {
    const resultBox = document.getElementById('trackingResultBox');
    if (!resultBox) return;

    const statusMap = {
      pending: { step: 1, label: 'รอชำระเงิน' },
      paid: { step: 2, label: 'ชำระเงินแล้ว (ยืนยันสลิป)' },
      preparing: { step: 3, label: 'กำลังจัดเตรียม/ปักเสื้อ' },
      shipping: { step: 4, label: 'จัดส่งแล้ว / พร้อมรับที่สาขา' }
    };

    const currentStep = statusMap[order.status] ? statusMap[order.status].step : 2;
    const progressPercent = ((currentStep - 1) / 3) * 100;

    resultBox.innerHTML = `
      <div style="background:rgba(255,255,255,0.03); padding:20px; border-radius:12px; border:1px solid var(--border-gold)">
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:15px">
          <div>
            <h4 style="color:#fff; font-size:1.1rem">หมายเลขออเดอร์: <span style="color:var(--accent-gold)">${order.id}</span></h4>
            <p style="color:var(--text-muted); font-size:0.85rem">ผู้สั่ง: ${order.name} (${order.studentId})</p>
          </div>
          <div style="text-align:right">
            <span class="tech-pill">${statusMap[order.status].label}</span>
            <p style="color:var(--text-muted); font-size:0.8rem; margin-top:4px">วันที่สั่งซื้อ: ${order.date}</p>
          </div>
        </div>

        <!-- Stepper Progress Bar -->
        <div class="stepper">
          <div class="stepper-progress" style="width: ${progressPercent}%"></div>
          
          <div class="step-item ${currentStep >= 1 ? 'completed' : ''}">
            <div class="step-node">1</div>
            <div class="step-label">สั่งซื้อสำเร็จ</div>
          </div>
          <div class="step-item ${currentStep >= 2 ? (currentStep === 2 ? 'current' : 'completed') : ''}">
            <div class="step-node">2</div>
            <div class="step-label">ยืนยันชำระเงิน</div>
          </div>
          <div class="step-item ${currentStep >= 3 ? (currentStep === 3 ? 'current' : 'completed') : ''}">
            <div class="step-node">3</div>
            <div class="step-label">ผลิต/ปักเสื้อ</div>
          </div>
          <div class="step-item ${currentStep >= 4 ? 'current completed' : ''}">
            <div class="step-node">4</div>
            <div class="step-label">จัดส่ง/รับเสื้อ</div>
          </div>
        </div>

        ${order.trackingNumber ? `
          <div style="background:rgba(139,12,26,0.2); padding:10px 14px; border-radius:6px; font-size:0.85rem; color:#fff; display:flex; justify-content:space-between; margin-top:15px">
            <span>เลขพัสดุจัดส่ง (Express Tracking):</span>
            <strong style="color:var(--accent-gold-bright)">${order.trackingNumber}</strong>
          </div>
        ` : ''}

        <div style="margin-top:15px; border-top:1px dashed rgba(255,255,255,0.1); padding-top:12px; font-size:0.85rem; color:var(--text-sub)">
          <strong>รายการสินค้า:</strong> ${order.items.map(i => `${i.title} (${i.size}) x${i.qty}`).join(', ')}
          <br/><strong>ยอดชำระสุทธิ:</strong> ฿${order.total.toLocaleString()}
        </div>
      </div>
    `;

    resultBox.classList.add('active');
    resultBox.scrollIntoView({ behavior: 'smooth' });
  }

  /* SIZE GUIDE MODAL */
  bindModalEvents() {
    const sizeGuideBtn = document.getElementById('sizeGuideBtn');
    const sizeGuideModal = document.getElementById('sizeGuideModal');
    const closeSizeGuideBtn = document.getElementById('closeSizeGuideBtn');

    if (sizeGuideBtn && sizeGuideModal) {
      sizeGuideBtn.addEventListener('click', () => sizeGuideModal.classList.add('show'));
    }

    if (closeSizeGuideBtn && sizeGuideModal) {
      closeSizeGuideBtn.addEventListener('click', () => sizeGuideModal.classList.remove('show'));
    }
  }
}

// Global App Instance
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new CPEPoloApp();
});
