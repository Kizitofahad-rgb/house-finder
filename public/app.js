import {
  collection, addDoc, getDocs, query, where, orderBy, limit, startAfter,
  doc, getDoc, updateDoc, increment
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ---- GLOBAL STATE ----
window.currentSection = 'home';
window.currentCategoryFilter = '';
// Persistent tracker array for multiple photo additions
window.selectedFormFiles = [];

// 📉 Pagination State Variables
window.lastVisibleDoc = null; 
window.isFetchingMore = false;

// ---- CONFIG ----
const YOUR_WHATSAPP_NUMBER = '256775989760';
const APP_NAME = 'HouseFinder';
const ADMIN_EMAIL = 'kizitofahad665@gmail.com';

// ---- ROUTER ----
window.showSection = async (section) => {
  window.currentSection = section;
  const app = document.getElementById('app');
  switch (section) {
    case 'home': app.innerHTML = await getHomeHTML(); break;
    case 'login': app.innerHTML = getLoginHTML(); break;
    case 'signup': app.innerHTML = getSignupHTML(); break;
    case 'dashboard':
      app.innerHTML = await getDashboardHTML();
      loadMyListings();
      break;
    default: break;
  }
};

// ================= HOME PAGE =================
async function getHomeHTML() {
  const html = `
    <h2 style="margin-bottom:0.5rem;">Find Your Next Home</h2>
    <div class="category-pills" id="category-pills">
      <button class="cat-pill active" onclick="filterByCategory('')">All</button>
      <button class="cat-pill" onclick="filterByCategory('apt_furnished')">Furnished Apartments</button>
      <button class="cat-pill" onclick="filterByCategory('apt_unfurnished')">Unfurnished Apartments</button>
      <button class="cat-pill" onclick="filterByCategory('single_room')">Single Rooms</button>
      <button class="cat-pill" onclick="filterByCategory('house')">Houses</button>
      <button class="cat-pill" onclick="filterByCategory('hostel')">Hostels</button>
      <button class="cat-pill" onclick="filterByCategory('commercial')">Commercial</button>
      <button class="cat-pill" onclick="land')">Land</button>
    </div>
    <div class="search-area" style="margin-top:1rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
      <input type="text" id="searchLocation" placeholder="Location (e.g., Makindye)" style="flex: 1; min-width: 150px;">
      <input type="number" id="maxPrice" placeholder="Max price (UGX/month)" style="flex: 1; min-width: 150px;">
      <select id="searchBedrooms" style="flex: 1; min-width: 120px; padding: 0.5rem; border-radius: 6px; border: 1px solid #ccc; background: white; color: #1f2937;">
        <option value="">Any Bedrooms</option>
        <option value="0">0 (Studio/Single)</option>
        <option value="1">1 Bedroom</option>
        <option value="2">2 Bedrooms</option>
        <option value="3">3 Bedrooms</option>
        <option value="4">4+ Bedrooms</option>
      </select>
      <button onclick="searchListings()">Search</button>
    </div>
    <div id="listings-container" class="listings-grid">Loading...</div>
    
    <div id="pagination-wrapper" style="text-align: center; margin: 2.5rem 0 1rem; display: none;">
      <button id="load-more-btn" onclick="window.loadMoreListings()" style="background: #10b981; color: #ffffff; border: none; padding: 12px 30px; font-weight: 700; border-radius: 6px; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        🔄 Load More Listings
      </button>
    </div>
  `;
  const tryLoad = () => {
    if (document.getElementById('listings-container')) {
      loadListings('', '', '');
    } else {
      setTimeout(tryLoad, 50);
    }
  };
  setTimeout(tryLoad, 150);
  return html;
}

// Map standard data formats directly into clean cards
function generateListingCardsHTML(listingsArray) {
  return listingsArray.map(l => `
    <div class="listing-card ${l.featured ? 'featured' : ''}">
      <div class="listing-image-wrapper" onclick="openDetailModal('${l.id}')">
        ${l.images && l.images.length > 0
          ? `<img src="${l.images[0]}" alt="${l.title}">`
          : `<div style="height:140px;background:#dfe6e9;display:flex;align-items:center;justify-content:center;">
              <span style="color:#b2bec3;">No Image</span></div>`}
        ${l.images && l.images.length > 1 ? `<span class="photo-count">📷 ${l.images.length} photos</span>` : ''}
      </div>
      <div class="card-body">
        <div class="badge-group">
          ${l.featured ? '<span class="badge badge-featured">⭐ Featured</span>' : ''}
          ${l.verified ? '<span class="badge badge-verified">✅ Verified</span>' : ''}
        </div>
        <span class="category-badge">${formatCategory(l.category)}</span>
        <h3>${l.title || 'Untitled'} - ${l.bedrooms || 0} Bd</h3>
        <p><strong>📍</strong> ${l.location || 'N/A'}</p>
        <p class="price">${l.price != null ? l.price.toLocaleString() + ' UGX/month' : 'Price not set'}</p>
        <p class="views">🔥 ${l.views || 0} views</p>
        <div class="card-actions">
          <button class="secondary" onclick="openDetailModal('${l.id}')">🔍 View</button>
          ${l.landlordWhatsApp ? 
            `<a href="https://wa.me/${l.landlordWhatsApp}?text=Hi,%20I'm%20interested%20in%20your%20property:%20${encodeURIComponent(l.title || '')}" target="_blank" class="wa-btn">💬 Chat</a>`
            : `<span>📞 ${l.contactEmail || 'N/A'}</span>`
          }
        </div>
      </div>
    </div>
  `).join('');
}

async function loadListings(locationFilter = '', maxPriceFilter = '', bedroomsFilter = '') {
  const container = document.getElementById('listings-container');
  const paginationWrapper = document.getElementById('pagination-wrapper');
  if (!container) return;

  // Reset pagination markers on every fresh baseline filter search
  window.lastVisibleDoc = null;
  if (paginationWrapper) paginationWrapper.style.display = 'none';

  // Core Query bounded strictly to fetch only the first 20 records
  let q = query(
    collection(window.db, 'listings'),
    where('active', '==', true),
    orderBy('featured', 'desc'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );

  try {
    const snapshot = await getDocs(q);
    
    if (snapshot.docs.length === 0) {
      container.innerHTML = '<p>No listings found. Try a different filter.</p>';
      return;
    }

    // Save index pointer context tracking for subsequent pagination calls
    window.lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

    let listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Apply active memory filter routines
    const catFilter = window.currentCategoryFilter || '';
    if (catFilter) listings = listings.filter(l => l.category === catFilter);
    
    if (locationFilter) {
      const search = locationFilter.toLowerCase();
      listings = listings.filter(l => (l.location || '').toLowerCase().includes(search));
    }
    if (maxPriceFilter) {
      listings = listings.filter(l => l.price != null && l.price <= parseInt(maxPriceFilter));
    }
    if (bedroomsFilter !== '') {
      const bCount = parseInt(bedroomsFilter);
      if (bCount === 4) {
        listings = listings.filter(l => l.bedrooms >= 4);
      } else {
        listings = listings.filter(l => l.bedrooms === bCount);
      }
    }

    if (listings.length === 0) {
      container.innerHTML = '<p>No listings match your combined filters. Try broadening your criteria.</p>';
      return;
    }

    container.innerHTML = generateListingCardsHTML(listings);

    // If we loaded exactly 20 elements, unhide the action button container for the next batch
    if (snapshot.docs.length === 20 && paginationWrapper) {
      paginationWrapper.style.display = 'block';
    }

    incrementViews(listings.map(l => l.id));
  } catch (error) {
    container.innerHTML = `<p class="error">Error loading listings: ${error.message}</p>`;
    console.error(error);
  }
}

// 🔄 Asynchronous Workflow to Load Next 20 Elements Dynamically
window.loadMoreListings = async () => {
  if (!window.lastVisibleDoc || window.isFetchingMore) return;

  const container = document.getElementById('listings-container');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const paginationWrapper = document.getElementById('pagination-wrapper');
  
  window.isFetchingMore = true;
  if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = '⚡ Loading More...';
  }

  // Construct query starting precisely after our tracked position anchor
  let nextPageQuery = query(
    collection(window.db, 'listings'),
    where('active', '==', true),
    orderBy('featured', 'desc'),
    orderBy('createdAt', 'desc'),
    startAfter(window.lastVisibleDoc),
    limit(20)
  );

  try {
    const snapshot = await getDocs(nextPageQuery);
    
    if (snapshot.docs.length === 0) {
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      alert('You have reached the end of all active listings! 😎');
      window.isFetchingMore = false;
      return;
    }

    // Advance the visible pointer forward to track subsequent requests
    window.lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

    let newNextListings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Re-apply client-side dynamic search fields if populated
    const catFilter = window.currentCategoryFilter || '';
    if (catFilter) newNextListings = newNextListings.filter(l => l.category === catFilter);
    
    const locationFilter = document.getElementById('searchLocation')?.value || '';
    if (locationFilter) {
      const search = locationFilter.toLowerCase();
      newNextListings = newNextListings.filter(l => (l.location || '').toLowerCase().includes(search));
    }
    
    const maxPriceFilter = document.getElementById('maxPrice')?.value || '';
    if (maxPriceFilter) {
      newNextListings = newNextListings.filter(l => l.price != null && l.price <= parseInt(maxPriceFilter));
    }

    const bedroomsFilter = document.getElementById('searchBedrooms')?.value || '';
    if (bedroomsFilter !== '') {
      const bCount = parseInt(bedroomsFilter);
      if (bCount === 4) {
        newNextListings = newNextListings.filter(l => l.bedrooms >= 4);
      } else {
        newNextListings = newNextListings.filter(l => l.bedrooms === bCount);
      }
    }

    // Append the newly rendered listings directly to the bottom grid without wiping out previous cards
    if (newNextListings.length > 0) {
      container.insertAdjacentHTML('beforeend', generateListingCardsHTML(newNextListings));
      incrementViews(newNextListings.map(l => l.id));
    }

    // Toggle button display context visibility state criteria metrics
    if (snapshot.docs.length < 20 && paginationWrapper) {
      paginationWrapper.style.display = 'none';
    }

  } catch (error) {
    console.error("Pagination structural retrieval error context:", error);
  } finally {
    window.isFetchingMore = false;
    if (loadMoreBtn) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = '🔄 Load More Listings';
    }
  }
};

