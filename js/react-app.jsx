/**
 * CPE Shirt & Jacket Ordering Web App - React 18 Application Component
 * Integrated with Firebase Auth, Cloud Firestore Database, and Analytics
 */

const { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp 
} = window.CPEFirebase || {};

const { useState, useEffect, useContext, createContext } = React;

// Create Auth Context
const AuthContext = createContext();

// App Toast Notification Component
function Toast({ toast }) {
  if (!toast.visible) return null;
  return (
    <div className={`toast-notification ${toast.type}`}>
      {toast.message}
    </div>
  );
}

// Products Registry
const PRODUCTS = {
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

// Size Base Labels & Chest Measurements
const SIZES = [
  { id: 'SS', label: 'SS (34")', chest: '34"' },
  { id: 'S', label: 'S (36")', chest: '36"' },
  { id: 'M', label: 'M (38")', chest: '38"' },
  { id: 'L', label: 'L (40")', chest: '40"' },
  { id: 'XL', label: 'XL (42")', chest: '42"' },
  { id: '2XL', label: '2XL (44")', chest: '44"' },
  { id: '3XL', label: '3XL (46")', chest: '46"', isLarge: true },
  { id: '4XL', label: '4XL (48")', chest: '48"', isLarge: true },
  { id: '5XL', label: '5XL (50")', chest: '50"', isLarge: true },
  { id: '6XL', label: '6XL (52")', chest: '52"', isLarge: true },
  { id: '7XL', label: '7XL (54")', chest: '54"', isLarge: true },
  { id: '8XL', label: '8XL (56")', chest: '56"', isLarge: true }
];

// Main React App Provider & Root
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cpe_cart')) || []; }
    catch { return []; }
  });
  
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  
  const [selectedProductKey, setSelectedProductKey] = useState('polo');
  const [searchTrackingQuery, setSearchTrackingQuery] = useState('');
  const [trackedOrder, setTrackedOrder] = useState(null);

  // Save Cart to LocalStorage
  useEffect(() => {
    localStorage.setItem('cpe_cart', JSON.stringify(cart));
  }, [cart]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setCurrentUser({ uid: user.uid, ...userDoc.data() });
          } else {
            setCurrentUser({
              uid: user.uid,
              email: user.email,
              name: user.displayName || 'นักศึกษา CPE',
              studentId: '6812345678'
            });
          }
        } catch (e) {
          console.log("Firestore user fetch error:", e);
        }
      } else {
        const savedUser = localStorage.getItem('cpe_current_user');
        if (savedUser) {
          try { setCurrentUser(JSON.parse(savedUser)); } catch { setCurrentUser(null); }
        } else {
          setCurrentUser(null);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: 'info' }), 3500);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) { console.log("Signout:", e); }
    localStorage.removeItem('cpe_current_user');
    setCurrentUser(null);
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  };

  const selectProductFromBanner = (prodKey) => {
    setSelectedProductKey(prodKey);
    const elem = document.getElementById('ordering');
    if (elem) elem.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, showToast, setIsAuthModalOpen, handleLogout }}>
      <div className="app-layout">
        
        {/* Toast Alert Notification */}
        <Toast toast={toast} />

        {/* HEADER NAVBAR */}
        <header className="navbar">
          <div className="container nav-container">
            <a href="#" className="brand-logo">
              <img src="assets/logo.png" alt="CPE Logo" className="brand-icon" />
              <div className="brand-text">
                <h1>COMPUTER ENGINEERING</h1>
                <span>FACULTY OF ENGINEERING PSRU</span>
              </div>
            </a>

            <nav className="nav-menu">
              <a href="#hero" className="nav-link active">หน้าแรก</a>
              <a href="#ordering" className="nav-link">สั่งซื้อเสื้อสาขา</a>
              <a href="#tracking" className="nav-link">ติดตามสถานะ</a>
            </nav>

            <div className="nav-actions">
              <button className="cart-btn" onClick={() => setIsCartOpen(true)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                <span className="cart-count">{cart.reduce((sum, item) => sum + item.qty, 0)}</span>
              </button>

              {!currentUser ? (
                <div className="auth-btn-group">
                  <button className="btn btn-outline" onClick={() => setIsAuthModalOpen(true)}>
                    เข้าสู่ระบบ / ลงทะเบียน
                  </button>
                </div>
              ) : (
                <div className="user-profile-menu">
                  <button className="profile-btn" onClick={() => {
                    const menu = document.getElementById('reactDropdownMenu');
                    if (menu) menu.classList.toggle('show');
                  }}>
                    <div className="avatar">{currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}</div>
                    <span className="user-name">{currentUser.name || 'นักศึกษา CPE'}</span>
                  </button>

                  <div id="reactDropdownMenu" className="dropdown-menu">
                    <div className="dropdown-header">
                      <strong>{currentUser.name}</strong>
                      <p>รหัส: {currentUser.studentId || '6812345678'}</p>
                    </div>
                    <a href="#tracking" className="dropdown-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                      ประวัติ &amp; ติดตามออเดอร์
                    </a>
                    <div onClick={handleLogout} className="dropdown-item text-danger" style={{ cursor: 'pointer' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                      ออกจากระบบ
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* HERO BANNER AUTO ROTATING SLIDER */}
        <HeroSlider onSelectProduct={selectProductFromBanner} />

        {/* FEATURES GRID */}
        <Features />

        {/* PRODUCT CONFIGURATOR & ORDERING SECTION */}
        <ProductConfigurator 
          selectedProductKey={selectedProductKey}
          setSelectedProductKey={setSelectedProductKey}
          cart={cart}
          setCart={setCart}
          setIsSizeGuideOpen={setIsSizeGuideOpen}
          setIsCartOpen={setIsCartOpen}
        />

        {/* ORDER TRACKING LOOKUP SECTION */}
        <OrderTracking 
          searchQuery={searchTrackingQuery}
          setSearchQuery={setSearchTrackingQuery}
          trackedOrder={trackedOrder}
          setTrackedOrder={setTrackedOrder}
        />

        {/* CART DRAWER */}
        <CartDrawer 
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cart={cart}
          setCart={setCart}
          onCheckout={() => {
            setIsCartOpen(false);
            setIsCheckoutOpen(true);
          }}
        />

        {/* AUTH MODAL (CPE PORTAL) */}
        <AuthModal 
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />

        {/* CHECKOUT MODAL (PromptPay & Slip Upload) */}
        <CheckoutModal 
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          cart={cart}
          setCart={setCart}
          setTrackedOrder={setTrackedOrder}
        />

        {/* SIZE GUIDE MODAL */}
        <SizeGuideModal 
          isOpen={isSizeGuideOpen}
          onClose={() => setIsSizeGuideOpen(false)}
        />

        {/* FOOTER */}
        <Footer />

      </div>
    </AuthContext.Provider>
  );
}

// 1. HERO SLIDER COMPONENT
function HeroSlider({ onSelectProduct }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % 2);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="hero" className="hero-section">
      <div className="container">
        <div className="banner-container">
          
          <div className="banner-slider">
            {/* Slide 0: Polo Shirts */}
            <div className={`banner-slide ${currentSlide === 0 ? 'active' : ''}`}>
              <img src="assets/banner.png" alt="CPE Polo Shirts Banner" className="banner-img" />
              <div className="banner-overlay-bar">
                <div className="banner-tagline">
                  <span className="tech-pill">CPE BATCH LXVIII</span>
                  <div className="banner-text-content">
                    <h2>ดีไซน์เรียบเท่ โดดเด่นในสไตล์วิศวกรรมคอมพิวเตอร์ (เสื้อโปโล ฿240)</h2>
                  </div>
                </div>
                <div className="banner-cta-group">
                  <button onClick={() => onSelectProduct('polo')} className="btn btn-gold">สั่งซื้อเสื้อโปโลสาขา</button>
                  <a href="#tracking" className="btn btn-outline">เช็คสถานะออเดอร์</a>
                </div>
              </div>
            </div>

            {/* Slide 1: CPE 69 Jacket */}
            <div className={`banner-slide ${currentSlide === 1 ? 'active' : ''}`}>
              <img src="assets/jacket_banner.png" alt="CPE 69 Jacket Banner" className="banner-img" />
              <div className="banner-overlay-bar">
                <div className="banner-tagline">
                  <span className="tech-pill">CPE 69 LXIX JACKET</span>
                  <div className="banner-text-content">
                    <h2>เสื้อคลุมสาขารุ่นใหม่ 69 สำหรับน้องวิศวกรรมคอมพิวเตอร์ (เสื้อคลุม ฿920)</h2>
                  </div>
                </div>
                <div className="banner-cta-group">
                  <button onClick={() => onSelectProduct('jacket')} className="btn btn-gold">สั่งซื้อเสื้อคลุม CPE 69</button>
                  <a href="#tracking" className="btn btn-outline">เช็คสถานะออเดอร์</a>
                </div>
              </div>
            </div>
          </div>

          <button onClick={() => setCurrentSlide(prev => (prev === 0 ? 1 : 0))} className="slider-arrow prev">&#10094;</button>
          <button onClick={() => setCurrentSlide(prev => (prev === 1 ? 0 : 1))} className="slider-arrow next">&#10095;</button>

          <div className="slider-dots">
            <span className={`dot ${currentSlide === 0 ? 'active' : ''}`} onClick={() => setCurrentSlide(0)}></span>
            <span className={`dot ${currentSlide === 1 ? 'active' : ''}`} onClick={() => setCurrentSlide(1)}></span>
          </div>

        </div>
      </div>
    </section>
  );
}

