import {
  collection, addDoc, getDocs, query, where, orderBy,
  doc, getDoc, updateDoc, increment
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ---- GLOBAL STATE ----
window.currentSection = 'home';
window.currentCategoryFilter = '';

// ---- CONFIG (change these to your real details) ----
const YOUR_WHATSAPP_NUMBER = '256775989760';  // your WhatsApp number without +
const APP_NAME = 'HouseFinder';
const ADMIN_EMAIL = 'kizitofahad665@gmail.com'; // used for unlimited listings & admin access

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
      <button class="cat-pill" onclick="filterByCategory('land')">Land</button>
    </div>
    <div class="search-area" style="margin-top:1rem;">
      <input type="text" id="searchLocation" placeholder="Location (e.g., Makindye)">
      <input type="number" id="maxPrice" placeholder="Max price (UGX/month)">
      <button onclick="searchListings()">Search</button>
    </div>
    <div id="listings-container" class="listings-grid">Loading...</div>
  `;
  // Wait a tiny bit for the container to exist, then load
  const tryLoad = () => {
    if (document.getElementById('listings-container')) {
      loadListings('', '');
    } else {
      setTimeout(tryLoad, 50);
    }
  };
  setTimeout(tryLoad, 150);
  return html;
}

async function loadListings(locationFilter = '', maxPriceFilter = '') {
  const container = document.getElementById('listings-container');
  if (!container) return;

  // Firestore query: active == true, featured on top, newest first
  let q = query(
    collection(window.db, 'listings'),
    where('active', '==', true),
    orderBy('featured', 'desc'),
    orderBy('createdAt', 'desc')
  );

  try {
    const snapshot = await getDocs(q);
    let listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Client-side filters
    const catFilter = window.currentCategoryFilter || '';
    if (catFilter) {
      listings = listings.filter(l => l.category === catFilter);
    }
    if (locationFilter) {
      const search = locationFilter.toLowerCase();
      listings = listings.filter(l => (l.location || '').toLowerCase().includes(search));
    }
    if (maxPriceFilter) {
      listings = listings.filter(l => l.price != null && l.price <= parseInt(maxPriceFilter));
    }

    if (listings.length === 0) {
      container.innerHTML = '<p>No listings found. Try a different filter.</p>';
      return;
    }

    container.innerHTML = listings.map(l => `
      <div class="listing-card ${l.featured ? 'featured' : ''}">
        ${l.images && l.images.length > 0
          ? `<img src="${l.images[0]}" alt="${l.title}">`
          : `<div style="height:140px;background:#dfe6e9;display:flex;align-items:center;justify-content:center;">
              <span style="color:#b2bec3;">No Image</span></div>`}
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
            ${l.landlordWhatsApp ? 
              `<a href="https://wa.me/${l.landlordWhatsApp}?text=Hi, I'm interested in your property: ${encodeURIComponent(l.title || '')}" target="_blank" class="wa-btn">💬 Chat on WhatsApp</a>`
              : `<span>📞 ${l.contactEmail || 'N/A'}</span>`
            }
          </div>
          <p style="font-size:0.8rem; margin-top:0.5rem;">${l.description || ''}</p>
        </div>
      </div>
    `).join('');

    // Increment view counts in background
    incrementViews(listings.map(l => l.id));
  } catch (error) {
    container.innerHTML = `<p class="error">Error loading listings: ${error.message}</p>`;
    console.error(error);
  }
}

async function incrementViews(listingIds) {
  for (const id of listingIds) {
    const ref = doc(window.db, 'listings', id);
    try {
      await updateDoc(ref, { views: increment(1) });
    } catch (e) {
      // ignore
    }
  }
}

window.filterByCategory = (cat) => {
  window.currentCategoryFilter = cat;
  // Update active pill
  document.querySelectorAll('.cat-pill').forEach(btn => btn.classList.remove('active'));
  const activeBtn = Array.from(document.querySelectorAll('.cat-pill')).find(
    btn => (cat === '' && btn.textContent.trim() === 'All') || btn.textContent.toLowerCase().includes(cat)
  );
  if (activeBtn) activeBtn.classList.add('active');
  // Reload listings with current search fields
  const location = document.getElementById('searchLocation')?.value || '';
  const maxPrice = document.getElementById('maxPrice')?.value || '';
  loadListings(location, maxPrice);
};

window.searchListings = () => {
  const location = document.getElementById('searchLocation')?.value || '';
  const maxPrice = document.getElementById('maxPrice')?.value || '';
  loadListings(location, maxPrice);
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

// ================= LANDLORD DASHBOARD =================
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

  return `
    <h2>Welcome, Landlord!</h2>
    <div class="dashboard-stats">
      <p>Your Listings: <strong>${listingCount}</strong> / ${isAdmin ? '∞' : listingLimit} free slots${isAdmin ? ' (Admin – unlimited)' : ''}</p>
    </div>
    ${canAddListing ? `
      <button class="primary" onclick="showAddListingForm()">+ Add New Listing</button>
    ` : `
      <div class="upgrade-message">
        <p>You've used all your free listing slots. Upgrade to Premium to add more.</p>
        <a href="https://wa.me/${YOUR_WHATSAPP_NUMBER}?text=I want to upgrade my listing limit on ${APP_NAME}" target="_blank" class="wa-btn primary">💬 Upgrade via WhatsApp</a>
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
        <label>Images (multiple)</label>
        <input type="file" id="new-images" accept="image/*" multiple>
        <div class="image-preview" id="image-preview"></div>
      </div>
      <button class="primary" onclick="addListing()">Submit Listing</button>
      <button class="secondary" onclick="document.getElementById('add-listing-form').style.display='none'">Cancel</button>
    </div>
    <h3 style="margin:1.5rem 0 0.5rem;">Your Listings</h3>
    <div id="my-listings" class="listings-grid">Loading...</div>
  `;
}

window.showAddListingForm = () => {
  document.getElementById('add-listing-form').style.display = 'block';
  const fileInput = document.getElementById('new-images');
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      const files = Array.from(e.target.files);
      const preview = document.getElementById('image-preview');
      preview.innerHTML = '';
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          preview.innerHTML += `<img src="${e.target.result}" alt="preview">`;
        };
        reader.readAsDataURL(file);
      });
    });
  }
};