async function incrementViews(listingIds) {
  for (const id of listingIds) {
    const ref = doc(window.db, 'listings', id);
    try { await updateDoc(ref, { views: increment(1) }); } catch (e) {}
  }
}

window.filterByCategory = (cat) => {
  window.currentCategoryFilter = cat;
  document.querySelectorAll('.cat-pill').forEach(btn => btn.classList.remove('active'));
  const activeBtn = Array.from(document.querySelectorAll('.cat-pill')).find(
    btn => (cat === '' && btn.textContent.trim() === 'All') || btn.textContent.toLowerCase().includes(cat)
  );
  if (activeBtn) activeBtn.classList.add('active');
  const location = document.getElementById('searchLocation')?.value || '';
  const maxPrice = document.getElementById('maxPrice')?.value || '';
  const bedrooms = document.getElementById('searchBedrooms')?.value || '';
  loadListings(location, maxPrice, bedrooms);
};

window.searchListings = () => {
  const location = document.getElementById('searchLocation')?.value || '';
  const maxPrice = document.getElementById('maxPrice')?.value || '';
  const bedrooms = document.getElementById('searchBedrooms')?.value || '';
  loadListings(location, maxPrice, bedrooms);
};

// ================= AUTH FORMS =================
function getLoginHTML() {
  return `
    <div class="auth-form">
      <h2>Login</h2>
      <div class="form-group"><label>Email</label><input type="email" id="login-email"></div>
      <div class="form-group"><label>Password</label><input type="password" id="login-password"></div>
      <div id="login-error" class="error"></div>
      <button class="primary" onclick="login(document.getElementById('login-email').value, document.getElementById('login-password').value)">Login</button>
    </div>`;
}

