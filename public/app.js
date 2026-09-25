import { supabase } from './supabase-client.js';

// ---- GLOBAL STATE ----
window.currentSection = 'home';
window.currentCategoryFilter = '';
window.selectedFormFiles = [];

// ---- CONFIG ----
const APP_NAME = 'HouseFinder';

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
    <div class="featured-slider-container" id="premium-hero-showcase" style="overflow: hidden; margin-bottom: 1.5rem; border-radius: 12px; background: #0f172a;">
      <div class="slider-wrapper" id="hero-slider-track" style="position: relative; width: 100%; height: 100%;"></div>
      <div class="slider-dots-container" id="hero-dots" style="text-align: center; padding: 0.5rem;"></div>
    </div>

    <h2 style="margin-bottom:0.5rem; margin-top: 2rem; color: #e2e8f0;">Find Your Next Home</h2>
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
    <div class="search-area" style="margin-top:1rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
      <input type="text" id="searchLocation" placeholder="Location (e.g., Makindye)" style="flex: 1; min-width: 150px;">
      <input type="number" id="maxPrice" placeholder="Max price (UGX/month)" style="flex: 1; min-width: 150px;">
      <select id="searchBedrooms" style="flex: 1; min-width: 120px; padding: 0.5rem; border-radius: 6px; border: 1px solid #334155; background: #1e293b; color: #f1f5f9;">
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
  `;
  const tryLoad = () => {
    if (document.getElementById('listings-container')) {
      loadListings('', '', '');
      loadFeaturedHeroShowcase();
    } else {
      setTimeout(tryLoad, 50);
    }
  };
  setTimeout(tryLoad, 150);
  return html;
}

// Cinematic featured slider — uses "spotlight" field
async function loadFeaturedHeroShowcase() {
  const track = document.getElementById('hero-slider-track');
  const dotsContainer = document.getElementById('hero-dots');
  if (!track) return;

  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, location, price, images')
      .eq('active', true)
      .eq('status', 'published')
      .eq('spotlight', true)
      .limit(5);

    if (error) throw error;

    if (!data || data.length === 0) {
      document.getElementById('premium-hero-showcase').style.display = 'none';
      return;
    }

    let slidesHTML = data.map((item, index) => {
      const bgImage = (item.images && item.images.length > 0) ? item.images[0] : '';
      return `
        <div class="showcase-slide ${index === 0 ? 'active' : ''}"
             onclick="openDetailModal('${item.id}')"
             style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background: linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 100%),
                    url('${bgImage}') center/cover no-repeat;
                    display: ${index === 0 ? 'flex' : 'none'}; align-items: flex-end;
                    padding: 2rem; cursor: pointer; border-radius: 12px; transition: opacity 0.8s ease;">
          <div style="color: white; max-width: 600px;">
            <span style="background: #8b5cf6; padding: 0.2rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">SPOTLIGHT</span>
            <h2 style="font-size: clamp(1.2rem, 4vw, 1.8rem); margin: 0.5rem 0 0.2rem;">${item.title || 'Exclusive Property'}</h2>
            <p style="font-size: 0.9rem; opacity: 0.9; margin: 0;">${item.location || 'Kampala'} • ${item.price ? item.price.toLocaleString() : 'N/A'} UGX/mo</p>
          </div>
        </div>
      `;
    }).join('');

    track.innerHTML = slidesHTML;

    let dotsHTML = data.map((_, idx) =>
      `<span class="hero-dot ${idx === 0 ? 'active' : ''}" onclick="goToHeroSlide(${idx})" style="display: inline-block; width: 10px; height: 10px; background: ${idx === 0 ? '#8b5cf6' : '#555'}; border-radius: 50%; margin: 0 4px; cursor: pointer;"></span>`
    ).join('');
    if (dotsContainer) dotsContainer.innerHTML = dotsHTML;

    let activeIndex = 0;
    const slides = track.querySelectorAll('.showcase-slide');
    const dots = dotsContainer?.querySelectorAll('.hero-dot') || [];
    if (slides.length > 1) {
      setInterval(() => {
        slides[activeIndex].style.display = 'none';
        dots[activeIndex].style.background = '#555';
        activeIndex = (activeIndex + 1) % slides.length;
        slides[activeIndex].style.display = 'flex';
        dots[activeIndex].style.background = '#8b5cf6';
      }, 4000);
    }

    window.goToHeroSlide = (index) => {
      slides.forEach((s, i) => {
        s.style.display = (i === index) ? 'flex' : 'none';
        if (dots[i]) dots[i].style.background = (i === index) ? '#8b5cf6' : '#555';
      });
      activeIndex = index;
    };

  } catch (err) {
    console.error('Slider loading error:', err);
  }
}

function generateListingCardsHTML(listingsArray) {
  return listingsArray.map(l => `
    <div class="listing-card ${l.featured ? 'featured' : ''}">
      <div class="listing-image-wrapper" onclick="openDetailModal('${l.id}')">
        ${l.images && l.images.length > 0
          ? `<img src="${l.images[0]}" alt="${l.title}">`
          : `<div style="height:140px;background:#1e293b;display:flex;align-items:center;justify-content:center;">
              <span style="color:#64748b;">No Image</span></div>`}
        ${l.images && l.images.length > 1 ? `<span class="photo-count">${l.images.length} photos</span>` : ''}
      </div>
      <div class="card-body">
        <div class="badge-group">
          ${l.featured ? '<span class="badge badge-featured">Featured</span>' : ''}
          ${l.verified ? '<span class="badge badge-verified">Verified</span>' : ''}
          ${l.spotlight ? '<span class="badge" style="background:#8b5cf6;">Spotlight</span>' : ''}
        </div>
        <span class="category-badge">${formatCategory(l.category)}</span>
        <h3>${l.title || 'Untitled'} - ${l.bedrooms || 0} Bd</h3>
        <p>${l.location || 'N/A'}</p>
        <p class="price">${l.price != null ? l.price.toLocaleString() + ' UGX/month' : 'Price not set'}</p>
        <p class="views">${l.views || 0} views</p>
        <div class="card-actions">
          <button class="secondary" onclick="openDetailModal('${l.id}')">View</button>
          ${l.landlord_whatsapp ?
            `<a href="https://wa.me/${l.landlord_whatsapp}?text=Hi,%20I'm%20interested%20in%20your%20property:%20${encodeURIComponent(l.title || '')}" target="_blank" class="wa-btn">Chat</a>`
            : `<span>${l.landlord_phone || 'N/A'}</span>`
          }
        </div>
      </div>
    </div>
  `).join('');
}

async function loadListings(locationFilter = '', maxPriceFilter = '', bedroomsFilter = '') {
  const container = document.getElementById('listings-container');
  if (!container) return;

  let query = supabase
    .from('listings')
    .select('id, title, description, category, location, price, bedrooms, images, featured, verified, spotlight, views, active, landlord_whatsapp, landlord_phone, status')
    .eq('active', true)
    .eq('status', 'published')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20);

  const catFilter = window.currentCategoryFilter || '';
  if (catFilter) query = query.eq('category', catFilter);

  if (locationFilter) {
    query = query.ilike('location', `%${locationFilter}%`);
  }
  if (maxPriceFilter) {
    query = query.lte('price', parseInt(maxPriceFilter));
  }
  if (bedroomsFilter !== '') {
    const bCount = parseInt(bedroomsFilter);
    if (bCount === 4) {
      query = query.gte('bedrooms', 4);
    } else {
      query = query.eq('bedrooms', bCount);
    }
  }

  try {
    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No listings found. Try a different filter.</p>';
      return;
    }

    container.innerHTML = generateListingCardsHTML(data);
  } catch (error) {
    container.innerHTML = `<p class="error">Error loading listings: ${error.message}</p>`;
    console.error(error);
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

// ================= LANDLORD DASHBOARD =================
async function getDashboardHTML() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return '<p>Please login first.</p>';

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name, phone')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return '<p class="error">Could not load your profile. Please try again.</p>';
  }

  if (profile.role !== 'landlord' && profile.role !== 'agent') {
    return '<p class="error">Access denied. Only landlords and agents can view this page.</p>';
  }

  const { data: myListings, error: listingsError } = await supabase
    .from('listings')
    .select('id, title, views, active, featured, verified, spotlight, status')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });

  let totalViews = 0;
  let mostPopularProperty = 'No active properties';
  let maxViews = -1;

  if (!listingsError && myListings) {
    myListings.forEach(l => {
      const views = l.views || 0;
      totalViews += views;
      if (views > maxViews) {
        maxViews = views;
        mostPopularProperty = l.title || 'Untitled Property';
      }
    });
    if (myListings.length === 0) mostPopularProperty = 'No active properties';
  }

  return `
    <h2>Welcome, ${profile.full_name || 'Landlord'}!</h2>

    <div class="analytics-row" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; margin-top: 0.5rem;">
      <div style="background: #1e293b; color: #f1f5f9; padding: 1.25rem; border-radius: 12px; border-left: 5px solid #10b981; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: center;">
        <span style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600;">Total Portfolio Views</span>
        <strong style="font-size: 1.8rem; color: #10b981; margin-top: 0.2rem;">${totalViews.toLocaleString()}</strong>
      </div>

      <div style="background: #1e293b; color: #f1f5f9; padding: 1.25rem; border-radius: 12px; border-left: 5px solid #3b82f6; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: center;">
        <span style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600;">Most Popular Property</span>
        <strong style="font-size: 1.1rem; color: #f1f5f9; margin-top: 0.4rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${mostPopularProperty}">
          ${mostPopularProperty}
        </strong>
        ${maxViews > -1 ? `<span style="font-size: 0.75rem; color: #3b82f6; font-weight: bold; margin-top: 0.1rem;">(${maxViews} views)</span>` : ''}
      </div>

      <div style="background: #1e293b; color: #f1f5f9; padding: 1.25rem; border-radius: 12px; border-left: 5px solid #f59e0b; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: center;">
        <span style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600;">Total Listings</span>
        <strong style="font-size: 1.5rem; color: #f59e0b; margin-top: 0.2rem;">${myListings?.length || 0}</strong>
      </div>
    </div>

    <button class="primary" onclick="showAddListingForm()">+ Add New Listing</button>

    <div id="add-listing-form" class="dashboard-form" style="display:none;">
      <h3>New Listing</h3>
      <div class="form-group"><label>Title</label><input id="new-title" placeholder="e.g., Cozy 2BR in Central Division"></div>
      <div class="form-group"><label>Location</label><input id="new-location" placeholder="e.g., Makindye"></div>
      <div class="form-group"><label>Category</label>
        <select id="new-category">
          <option value="apt_furnished">Apartment - Furnished</option>
          <option value="apt_unfurnished">Apartment - Unfurnished</option>
          <option value="single_room">Single Room</option>
          <option value="house">Full House</option>
          <option value="hostel">Hostel / Boarding</option>
          <option value="commercial">Commercial / Office Space</option>
          <option value="land">Land for Rent</option>
        </select>
      </div>
      <div class="form-group"><label>Bedrooms</label><input id="new-bedrooms" type="number" value="1"></div>
      <div class="form-group"><label>Price (UGX/month)</label><input id="new-price" type="number" value="500000"></div>
      <div class="form-group"><label>Landlord Name</label><input id="new-landlord-name" placeholder="Your name"></div>
      <div class="form-group"><label>Landlord Phone</label><input id="new-landlord-phone" placeholder="e.g., 0775989760"></div>
      <div class="form-group"><label>WhatsApp Number (optional, e.g., 256712345678)</label><input id="new-whatsapp" type="text" placeholder="256..."></div>
      <div class="form-group"><label>Description</label><textarea id="new-description"></textarea></div>

      <div class="form-group">
        <label>Property Photos</label>
        <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
          <input type="file" id="new-images" accept="image/*" style="display: none;">
          <button type="button" class="secondary" style="margin: 0; padding: 0.5rem 1rem;" onclick="document.getElementById('new-images').click()">Choose Photo</button>
          <span id="photo-count-badge" style="font-size: 0.9rem; color: #94a3b8; font-weight: 600;">0 photos selected</span>
        </div>
        <div class="image-preview" id="image-preview" style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px;"></div>
      </div>

      <button class="primary" onclick="addListing()">Submit Listing</button>
      <button class="secondary" onclick="document.getElementById('add-listing-form').style.display='none'">Cancel</button>
    </div>
    <h3 style="margin:1.5rem 0 0.5rem; color: #e2e8f0;">Your Listings</h3>
    <div id="my-listings" class="listings-grid">Loading...</div>
  `;
}

// ================= MULTI-IMAGE HANDLERS =================
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
            <div id="prev-card-${currentIdx}" style="position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
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

window.addListing = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { alert('You must be logged in.'); return; }

  const title = document.getElementById('new-title').value.trim();
  const location = document.getElementById('new-location').value.trim();
  const category = document.getElementById('new-category').value;
  const bedrooms = parseInt(document.getElementById('new-bedrooms').value) || 0;
  const price = parseInt(document.getElementById('new-price').value) || 0;
  const landlordName = document.getElementById('new-landlord-name').value.trim();
  const landlordPhone = document.getElementById('new-landlord-phone').value.trim();
  const landlordWhatsApp = document.getElementById('new-whatsapp').value.trim();
  const description = document.getElementById('new-description').value.trim();

  if (!title || !location) { alert('Title and location are required.'); return; }

  const validFiles = window.selectedFormFiles.filter(file => file !== null);

  const submitBtn = document.querySelector('#add-listing-form button.primary');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Uploading images (0/' + validFiles.length + ')...'; }

  let imageURLs = [];

  try {
    if (validFiles.length > 0) {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        if (submitBtn) submitBtn.textContent = `Uploading photo ${i + 1} of ${validFiles.length}...`;

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
          throw new Error(`Pipeline rejected image index ${i + 1}. Server status code: ${response.status}`);
        }

        const data = await response.json();
        if (data.url) {
          imageURLs.push(data.url);
        } else {
          throw new Error(data.error || `Upload error at position ${i}`);
        }
      }
    }

    if (submitBtn) submitBtn.textContent = 'Saving Listing Details...';

    const { error: insertError } = await supabase
      .from('listings')
      .insert({
        created_by: user.id,
        title,
        location,
        category,
        bedrooms,
        price,
        description,
        landlord_name: landlordName,
        landlord_phone: landlordPhone,
        landlord_whatsapp: landlordWhatsApp,
        images: imageURLs,
        active: true,
        status: 'pending',
        featured: false,
        verified: false,
        spotlight: false,
        views: 0,
        source_type: 'manual',
        published_at: new Date().toISOString(),
      });

    if (insertError) throw insertError;

    document.getElementById('add-listing-form').style.display = 'none';
    showSection('dashboard');
    alert('Property posted successfully! It will appear publicly once approved.');
  } catch (error) {
    alert('Error: ' + error.message);
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { container.innerHTML = '<p>Please log in to see your listings.</p>'; return; }

  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, location, price, bedrooms, images, featured, verified, spotlight, views, active, status')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<p>You have no listings yet.</p>';
      return;
    }

    container.innerHTML = data.map(l => `
      <div class="listing-card ${l.featured ? 'featured' : ''}">
        <div class="listing-image-wrapper" onclick="openDetailModal('${l.id}')">
          ${l.images && l.images.length > 0
            ? `<img src="${l.images[0]}" alt="${l.title}">`
            : `<div style="height:140px;background:#1e293b;display:flex;align-items:center;justify-content:center;">
                <span style="color:#64748b;">No Image</span></div>`}
          ${l.images && l.images.length > 1 ? `<span class="photo-count">${l.images.length} photos</span>` : ''}
        </div>
        <div class="card-body">
          <div class="badge-group">
            ${l.featured ? '<span class="badge badge-featured">Featured</span>' : ''}
            ${l.verified ? '<span class="badge badge-verified">Verified</span>' : ''}
            ${l.spotlight ? '<span class="badge" style="background:#8b5cf6;">Spotlight</span>' : ''}
          </div>
          <span class="category-badge">${formatCategory(l.category)}</span>
          <h3>${l.title || 'Untitled'} - ${l.bedrooms || 0} Bd</h3>
          <p>${l.location || 'N/A'}</p>
          <p class="price">${l.price != null ? l.price.toLocaleString() + ' UGX/month' : 'Price not set'}</p>
          <p class="views">${l.views || 0} views</p>
          <p>Status: ${l.active ? 'Available' : 'Rented'} (${l.status})</p>
          <div class="card-actions">
            <button class="secondary" onclick="openDetailModal('${l.id}')">View</button>
            <button class="secondary" onclick="toggleListing('${l.id}', ${!l.active})">
              ${l.active ? 'Mark as Rented' : 'Mark as Available'}
            </button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = `<p class="error">Error loading your listings: ${error.message}</p>`;
    console.error(error);
  }
}