window.addListing = async () => {
  const user = window.auth.currentUser;
  if (!user) {
    alert('You must be logged in.');
    return;
  }

  // Limit check (admin bypass)
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
  const imageFiles = document.getElementById('new-images').files;

  if (!title || !location) {
    alert('Title and location are required.');
    return;
  }

  // Disable button to prevent double submission
  const submitBtn = document.querySelector('#add-listing-form button.primary');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading…';
  }

  // Upload images to Cloudinary via Vercel endpoint
  let imageURLs = [];
  try {
    if (imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = async (e) => {
            try {
              const response = await fetch('https://house-finder-mu.vercel.app/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: e.target.result })
              });
              const data = await response.json();
              if (data.url) {
                imageURLs.push(data.url);
                resolve();
              } else {
                reject(new Error(data.error || 'Upload failed'));
              }
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
      }
    }

    // Save listing to Firestore
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

    // Increment user's listing count
    await updateDoc(doc(window.db, 'users', user.uid), {
      listingCount: increment(1)
    });

    document.getElementById('add-listing-form').style.display = 'none';
    showSection('dashboard');  // refresh dashboard
  } catch (error) {
    alert('Error: ' + error.message);
    console.error(error);
  } finally {
    // Re-enable button
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Listing';
    }
  }
};

// ================= LOAD MY LISTINGS (dashboard) =================
async function loadMyListings() {
  const container = document.getElementById('my-listings');
  if (!container) return;
  const user = window.auth.currentUser;
  if (!user) {
    container.innerHTML = '<p>Please log in to see your listings.</p>';
    return;
  }

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
        ${l.images && l.images.length > 0
          ? `<img src="${l.images[0]}" alt="${l.title}">`
          : `<div style="height:140px;background:#dfe6e9;display:flex;align-items:center;justify-content:center;">
              <span style="color:#b2bec3;">No Image</span></div>`}
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
          <button class="secondary" onclick="toggleListing('${l.id}', ${!l.active})">
            ${l.active ? 'Mark as Rented' : 'Mark as Available'}
          </button>
          ${!l.featured ? `
            <a href="https://wa.me/${YOUR_WHATSAPP_NUMBER}?text=I want to make my listing featured: ${l.title} (${l.id})" target="_blank" class="wa-btn" style="padding:0.3rem 0.6rem; font-size:0.8rem;">⭐ Get Featured</a>
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
  loadListings();  // refresh home listings if visible
};

// ================= HELPERS =================
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