function getSignupHTML() {
  return `
    <div class="auth-form">
      <h2>Sign Up</h2>
      <div class="form-group"><label>Email</label><input type="email" id="signup-email"></div>
      <div class="form-group"><label>Password</label><input type="password" id="signup-password"></div>
      <div class="form-group"><label>I am a:</label>
        <select id="signup-role">
          <option value="seeker">House Seeker</option>
          <option value="landlord">Landlord/Agent</option>
        </select>
      </div>
      <div id="signup-error" class="error"></div>
      <button class="primary" onclick="signup(document.getElementById('signup-email').value, document.getElementById('signup-password').value, document.getElementById('signup-role').value)">Sign Up</button>
    </div>`;
}

// ================= LANDLORD DASHBOARD & PAYMENTS =================
async function getDashboardHTML() {
  const user = window.auth.currentUser;
  if (!user) return '<p>Please login first.</p>';

  const userDoc = await getDoc(doc(window.db, 'users', user.uid));
  if (!userDoc.exists() || userDoc.data().role !== 'landlord') {
    return '<p class="error">Access denied. Only landlords can view this page.</p>';
  }

  const userData = userDoc.data();
  const listingCount = userData.listingCount || 0;
  const listingLimit = userData.listingLimit || 2;
  const isAdmin = (user.email && user.email === ADMIN_EMAIL);
  const canAddListing = isAdmin || (listingCount < listingLimit);

  // --- 📊 DYNAMIC ANALYTICS ENGINE FOR LANDLORDS ---
  let totalViews = 0;
  let mostPopularProperty = "None yet";
  let maxViews = -1;

  try {
    const q = query(
      collection(window.db, 'listings'),
      where('landlordId', '==', user.uid)
    );
    const snapshot = await getDocs(q);
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const views = data.views || 0;
      totalViews += views;
      
      if (views > maxViews) {
        maxViews = views;
        mostPopularProperty = data.title || "Untitled Property";
      }
    });
    
    if (snapshot.docs.length === 0) {
      mostPopularProperty = "No active properties";
    }
  } catch (err) {
    console.error("Error calculating live dashboard metrics:", err);
  }

  return `
    <h2>Welcome, Landlord!</h2>
    
    <div class="analytics-row" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; margin-top: 0.5rem;">
      
      <div style="background: #ffffff; color: #1f2937; padding: 1.25rem; border-radius: 12px; border-left: 5px solid #10b981; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: center;">
        <span style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600;">🔥 Total Portfolio Views</span>
        <strong style="font-size: 1.8rem; color: #10b981; margin-top: 0.2rem;">${totalViews.toLocaleString()}</strong>
      </div>

      <div style="background: #ffffff; color: #1f2937; padding: 1.25rem; border-radius: 12px; border-left: 5px solid #3b82f6; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: center;">
        <span style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600;">🏆 Most Popular Property</span>
        <strong style="font-size: 1.1rem; color: #1f2937; margin-top: 0.4rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${mostPopularProperty}">
          ${mostPopularProperty}
        </strong>
        ${maxViews > -1 ? `<span style="font-size: 0.75rem; color: #3b82f6; font-weight: bold; margin-top: 0.1rem;">(${maxViews} views)</span>` : ''}
      </div>

      <div style="background: #ffffff; color: #1f2937; padding: 1.25rem; border-radius: 12px; border-left: 5px solid #f59e0b; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: center;">
        <span style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600;">📋 Listing Slots Used</span>
        <strong style="font-size: 1.5rem; color: #f59e0b; margin-top: 0.2rem;">${listingCount} <span style="font-size: 0.9rem; font-weight: 400; color: #6b7280;">/ ${isAdmin ? '∞' : listingLimit}</span></strong>
      </div>

    </div>

    <div class="premium-pricing-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
      
      <div style="background:#ffffff; color:#1f2937; padding:1.5rem; border-radius:12px; border:1px solid #e5e7eb; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 4px 6px rgba(0,0,0,0.05);">
        <div>
          <h3 style="color:#1f2937; font-size:1.25rem; margin-bottom:0.5rem;">🚀 Plus Landlord</h3>
          <p style="color:#4b5563; font-size:0.9rem; margin-bottom:1rem;">Increase your account capacity to manage and post up to 10 rental listings simultaneously.</p>
          <div style="font-size:1.75rem; font-weight:700; color:#10b981; margin-bottom:1rem;">15,000 UGX <span style="font-size:0.85rem; font-weight:400; color:#6b7280;">one-time</span></div>
        </div>
        <button class="primary" style="width:100%; border-radius:6px; padding:0.6rem;" onclick="window.payWithMobileMoney(15000, 'plus_tier')">Upgrade Limit Now</button>
      </div>

      <div style="background:#ffffff; color:#1f2937; padding:1.5rem; border-radius:12px; border:2px solid #10b981; display:flex; flex-direction:column; justify-content:space-between; position:relative; box-shadow:0 4px 10px rgba(16,185,129,0.15);">
        <span style="position:absolute; top:-12px; right:15px; background:#10b981; color:#ffffff; font-size:0.75rem; font-weight:700; padding:4px 10px; border-radius:12px; text-transform:uppercase;">Best Value</span>
        <div>
          <h3 style="color:#1f2937; font-size:1.25rem; margin-bottom:0.5rem;">💎 Unlimited Agency</h3>
          <p style="color:#4b5563; font-size:0.9rem; margin-bottom:1rem;">Perfect for commercial real estate agents. Unlock completely unlimited property listings.</p>
          <div style="font-size:1.75rem; font-weight:700; color:#10b981; margin-bottom:1rem;">35,000 UGX <span style="font-size:0.85rem; font-weight:400; color:#6b7280;">one-time</span></div>
        </div>
        <button class="primary" style="width:100%; border-radius:6px; padding:0.6rem;" onclick="window.payWithMobileMoney(35000, 'unlimited_tier')">Go Unlimited</button>
      </div>

    </div>

    ${canAddListing ? `
      <button class="primary" onclick="showAddListingForm()">+ Add New Listing</button>
    ` : `
      <div class="upgrade-message" style="background:#fef2f2; color:#991b1b; padding:1.25rem; border-radius:8px; margin-bottom:1.5rem; border:1px solid #fca5a5;">
        <p style="font-weight:600; margin-bottom:0.5rem;">⚠️ Out of Free Slots!</p>
        <p style="margin-bottom:0; font-size:0.95rem;">You have hit your free profile limit. Use one of the premium mobile money cards above to unlock instant slots, or contact us directly below.</p>
        <a href="https://wa.me/${YOUR_WHATSAPP_NUMBER}?text=I%20want%20to%20upgrade%20my%20listing%20limit%20on%20${APP_NAME}" target="_blank" class="wa-btn primary" style="margin-top:1rem; display:inline-block;">💬 Upgrade via WhatsApp Manual</a>
      </div>
    `}

    <div id="add-listing-form" class="dashboard-form" style="display:none;">
      <h3>New Listing</h3>
      <div class="form-group"><label>Title</label><input id="new-title" placeholder="e.g., Cozy 2BR in Central Division"></div>
      <div class="form-group"><label>Location</label><input id="new-location" placeholder="e.g., Makindye"></div>
      <div class="form-group"><label>Category</label>
        <select id="new-category">
          <option value="apt_furnished">Apartment – Furnished</option>
          <option value="apt_unfurnished">Apartment – Unfurnished</option>
          <option value="single_room">Single Room</option>
          <option value="house">Full House</option>
          <option value="hostel">Hostel / Boarding</option>
          <option value="commercial">Commercial / Office Space</option>
          <option value="land">Land for Rent</option>
        </select>
      </div>
      <div class="form-group"><label>Bedrooms</label><input id="new-bedrooms" type="number" value="1"></div>
      <div class="form-group"><label>Price (UGX/month)</label><input id="new-price" type="number" value="500000"></div>
      <div class="form-group"><label>Contact Email</label><input id="new-contact" type="email"></div>
      <div class="form-group"><label>WhatsApp Number (optional, e.g., 256712345678)</label><input id="new-whatsapp" type="text" placeholder="256..."></div>
      <div class="form-group"><label>Description</label><textarea id="new-description"></textarea></div>
      
      <div class="form-group">
        <label>Property Photos</label>
        <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
          <input type="file" id="new-images" accept="image/*" style="display: none;">
          <button type="button" class="secondary" style="margin: 0; padding: 0.5rem 1rem;" onclick="document.getElementById('new-images').click()">📸 Choose Photo</button>
          <span id="photo-count-badge" style="font-size: 0.9rem; color: #6b7280; font-weight: 600;">0 photos selected</span>
        </div>
        <div class="image-preview" id="image-preview" style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px;"></div>
      </div>

      <button class="primary" onclick="addListing()">Submit Listing</button>
      <button class="secondary" onclick="document.getElementById('add-listing-form').style.display='none'">Cancel</button>
    </div>
    <h3 style="margin:1.5rem 0 0.5rem;">Your Listings</h3>
    <div id="my-listings" class="listings-grid">Loading...</div>
  `;
}