window.toggleListing = async (id, newStatus) => {
  const { error } = await supabase
    .from('listings')
    .update({ active: newStatus })
    .eq('id', id);

  if (error) {
    alert('Error updating listing: ' + error.message);
    return;
  }
  loadMyListings();
};

// ================= DETAIL MODAL (IMAGE GALLERY) =================
window.openDetailModal = async (listingId) => {
  const { data: l, error } = await supabase
    .from('listings')
    .select('id, title, description, category, location, price, bedrooms, images, views, landlord_whatsapp, landlord_phone')
    .eq('id', listingId)
    .maybeSingle();

  if (error || !l) return;

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
    imagesHTML = `<div style="height:200px;background:#0f172a;display:flex;align-items:center;justify-content:center;">No Image</div>`;
  }

  const modalHTML = `
    <div id="listing-modal" class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-content" onclick="event.stopPropagation()">
        <span class="modal-close" onclick="closeModal()">&times;</span>
        ${imagesHTML}
        <div class="modal-body">
          <h2>${l.title || 'Untitled'}</h2>
          <p><strong>Location:</strong> ${l.location || 'N/A'}</p>
          <p><strong>Category:</strong> ${formatCategory(l.category)}</p>
          <p><strong>Bedrooms:</strong> ${l.bedrooms || 0}</p>
          <p class="price">${l.price != null ? l.price.toLocaleString() + ' UGX/month' : 'Price not set'}</p>
          <p><strong>Views:</strong> ${l.views || 0}</p>
          <p>${l.description || ''}</p>
          <div class="modal-actions">
            ${l.landlord_whatsapp ?
              `<a href="https://wa.me/${l.landlord_whatsapp}?text=Hi,%20I'm%20interested%20in%20your%20property:%20${encodeURIComponent(l.title || '')}" target="_blank" class="wa-btn">Chat on WhatsApp</a>`
              : `<span>${l.landlord_phone || 'N/A'}</span>`
            }
          </div>
        </div>
      </div>
    </div>
  `;

  const oldModal = document.getElementById('listing-modal');
  if (oldModal) oldModal.remove();
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Increment views
  await supabase
    .from('listings')
    .update({ views: (l.views || 0) + 1 })
    .eq('id', listingId);
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