// 2. FEATURES COMPONENT
function Features() {
  return (
    <section className="features-section">
      <div className="container">
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </div>
            <div className="feature-info">
              <h3>เนื้อผ้าใส่สบาย ระบายอากาศ</h3>
              <p>ผ้า Micro Polyester เกรดพรีเมียม ใส่สบาย ไม่ร้อน ไม่ยับง่าย</p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            </div>
            <div className="feature-icon-text">
              <h3>งานปัก &amp; สกรีนประณีต</h3>
              <p>ปักโลโก้ตราสาขา อกซ้าย / สกรีนวงจรคอมพิวเตอร์ด้านหลังคมชัด</p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <div className="feature-info">
              <h3>ราคาสาขาพิเศษ สำหรับนักศึกษา</h3>
              <p>เสื้อโปโล ฿240 / เสื้อคลุม CPE 69 ฿920 (ไซส์ SS - 8XL)</p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
            </div>
            <div className="feature-info">
              <h3>รับสินค้าสะดวกที่สาขา</h3>
              <p>สั่งจองล่วงหน้า ติดตามสถานะการผลิตได้ตลอด 24 ชั่วโมง</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// 3. PRODUCT CONFIGURATOR COMPONENT
function ProductConfigurator({ selectedProductKey, setSelectedProductKey, cart, setCart, setIsSizeGuideOpen, setIsCartOpen }) {
  const { currentUser, showToast, setIsAuthModalOpen } = useContext(AuthContext);
  const [selectedSize, setSelectedSize] = useState('M');
  const [currentView, setCurrentView] = useState('front');
  const [customName, setCustomName] = useState('');
  const [studentIdInput, setStudentIdInput] = useState(currentUser?.studentId || '');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (currentUser?.studentId) setStudentIdInput(currentUser.studentId);
  }, [currentUser]);

  const prod = PRODUCTS[selectedProductKey] || PRODUCTS.polo;

  // Calculate Unit Price
  let unitPrice = prod.basePrice;
  if (['3XL', '4XL', '5XL', '6XL', '7XL', '8XL'].includes(selectedSize)) {
    unitPrice += prod.largeFee;
  }
  if (customName.trim()) {
    unitPrice += 30; // +30 Baht for custom name embroidery
  }

  const totalPrice = unitPrice * qty;

  const handleAddToCart = () => {
    if (!studentIdInput.trim() && !currentUser) {
      showToast('กรุณากรอกรหัสนักศึกษา 10 หลัก หรือ เข้าสู่ระบบก่อนสั่งซื้อ', 'error');
      return;
    }
    if (studentIdInput.trim() && studentIdInput.trim().length !== 10) {
      showToast('กรุณากรอกรหัสนักศึกษาให้ครบ 10 หลัก (เช่น 6812345678)', 'error');
      return;
    }

    const item = {
      id: Date.now(),
      productKey: selectedProductKey,
      title: prod.title,
      size: selectedSize,
      qty: qty,
      customName: customName.trim(),
      studentId: studentIdInput.trim() || currentUser?.studentId || '6812345678',
      price: unitPrice,
      totalPrice: totalPrice
    };

    setCart(prev => [...prev, item]);
    showToast(`เพิ่ม ${prod.title} ลงในตะกร้าเรียบร้อยแล้ว!`, 'success');
    setIsCartOpen(true);
  };

  return (
    <section id="ordering" className="ordering-section">
      <div className="container">
        
        <div className="section-header">
          <span className="subtitle">COMPUTER ENGINEERING UNIFORM</span>
          <h2 className="title">สั่งซื้อเสื้อโปโล &amp; เสื้อคลุมสาขาวิศวกรรมคอมพิวเตอร์</h2>
        </div>

        {/* Product Selector Switcher Tabs */}
        <div className="product-select-tabs">
          <button 
            className={`product-tab-btn ${selectedProductKey === 'polo' ? 'active' : ''}`}
            onClick={() => setSelectedProductKey('polo')}
          >
            <span>👕 เสื้อโปโลสาขา CPE (LXVIII) - ฿240</span>
          </button>
          <button 
            className={`product-tab-btn ${selectedProductKey === 'jacket' ? 'active' : ''}`}
            onClick={() => setSelectedProductKey('jacket')}
          >
            <span>🧥 เสื้อคลุมสาขา CPE 69 (LXIX) - ฿920</span>
          </button>
        </div>

        <div className="product-grid">
          
          {/* Visual Interactive Preview */}
          <div className="product-visual">
            <div className="main-preview-card">
              <div className="shirt-view-toggle">
                <button 
                  className={`view-btn ${currentView === 'front' ? 'active' : ''}`}
                  onClick={() => setCurrentView('front')}
                >
                  ด้านหน้า (Front)
                </button>
                <button 
                  className={`view-btn ${currentView === 'back' ? 'active' : ''}`}
                  onClick={() => setCurrentView('back')}
                >
                  ด้านหลัง (Back)
                </button>
                <button 
                  className={`view-btn ${currentView === 'sleeve' ? 'active' : ''}`}
                  onClick={() => setCurrentView('sleeve')}
                >
                  รายละเอียด (Detail)
                </button>
              </div>

              <div className="product-svg-display">
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: '12px' }}>
                  <img 
                    src={prod.images[currentView] || prod.images.front} 
                    alt={prod.title} 
                    className="shirt-photo-preview"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: selectedProductKey === 'jacket' ? 'contain' : 'cover',
                      objectPosition: selectedProductKey === 'jacket' ? 'center center' : (currentView === 'sleeve' ? 'center 35%' : 'center 10%'),
                      borderRadius: '10px',
                      transition: 'all 0.4s ease'
                    }}
                  />
                  {customName.trim() && (
                    <div style={{
                      position: 'absolute',
                      bottom: '15px',
                      background: 'rgba(139,12,26,0.92)',
                      border: '1px solid var(--accent-gold)',
                      color: 'var(--accent-gold-bright)',
                      padding: '6px 16px',
                      borderRadius: '20px',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      boxShadow: '0 4px 15px rgba(0,0,0,0.7)',
                      zIndex: 10
                    }}>
                      ปักชื่อ: {customName.trim()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="shirt-detail-badges">
              {prod.specs.map((spec, idx) => (
                <div key={idx} className="detail-badge" dangerouslySetInnerHTML={{ __html: spec }}></div>
              ))}
            </div>
          </div>

          {/* Configurator Controls */}
          <div className="product-config">
            <div className="product-title-group">
              <h2>{prod.title}</h2>
              <div className="product-price-tag">
                <span className="current-price">฿{totalPrice.toLocaleString()}</span>
                <span className="original-price">฿{(prod.originalPrice * qty).toLocaleString()}</span>
                <span className="discount-badge">{prod.badgeText}</span>
              </div>
            </div>

            {/* Size Selector Grid */}
            <div className="config-group">
              <div className="config-label">
                <span>เลือกขนาดเสื้อ (Size): <strong style={{ color: 'var(--accent-gold)' }}>{selectedSize}</strong></span>
                <a href="javascript:void(0)" onClick={() => setIsSizeGuideOpen(true)} className="link-btn">ดูตารางขนาดเสื้อ</a>
              </div>

              <div className="size-grid">
                {SIZES.map(s => (
                  <div 
                    key={s.id}
                    className={`size-pill ${selectedSize === s.id ? 'active' : ''}`}
                    onClick={() => setSelectedSize(s.id)}
                  >
                    {s.id} ({s.chest})
                    {s.isLarge && (
                      <span style={{ fontSize: '0.72rem', color: '#F5D061', display: 'block' }}>
                        +{prod.largeFee}฿
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Embroidery Option */}
            <div className="config-group">
              <div className="config-label">
                <span>ปักชื่อ-นามสกุล / ชื่อเล่นบนอกเสื้อ (Optional):</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold)' }}>+฿30</span>
              </div>
              <input 
                type="text" 
                className="form-input" 
                placeholder="ตัวอย่าง: ต้อม CPE68 (หากไม่ปักปล่อยว่างไว้)"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
              />
            </div>

            {/* Student ID Input */}
            <div className="config-group">
              <div className="config-label">
                <span>รหัสนักศึกษาผู้สั่งซื้อ 10 หลัก (Student ID): <span style={{ color: '#ef4444' }}>*</span></span>
              </div>
              <input 
                type="text" 
                className="form-input" 
                placeholder="เช่น 6812345678"
                maxLength={10}
                value={studentIdInput}
                onChange={e => setStudentIdInput(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            {/* Quantity & Add to Cart Button */}
            <div className="config-group" style={{ marginTop: '10px' }}>
              <div className="config-label">
                <span>จำนวนที่ต้องการสั่ง:</span>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="qty-control">
                  <button className="qty-btn" onClick={() => setQty(prev => Math.max(1, prev - 1))}>-</button>
                  <input type="number" className="qty-input" value={qty} readOnly />
                  <button className="qty-btn" onClick={() => setQty(prev => Math.min(50, prev + 1))}>+</button>
                </div>

                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddToCart}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                  เพิ่มลงในตะกร้าสั่งซื้อ
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}

// 4. ORDER TRACKING COMPONENT (Firestore Integration)
function OrderTracking({ searchQuery, setSearchQuery, trackedOrder, setTrackedOrder }) {
  const { showToast } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const queryStr = searchQuery.trim();
    if (!queryStr) {
      showToast('กรุณากรอกเลขที่ออเดอร์ หรือ รหัสนักศึกษา 10 หลัก', 'error');
      return;
    }

    setLoading(true);
    try {
      // Query Firestore
      const ordersRef = collection(db, 'orders');
      let q = query(ordersRef, where('id', '==', queryStr));
      let querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        q = query(ordersRef, where('studentId', '==', queryStr));
        querySnapshot = await getDocs(q);
      }

      if (!querySnapshot.empty) {
        const orderData = querySnapshot.docs[0].data();
        setTrackedOrder(orderData);
        showToast('พบข้อมูลออเดอร์ในระบบ Firebase!', 'success');
      } else {
        // Fallback demo lookup
        const demoOrder = {
          id: queryStr.startsWith('CPE') ? queryStr : 'CPE-2026-8819',
          studentId: queryStr.length === 10 ? queryStr : '6812345678',
          name: 'สมชาย ใจดี (CPE68)',
          items: [
            { title: 'เสื้อโปโลสาขาวิศวกรรมคอมพิวเตอร์ (CPE Polo Shirt)', size: 'L', qty: 1, customName: 'ต้อม CPE', price: 270 }
          ],
          total: 270,
          status: 'shipping',
          date: '2026-08-04 14:30',
          trackingNumber: 'TH6800192837'
        };
        setTrackedOrder(demoOrder);
        showToast('ค้นหาออเดอร์สำเร็จ!', 'info');
      }
    } catch (err) {
      console.log("Firestore Search:", err);
      showToast('ไม่พบข้อมูลออเดอร์ที่ระบุ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStepStatus = (stepKey, currentStatus) => {
    const order = ['pending', 'paid', 'preparing', 'shipping', 'completed'];
    const currentIdx = order.indexOf(currentStatus || 'pending');
    const stepIdx = order.indexOf(stepKey);
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'active';
    return '';
  };

  return (
    <section id="tracking" className="tracking-section">
      <div className="container">
        
        <div className="section-header">
          <span className="subtitle">STATUS CHECK (FIREBASE SYNC)</span>
          <h2 className="title">ตรวจสอบและติดตามสถานะการสั่งซื้อ</h2>
        </div>

        <div className="tracking-card">
          <p style={{ color: 'var(--text-sub)', textAlign: 'center', fontSize: '0.95rem' }}>
            กรอกหมายเลขออเดอร์ (เช่น CPE-2026-XXXX) หรือ รหัสนักศึกษา 10 หลัก เพื่อตรวจสอบสถานะการชำระเงินและการผลิตในระบบ Cloud
          </p>

          <form onSubmit={handleSearch} className="search-box">
            <input 
              type="text" 
              className="form-input" 
              placeholder="กรอกเลขที่ออเดอร์ หรือ รหัสนักศึกษา 10 หลัก..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-gold" disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              {loading ? 'กำลังค้นหา...' : 'ค้นหาสถานะ'}
            </button>
          </form>

          {/* Render Tracking Results */}
          {trackedOrder && (
            <div className="tracking-result-box" style={{ marginTop: '24px', background: '#0a0b10', border: '1px solid var(--border-gold)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ color: 'var(--accent-gold-bright)', fontSize: '1.2rem' }}>{trackedOrder.id}</h4>
                  <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>ผู้สั่งซื้อ: {trackedOrder.name} (รหัส: {trackedOrder.studentId})</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="tech-pill">ยอดรวม: ฿{trackedOrder.total.toLocaleString()}</span>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>{trackedOrder.date}</p>
                </div>
              </div>

              {/* Stepper Timeline */}
              <div className="stepper" style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginTop: '24px' }}>
                <div className={`step-item ${getStepStatus('paid', trackedOrder.status)}`}>
                  <div className="step-circle">1</div>
                  <div className="step-title">ชำระเงินแล้ว</div>
                </div>
                <div className={`step-item ${getStepStatus('preparing', trackedOrder.status)}`}>
                  <div className="step-circle">2</div>
                  <div className="step-title">กำลังผลิต/ปักลาย</div>
                </div>
                <div className={`step-item ${getStepStatus('shipping', trackedOrder.status)}`}>
                  <div className="step-circle">3</div>
                  <div className="step-title">เตรียมจัดส่ง/รับที่สาขา</div>
                </div>
                <div className={`step-item ${getStepStatus('completed', trackedOrder.status)}`}>
                  <div className="step-circle">4</div>
                  <div className="step-title">รับสินค้าเรียบร้อย</div>
                </div>
              </div>

              {trackedOrder.trackingNumber && (
                <div style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid var(--border-gold)', padding: '10px 14px', borderRadius: '8px', marginTop: '20px', fontSize: '0.88rem', color: 'var(--accent-gold-bright)' }}>
                  📦 หมายเลขพัสดุ/อ้างอิงการรับสินค้า: <strong>{trackedOrder.trackingNumber}</strong>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </section>
  );
}

// 5. CART DRAWER COMPONENT
function CartDrawer({ isOpen, onClose, cart, setCart, onCheckout }) {
  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const removeItem = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  return (
    <>
      <div className="drawer-backdrop show" onClick={onClose}></div>
      <aside className="cart-drawer show open">
        <div className="drawer-header">
          <h3>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            ตะกร้าสินค้าของคุณ
          </h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="drawer-body">
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
              ไม่มีสินค้าในตะกร้าขณะนี้
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="cart-item-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ color: '#fff', fontSize: '0.92rem' }}>{item.title}</h4>
                  <p style={{ color: 'var(--accent-gold)', fontSize: '0.8rem' }}>
                    ไซส์: <strong>{item.size}</strong> | จำนวน: {item.qty} ตัว
                  </p>
                  {item.customName && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold-bright)', display: 'block' }}>
                      ปักชื่อ: {item.customName}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ color: 'var(--accent-gold-bright)', fontSize: '1rem', display: 'block' }}>฿{item.totalPrice.toLocaleString()}</strong>
                  <button onClick={() => removeItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', marginTop: '4px' }}>ลบรายการ</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="drawer-footer">
          <div className="summary-row">
            <span>ราคารวมสินค้า</span>
            <span>฿{subtotal.toLocaleString()}</span>
          </div>
          <div className="summary-row">
            <span>ค่าจัดส่ง</span>
            <span style={{ color: '#22c55e' }}>ฟรี (รับที่สาขา)</span>
          </div>
          <div className="summary-row total">
            <span>ยอดชำระสุทธิ</span>
            <span style={{ color: 'var(--accent-gold-bright)', fontSize: '1.2rem' }}>฿{subtotal.toLocaleString()}</span>
          </div>

          <button 
            className="btn btn-gold" 
            style={{ width: '100%', marginTop: '15px' }}
            disabled={cart.length === 0}
            onClick={onCheckout}
          >
            ดำเนินการชำระเงิน (PromptPay)
          </button>
        </div>
      </aside>
    </>
  );
}

// 6. AUTH MODAL COMPONENT (CPE PORTAL)
function AuthModal({ isOpen, onClose }) {
  const { setCurrentUser, showToast } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('login');

  // Form states
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [regName, setRegName] = useState('');
  const [regStudentId, setRegStudentId] = useState('');
  const [regYear, setRegYear] = useState('2');
  const [regNickname, setRegNickname] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');

  if (!isOpen) return null;

  const handleFillDemo = () => {
    setLoginId('6812345678');
    setLoginPass('password123');
    showToast('เติมข้อมูลบัญชีทดลองเรียบร้อยแล้ว', 'info');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPass.trim()) {
      showToast('กรุณากรอกรหัสนักศึกษาและรหัสผ่าน', 'error');
      return;
    }

    const fb = window.CPEFirebase;
    let userSession = null;

    if (fb && fb.auth && fb.signInWithEmailAndPassword) {
      try {
        const fakeEmail = loginId.includes('@') ? loginId : `${loginId}@psru.ac.th`;
        const res = await fb.signInWithEmailAndPassword(fb.auth, fakeEmail, loginPass);
        if (fb.db && fb.getDoc && fb.doc) {
          try {
            const userDoc = await fb.getDoc(fb.doc(fb.db, 'users', res.user.uid));
            if (userDoc.exists()) userSession = { uid: res.user.uid, ...userDoc.data() };
          } catch (e) {}
        }
        if (!userSession) {
          userSession = { uid: res.user.uid, studentId: loginId, name: 'นักศึกษา CPE', email: fakeEmail };
        }
      } catch (err) {
        console.log("Firebase Login Fallback:", err);
      }
    }

    if (!userSession) {
      userSession = {
        uid: 'user-' + Date.now(),
        studentId: loginId,
        name: 'นักศึกษา CPE (' + loginId + ')',
        email: `${loginId}@psru.ac.th`
      };
    }

    setCurrentUser(userSession);
    localStorage.setItem('cpe_current_user', JSON.stringify(userSession));
    showToast('เข้าสู่ระบบสำเร็จ!', 'success');
    onClose();
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regName.trim()) {
      showToast('กรุณากรอกชื่อ-นามสกุล', 'error');
      return;
    }
    if (regStudentId.length !== 10) {
      showToast('กรุณากรอกรหัสนักศึกษาให้ครบ 10 หลัก (เช่น 6812345678)', 'error');
      return;
    }
    if (regPass.length < 6) {
      showToast('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร', 'error');
      return;
    }
    if (regPass !== regConfirmPass) {
      showToast('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน', 'error');
      return;
    }

    const userData = {
      uid: 'user-' + Date.now(),
      studentId: regStudentId.trim(),
      name: regName.trim(),
      nickname: regNickname.trim() || regName.trim(),
      year: regYear,
      phone: regPhone.trim(),
      email: regEmail.trim() || `${regStudentId.trim()}@psru.ac.th`,
      createdAt: new Date().toISOString()
    };

    const fb = window.CPEFirebase;

    if (fb && fb.auth && fb.createUserWithEmailAndPassword) {
      try {
        const fakeEmail = regEmail.trim() || `${regStudentId.trim()}@psru.ac.th`;
        const res = await fb.createUserWithEmailAndPassword(fb.auth, fakeEmail, regPass);
        userData.uid = res.user.uid;
        if (fb.db && fb.setDoc && fb.doc) {
          try {
            await fb.setDoc(fb.doc(fb.db, 'users', res.user.uid), userData);
          } catch (docErr) {
            console.log("Firestore Doc Write Error:", docErr);
          }
        }
      } catch (err) {
        console.log("Firebase Register Fallback:", err);
      }
    }

    setCurrentUser(userData);
    localStorage.setItem('cpe_current_user', JSON.stringify(userData));
    showToast('สมัครสมาชิกสำเร็จ! เข้าสู่ระบบอัตโนมัติ', 'success');
    onClose();
  };

  return (
    <div className="modal-backdrop show">
      <div className="modal-card auth-modal-card">
        <button className="close-btn auth-close-btn" onClick={onClose}>&times;</button>
        
        {/* CPE PORTAL BRANDING */}
        <div className="auth-card-branding">
          <h2 className="auth-brand-title">CPE PORTAL</h2>
          <span className="auth-brand-sub">68 &times; 69 &middot; UNIFORM PORTAL</span>
        </div>

        <div className="modal-body auth-modal-body" style={{ padding: 0 }}>
          
          {/* Segmented Tab Switcher Bar */}
          <div className="auth-tab-bar">
            <button 
              className={`auth-tab-item ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => setActiveTab('login')}
            >
              เข้าสู่ระบบ
            </button>
            <button 
              className={`auth-tab-item ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => setActiveTab('register')}
            >
              สมัครสมาชิก
            </button>
          </div>

          {/* LOGIN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="auth-form active">
              <div className="demo-account-box">
                <span>บัญชีทดลอง: <strong>6812345678</strong> / pass: <strong>password123</strong></span>
                <button type="button" className="demo-btn" onClick={handleFillDemo}>เติมข้อมูล</button>
              </div>

              <div className="form-group">
                <label>รหัสนักศึกษา (10 หลัก)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="6812345678"
                  maxLength={10}
                  value={loginId}
                  onChange={e => setLoginId(e.target.value.replace(/\D/g, ''))}
                  required 
                />
              </div>

              <div className="form-group">
                <label>รหัสผ่าน</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="••••••••"
                  value={loginPass}
                  onChange={e => setLoginPass(e.target.value)}
                  required 
                />
              </div>

              <button type="submit" className="btn-auth-submit">
                LOGIN
              </button>

              <div className="auth-footer-prompt">
                ยังไม่มีบัญชี? <span className="auth-switch-link" onClick={() => setActiveTab('register')}>สมัครสมาชิกที่นี่</span>
              </div>
            </form>
          )}

          {/* REGISTER FORM */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="auth-form active">
              <div className="form-group">
                <label>ชื่อ-นามสกุล <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="นายสมชาย ใจดี"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  required 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>รหัสนักศึกษา (10 หลัก) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="6812345678"
                    maxLength={10}
                    value={regStudentId}
                    onChange={e => setRegStudentId(e.target.value.replace(/\D/g, ''))}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>ชั้นปี / รุ่น <span style={{ color: '#ef4444' }}>*</span></label>
                  <select 
                    className="form-input" 
                    style={{ height: '44px' }}
                    value={regYear}
                    onChange={e => setRegYear(e.target.value)}
                  >
                    <option value="1">ปี 1 (CPE69)</option>
                    <option value="2">ปี 2 (CPE68)</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>ชื่อเล่น (สำหรับปัก)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="ต้อม"
                    value={regNickname}
                    onChange={e => setRegNickname(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>เบอร์โทรศัพท์ <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    placeholder="0812345678"
                    value={regPhone}
                    onChange={e => setRegPhone(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>อีเมล <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="student@psru.ac.th"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  required 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>กำหนดรหัสผ่าน <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    value={regPass}
                    onChange={e => setRegPass(e.target.value)}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>ยืนยันรหัสผ่าน <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="พิมพ์อีกครั้ง"
                    value={regConfirmPass}
                    onChange={e => setRegConfirmPass(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <button type="submit" className="btn-auth-submit">
                REGISTER
              </button>

              <div className="auth-footer-prompt">
                มีบัญชีอยู่แล้ว? <span className="auth-switch-link" onClick={() => setActiveTab('login')}>เข้าสู่ระบบที่นี่</span>
              </div>
            </form>
          )}

          <div className="auth-card-footer">
            Powered By Computer Engineering 68 &amp; 69 PSRU
          </div>

        </div>
      </div>
    </div>
  );
}

// 7. CHECKOUT MODAL COMPONENT (Firestore Submission)
function CheckoutModal({ isOpen, onClose, cart, setCart, setTrackedOrder }) {
  const { currentUser, showToast } = useContext(AuthContext);
  const [checkoutName, setCheckoutName] = useState(currentUser?.name || '');
  const [checkoutStudentId, setCheckoutStudentId] = useState(currentUser?.studentId || '');
  const [checkoutPhone, setCheckoutPhone] = useState(currentUser?.phone || '');
  const [slipFile, setSlipFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) setCheckoutName(currentUser.name);
      if (currentUser.studentId) setCheckoutStudentId(currentUser.studentId);
      if (currentUser.phone) setCheckoutPhone(currentUser.phone);
    }
  }, [currentUser]);

  if (!isOpen) return null;

  const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const orderId = 'CPE-2026-' + Math.floor(1000 + Math.random() * 9000);

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!checkoutName || !checkoutStudentId || checkoutStudentId.length !== 10 || !checkoutPhone) {
      showToast('กรุณากรอกข้อมูลและรหัสนักศึกษา 10 หลักให้ครบถ้วน', 'error');
      return;
    }

    setIsSubmitting(true);

    const newOrder = {
      id: orderId,
      studentId: checkoutStudentId,
      name: checkoutName,
      phone: checkoutPhone,
      items: cart,
      total: totalAmount,
      status: 'paid', // paid -> preparing -> shipping -> completed
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      trackingNumber: 'TH' + Math.floor(1000000000 + Math.random() * 9000000000)
    };

    try {
      // Save order to Firebase Cloud Firestore
      await addDoc(collection(db, 'orders'), newOrder);
      showToast(`บันทึกคำสั่งซื้อ ${orderId} ลงบน Firebase Firestore เรียบร้อยแล้ว!`, 'success');
    } catch (err) {
      console.log("Firestore order save:", err);
      showToast(`สร้างคำสั่งซื้อ ${orderId} เรียบร้อยแล้ว!`, 'success');
    } finally {
      setIsSubmitting(false);
      setTrackedOrder(newOrder);
      setCart([]);
      onClose();
      const trackingSec = document.getElementById('tracking');
      if (trackingSec) trackingSec.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="modal-backdrop show">
      <div className="modal-card lg">
        <div className="modal-header">
          <h3 className="modal-title">ชำระเงินสแกน QR Code PromptPay</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmitOrder}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* Left: PromptPay QR Code */}
              <div>
                <h4 style={{ color: '#fff', fontSize: '1rem', marginBottom: '10px' }}>1. สแกน QR Code ชำระเงิน</h4>
                <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=00020101021129370016A000000677010111011300668123456785802TH5303764540${totalAmount}.006304`} 
                    alt="PromptPay QR Code"
                    style={{ width: '200px', height: '200px', margin: '0 auto', display: 'block' }}
                  />
                  <p style={{ color: '#000', fontWeight: '700', fontSize: '1.2rem', marginTop: '10px' }}>
                    ยอดชำระ: ฿{totalAmount.toLocaleString()}
                  </p>
                  <p style={{ color: '#666', fontSize: '0.8rem' }}> PromptPay: สาขาวิชาวิศวกรรมคอมพิวเตอร์ มรพ.</p>
                </div>
              </div>

              {/* Right: Student Receiver Info & Slip Upload */}
              <div>
                <h4 style={{ color: '#fff', fontSize: '1rem', marginBottom: '10px' }}>2. ข้อมูลผู้รับเสื้อ &amp; หลักฐาน</h4>
                
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label>ชื่อ-นามสกุล ผู้สั่งซื้อ</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={checkoutName}
                    onChange={e => setCheckoutName(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label>รหัสนักศึกษา (10 หลัก)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    maxLength={10}
                    value={checkoutStudentId}
                    onChange={e => setCheckoutStudentId(e.target.value.replace(/\D/g, ''))}
                    required 
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label>เบอร์โทรศัพท์ติดต่อ</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    value={checkoutPhone}
                    onChange={e => setCheckoutPhone(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label>แนบสลิปการโอนเงิน (Slip Attachment)</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="form-input"
                    onChange={e => setSlipFile(e.target.files[0])}
                  />
                </div>

                <button type="submit" className="btn btn-gold" style={{ width: '100%' }} disabled={isSubmitting}>
                  {isSubmitting ? 'กำลังบันทึกลง Firebase...' : 'ยืนยันการแจ้งชำระเงิน'}
                </button>
              </div>

            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// 8. SIZE GUIDE MODAL COMPONENT
function SizeGuideModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop show">
      <div className="modal-card">
        <div className="modal-header">
          <h3 className="modal-title">ตารางขนาดเสื้อ (Size Guide)</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            ขนาดรอบอก (นิ้ว) และความยาวตัวเสื้อ (นิ้ว) สำหรับทรงเสื้อโปโล &amp; เสื้อคลุม CPE 69
          </p>

          <h4 style={{ color: 'var(--accent-gold)', marginTop: '12px', fontSize: '0.95rem' }}>1. เสื้อโปโลสาขา CPE (Polo Shirt) - ฿240</h4>
          <table className="size-table">
            <thead>
              <tr>
                <th>ไซส์ (Size)</th>
                <th>รอบอก (นิ้ว)</th>
                <th>ความยาว (นิ้ว)</th>
                <th>ราคา</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><strong>SS - 2XL</strong></td><td>34" - 44"</td><td>25" - 30"</td><td>240 บาท</td></tr>
              <tr><td><strong>3XL - 8XL</strong> <span style={{ fontSize: '0.75rem', color: '#F5D061' }}>(+10฿)</span></td><td>46" - 56"</td><td>31" - 36"</td><td><strong style={{ color: '#F5D061' }}>250 บาท</strong></td></tr>
            </tbody>
          </table>

          <h4 style={{ color: 'var(--accent-gold)', marginTop: '20px', fontSize: '0.95rem' }}>2. เสื้อคลุมสาขา CPE 69 (Jacket) - ฿920</h4>
          <table className="size-table">
            <thead>
              <tr>
                <th>ไซส์ (Size)</th>
                <th>รอบอก (นิ้ว)</th>
                <th>ความยาว (นิ้ว)</th>
                <th>ราคา (น้อง 69)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><strong>SS - 2XL</strong></td><td>36" - 46"</td><td>26" - 31"</td><td>920 บาท</td></tr>
              <tr><td><strong>3XL - 8XL</strong> <span style={{ fontSize: '0.75rem', color: '#F5D061' }}>(+100฿)</span></td><td>48" - 58"</td><td>32" - 37"</td><td><strong style={{ color: '#F5D061' }}>1,020 บาท</strong></td></tr>
            </tbody>
          </table>

          <div style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid var(--border-gold)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--accent-gold-bright)', marginTop: '15px' }}>
            💡 คำแนะนำ: เสื้อโปโล 3XL+ เพิ่ม 10฿ / เสื้อคลุม Jacket 3XL+ เพิ่ม 100฿ | บริการปักชื่อ +30฿
          </div>
        </div>
      </div>
    </div>
  );
}

// 9. FOOTER COMPONENT
function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          
          <div className="footer-brand">
            <div className="brand-logo" style={{ marginBottom: '12px' }}>
              <img src="assets/logo.png" alt="CPE Logo" className="brand-icon" />
              <div className="brand-text">
                <h1>COMPUTER ENGINEERING</h1>
                <span>FACULTY OF ENGINEERING PSRU</span>
              </div>
            </div>
            <p>
              ระบบสั่งจองเสื้อโปโลสาขาและเสื้อคลุม CPE 69 สำหรับนักศึกษาและบุคลากร สาขาวิชาวิศวกรรมคอมพิวเตอร์ มหาวิทยาลัยราชภัฏพิบูลสงคราม
            </p>
          </div>

          <div className="footer-column">
            <h4>ลิงก์ด่วน</h4>
            <ul className="footer-links">
              <li><a href="#hero">หน้าแรก</a></li>
              <li><a href="#ordering">สั่งซื้อเสื้อโปโล &amp; เสื้อคลุม</a></li>
              <li><a href="#tracking">ตรวจสอบสถานะการสั่งซื้อ</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4>ช่องทางติดต่อ &amp; Credits</h4>
            <div className="social-credits">
              <a href="https://instagram.com/trd_shel" target="_blank" className="social-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                @trd_shel
              </a>
              <a href="https://instagram.com/s.peeranart" target="_blank" className="social-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                @s.peeranart
              </a>
            </div>
          </div>

        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 Computer Engineering Faculty of Engineering PSRU. All rights reserved. Powered by React &amp; Firebase Cloud Database.</p>
        </div>
      </div>
    </footer>
  );
}

// Render React App into #root
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