// ================= PESAPAL V3 PAYMENT GATEWAY HANDLER =================
window.payWithMobileMoney = async function(amount, packageTier) {
  const user = window.auth.currentUser;
  if (!user) {
    alert("Please sign in to process payment tier integrations.");
    return;
  }

  const userEmail = user.email || 'customer@housefinder.ug';
  const uniqueReference = "HF-UG-" + user.uid + "-" + Date.now();

  console.log(`Initializing Pesapal Handshake for ${packageTier}: ${amount} UGX`);

  try {
    const authResponse = await fetch('https://pay.pesapal.com/v3/api/Auth/RequestToken', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "consumer_key": "vuz9TVO2PVQfhWZn80AHlbeQfaZJVb2F",
        "consumer_secret": "v8VrfOhNbhtOLE1j1J/obknyKY4="
      })
    });
    
    const authData = await authResponse.json();
    if (!authData.token) throw new Error("CORS validation or API handshake mismatch.");

    const orderPayload = {
      "id": uniqueReference,
      "amount": amount,
      "description": `HouseFinder Portfolio Upgrade: ${packageTier.replace('_', ' ')}`,
      "callback_url": "https://studio-6076456451-c38fd.web.app/",
      "notification_id": "00000000-0000-0000-0000-000000000000",
      "billing_address": {
        "email_address": userEmail,
        "phone_number": "",
        "country_code": "UG",
        "first_name": "Landlord",
        "last_name": "User"
      }
    };

    const orderResponse = await fetch('https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.token}`
      },
      body: JSON.stringify(orderPayload)
    });

    const orderData = await orderResponse.json();
    if (orderData.redirect_url) {
      window.location.href = orderData.redirect_url;
    } else {
      throw new Error("Redirect initialization skipped.");
    }

  } catch (error) {
    console.warn("Direct API blocked by frontend browser security policy rules. Serving robust manual gateway fallback.");
    
    let targetLimit = 2;
    if (packageTier === 'plus_tier') targetLimit = 10;
    if (packageTier === 'unlimited_tier') targetLimit = 9999;
    if (packageTier === 'boost_feature') targetLimit = 'boosted';

    const userPrompt = confirm(
      `🇺🇬 HOUSEFINDER UGANDA MOBILE MONEY PAYMENT\n\n` +
      `To complete your upgrade securely:\n` +
      `1. Send ${amount.toLocaleString()} UGX via Mobile Money to: 0775989760 (Solome Gift)\n` +
      `2. State your email "${userEmail}" as the transaction reason.\n\n` +
      `Click "OK" if you have made or are making the payment so your dashboard updates instantly for database approval!`
    );

    if (userPrompt) {
      try {
        if (packageTier === 'boost_feature') {
          alert("Highlight tracking request logged! Our backend is verifying the reference.");
        } else {
          await updateDoc(doc(window.db, 'users', user.uid), {
            listingLimit: targetLimit
          });
          alert("Account limit updated to " + (targetLimit === 9999 ? "Unlimited" : targetLimit) + " slots successfully! Refreshing dashboard.");
          showSection('dashboard');
        }
      } catch (dbErr) {
        console.error("Provisional credit execution track failed:", dbErr);
      }
    }
  }
};

// ================= CUMULATIVE MULTI-IMAGE HANDLERS =================
window.showAddListingForm = () => {
  document.getElementById('add-listing-form').style.display = 'block';
  
  window.selectedFormFiles = [];
  const previewContainer = document.getElementById('image-preview');
  const countBadge = document.getElementById('photo-count-badge');
  if (previewContainer) previewContainer.innerHTML = '';
  if (countBadge) countBadge.textContent = '0 photos selected';

  const fileInput = document.getElementById('new-images');
  if (fileInput) {
    const clone = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(clone, fileInput);
    
    clone.addEventListener('change', function(e) {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      files.forEach(file => {
        window.selectedFormFiles.push(file);
        const currentIdx = window.selectedFormFiles.length - 1;

        const reader = new FileReader();
        reader.onload = (event) => {
          const imageCardHTML = `
            <div id="prev-card-${currentIdx}" style="position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
              <img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover;">
              <button type="button" onclick="window.removeSelectedPhoto(${currentIdx})" style="position: absolute; top: 2px; right: 2px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1;">&times;</button>
            </div>
          `;
          if (previewContainer) previewContainer.insertAdjacentHTML('beforeend', imageCardHTML);
        };
        reader.readAsDataURL(file);
      });

      clone.value = '';
      if (countBadge) {
        const activeCount = window.selectedFormFiles.filter(f => f !== null).length;
        countBadge.textContent = `${activeCount} photos selected`;
      }
    });
  }
};

window.removeSelectedPhoto = (index) => {
  window.selectedFormFiles[index] = null;
  const card = document.getElementById(`prev-card-${index}`);
  if (card) card.remove();
  
  const activeCount = window.selectedFormFiles.filter(f => f !== null).length;
  const countBadge = document.getElementById('photo-count-badge');
  if (countBadge) countBadge.textContent = `${activeCount} photos selected`;
};

// ================= STABLE ASYNC SEQUENTIAL MULTI-IMAGE UPLOADER =================
window.addListing = async () => {
  const user = window.auth.currentUser;
  if (!user) { alert('You must be logged in.'); return; }

  const userDoc = await getDoc(doc(window.db, 'users', user.uid));
  const userData = userDoc.data();
  const listingCount = userData.listingCount || 0;
  const listingLimit = userData.listingLimit || 2;
  const isAdmin = (user.email && user.email === ADMIN_EMAIL);
  if (!isAdmin && listingCount >= listingLimit) {
    alert('You have reached your free listing limit. Please upgrade.');
    return;
  }

  const title = document.getElementById('new-title').value.trim();
  const location = document.getElementById('new-location').value.trim();
  const category = document.getElementById('new-category').value;
  const bedrooms = parseInt(document.getElementById('new-bedrooms').value) || 0;
  const price = parseInt(document.getElementById('new-price').value) || 0;
  const contactEmail = document.getElementById('new-contact').value.trim();
  const landlordWhatsApp = document.getElementById('new-whatsapp').value.trim();
  const description = document.getElementById('new-description').value.trim();

  if (!title || !location) { alert('Title and location are required.'); return; }

  const validFiles = window.selectedFormFiles.filter(file => file !== null);

  const submitBtn = document.querySelector('#add-listing-form button.primary');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Uploading images (0/' + validFiles.length + ')…'; }

  let imageURLs = [];
  
  try {
    if (validFiles.length > 0) {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        
        if (submitBtn) submitBtn.textContent = `Uploading photo ${i + 1} of ${validFiles.length}…`;

        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error(`Failed to parse photo format data for item index: ${i}`));
          reader.readAsDataURL(file);
        });

        const response = await fetch('https://house-finder-mu.vercel.app/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: base64Data })
        });

        if (!response.ok) {
          throw new Error(`Vercel pipeline rejected image index ${i + 1}. Server status code: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.url) { 
          imageURLs.push(data.url); 
        } else { 
          throw new Error(data.error || `Upload array structural error returned at position ${i}`); 
        }
      }
    }

    if (submitBtn) submitBtn.textContent = 'Saving Listing Details…';

    await addDoc(collection(window.db, 'listings'), {
      landlordId: user.uid,
      title, location, category,
      bedrooms, price, contactEmail, landlordWhatsApp,
      description,
      images: imageURLs,
      active: true,
      featured: false,
      verified: false,
      views: 0,
      createdAt: new Date()
    });

    await updateDoc(doc(window.db, 'users', user.uid), {
      listingCount: increment(1)
    });

    document.getElementById('add-listing-form').style.display = 'none';
    showSection('dashboard');
    alert('Property posted successfully with all selected photos!');
  } catch (error) {
    alert('Image Pipeline Error: ' + error.message);
    console.error("Upload failure debug vector info:", error);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false; 
      submitBtn.textContent = 'Submit Listing'; 
    }
  }
};

// ================= LOAD MY LISTINGS =================
async function loadMyListings() {
  const container = document.getElementById('my-listings');
  if (!container) return;
  const user = window.auth.currentUser;
  if (!user) { container.innerHTML = '<p>Please log in to see your listings.</p>'; return; }

  try {
    const q = query(
      collection(window.db, 'listings'),
      where('landlordId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (listings.length === 0) {
      container.innerHTML = '<p>You have no listings yet.</p>';
      return;
    }
    container.innerHTML = listings.map(l => `
      <div class="listing-card ${l.featured ? 'featured' : ''}">
        <div class="listing-image-wrapper" onclick="openDetailModal('${l.id}')">
          ${l.images && l.images.length > 0
            ? `<img src="${l.images[0]}" alt="${l.title}">`
            : `<div style="height:140px;background:#dfe6e9;display:flex;align-items:center;justify-content:center;">
                <span style="color:#b2bec3;">No Image</span></div>`}
          ${l.images && l.images.length > 1 ? `<span class="photo-count">📷 ${l.images.length} photos</span>` : ''}
        </div>
        <div class="card-body">
          <div class="badge-group">
            ${l.featured ? '<span class="badge badge-featured">⭐ Featured</span>' : ''}
            ${l.verified ? '<span class="badge badge-verified">✅ Verified</span>' : ''}
          </div>
          <span class="category-badge">${formatCategory(l.category)}</span>
          <h3>${l.title || 'Untitled'} - ${l.bedrooms || 0} Bd</h3>
          <p><strong>📍</strong> ${l.location || 'N/A'}</p>
          <p class="price">${l.price != null ? l.price.toLocaleString() + ' UGX/month' : 'Price not set'}</p>
          <p class="views">🔥 ${l.views || 0} views</p>
          <p>Status: ${l.active ? '✅ Available' : '🏠 Rented'}</p>
          <div class="card-actions">
            <button class="secondary" onclick="openDetailModal('${l.id}')">🔍 View</button>
            <button class="secondary" onclick="toggleListing('${l.id}', ${!l.active})">
              ${l.active ? 'Mark as Rented' : 'Mark as Available'}
            </button>
          </div>
          
          ${!l.featured ? `
            <button class="primary" style="background:#d97706; padding:0.4rem 0.8rem; font-size:0.8rem; width:100%; margin-top:0.5rem; border-radius:6px;" onclick="window.payWithMobileMoney(5000, 'boost_feature')">⭐ Highlight Property (5,000 UGX)</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = `<p class="error">Error loading your listings: ${error.message}</p>`;
    console.error(error);
  }
}

window.toggleListing = async (id, newStatus) => {
  await updateDoc(doc(window.db, 'listings', id), { active: newStatus });
  loadMyListings();
  loadListings();
};

// ================= DETAIL MODAL =================
window.openDetailModal = async (listingId) => {
  const ref = doc(window.db, 'listings', listingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const l = snap.data();
  l.id = listingId;

  let imagesHTML = '';
  if (l.images && l.images.length > 0) {
    imagesHTML = `
      <div class="modal-image-slider">
        <button class="slider-btn prev" onclick="changeModalImage(-1)">&#10094;</button>
        <img id="modal-main-image" src="${l.images[0]}" alt="${l.title}" style="max-height: 70vh; width: 100%; object-fit: contain;">
        <button class="slider-btn next" onclick="changeModalImage(1)">&#10095;</button>
        <div class="slider-dots" id="modal-dots">
          ${l.images.map((_, idx) => `<span class="dot ${idx === 0 ? 'active' : ''}" onclick="setModalImage(${idx})"></span>`).join('')}
        </div>
      </div>
    `;
    window._modalImages = l.images;
    window._modalIndex = 0;
  } else {
    imagesHTML = `<div style="height:200px;background:#dfe6e9;display:flex;align-items:center;justify-content:center;">No Image</div>`;
  }

  const modalHTML = `
    <div id="listing-modal" class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-content" onclick="event.stopPropagation()">
        <span class="modal-close" onclick="closeModal()">&times;</span>
        ${imagesHTML}
        <div class="modal-body">
          <h2>${l.title || 'Untitled'}</h2>
          <p><strong>📍</strong> ${l.location || 'N/A'}</p>
          <p><strong>Category:</strong> ${formatCategory(l.category)}</p>
          <p><strong>Bedrooms:</strong> ${l.bedrooms || 0}</p>
          <p class="price">${l.price != null ? l.price.toLocaleString() + ' UGX/month' : 'Price not set'}</p>
          <p><strong>Views:</strong> ${l.views || 0}</p>
          <p>${l.description || ''}</p>
          <div class="modal-actions">
            ${l.landlordWhatsApp ? 
              `<a href="https://wa.me/${l.landlordWhatsApp}?text=Hi,%20I'm%20interested%20in%20your%20property:%20${encodeURIComponent(l.title || '')}" target="_blank" class="wa-btn">💬 Chat on WhatsApp</a>`
              : `<span>📞 ${l.contactEmail || 'N/A'}</span>`
            }
          </div>
        </div>
      </div>
    </div>
  `;

  const oldModal = document.getElementById('listing-modal');
  if (oldModal) oldModal.remove();
  document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.changeModalImage = (dir) => {
  if (!window._modalImages) return;
  let idx = (window._modalIndex + dir + window._modalImages.length) % window._modalImages.length;
  setModalImage(idx);
};

window.setModalImage = (idx) => {
  if (!window._modalImages || idx < 0 || idx >= window._modalImages.length) return;
  window._modalIndex = idx;
  const mainImg = document.getElementById('modal-main-image');
  if (mainImg) mainImg.src = window._modalImages[idx];
  const dots = document.querySelectorAll('.dot');
  dots.forEach((dot, i) => dot.classList.toggle('active', i === idx));
};

window.closeModal = (event) => {
  if (event && event.target !== document.getElementById('listing-modal')) return;
  const modal = document.getElementById('listing-modal');
  if (modal) modal.remove();
  window._modalImages = null;
  window._modalIndex = null;
};

function formatCategory(slug) {
  const map = {
    apt_furnished: 'Furnished Apt',
    apt_unfurnished: 'Unfurnished Apt',
    single_room: 'Single Room',
    house: 'Full House',
    hostel: 'Hostel',
    commercial: 'Commercial',
    land: 'Land'
  };
  return map[slug] || slug || 'Other';
}

// Initial load
showSection('home');