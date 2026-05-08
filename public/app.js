import {
  collection, addDoc, getDocs, query, where, orderBy,
  doc, getDoc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

window.currentSection = 'home';

// ---- Navigation / Section Router ----
window.showSection = async (section) => {
  window.currentSection = section;
  const app = document.getElementById('app');
  switch (section) {
    case 'home': app.innerHTML = await getHomeHTML(); break;
    case 'login': app.innerHTML = getLoginHTML(); break;
    case 'signup': app.innerHTML = getSignupHTML(); break;
    case 'dashboard':
      app.innerHTML = await getDashboardHTML();
      loadMyListings(); // load own listings immediately
      break;
  }
};

// ---- HOME PAGE ----
async function getHomeHTML() {
  return `
    <h2 style="margin-bottom:1.5rem;">Find Your Next Home</h2>
    <div class="search-area">
      <input type="text" id="searchLocation" placeholder="Location (e.g., Makindye)">
      <input type="number" id="maxPrice" placeholder="Max price (UGX/month)">
      <button onclick="searchListings()">Search</button>
    </div>
    <div id="listings-container">Loading...</div>
  `;
  setTimeout(() => loadListings(''), 100);
}

async function loadListings(locationFilter = '', maxPriceFilter = '') {
  const container = document.getElementById('listings-container');
  if (!container) return;
  
  let q = query(collection(window.db, 'listings'), where('active', '==', true));
  if (locationFilter) {
    q = query(q, where('location', '>=', locationFilter),
              where('location', '<=', locationFilter + '\uf8ff'));
  }
  
  try {
    const snapshot = await getDocs(q);
    let listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (maxPriceFilter) {
      listings = listings.filter(l => l.price <= parseInt(maxPriceFilter));
    }
    if (listings.length === 0) {
      container.innerHTML = '<p>No listings found. Be the first!</p>';
      return;
    }
    container.innerHTML = listings.map(l => `
      <div class="listing-card">
        ${l.images && l.images.length > 0
          ? `<img src="${l.images[0]}" alt="${l.title}">`
          : `<div style="height:200px;background:#dfe6e9;display:flex;align-items:center;justify-content:center;">
              <span style="color:#b2bec3;">No Image</span></div>`}
        <div class="card-body">
          <h3>${l.title} - ${l.bedrooms} Bd</h3>
          <p><strong>📍</strong> ${l.location}</p>
          <p class="price">${l.price.toLocaleString()} UGX/month</p>
          <p><strong>📞</strong> ${l.contactEmail || 'N/A'}</p>
          <p>${l.description || ''}</p>
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = `<p class="error">Error: ${error.message}</p>`;
  }
}

window.searchListings = () => {
  const location = document.getElementById('searchLocation')?.value || '';
  const maxPrice = document.getElementById('maxPrice')?.value || '';
  loadListings(location, maxPrice);
};

// ---- AUTH FORMS ----
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

// ---- LANDLORD DASHBOARD ----
async function getDashboardHTML() {
  const user = window.auth.currentUser;
  if (!user) return '<p>Please login first.</p>';
  
  const userDoc = await getDoc(doc(window.db, 'users', user.uid));
  if (!userDoc.exists() || userDoc.data().role !== 'landlord') {
    return '<p class="error">Access denied. Only landlords can view this page.</p>';
  }

  return `
    <h2>Welcome, Landlord!</h2>
    <button class="primary" onclick="showAddListingForm()">+ Add New Listing</button>
    <div id="add-listing-form" class="dashboard-form" style="display:none;">
      <h3>New Listing</h3>
      <div class="form-group"><label>Title</label><input id="new-title" placeholder="e.g., Cozy 2BR in Central Division"></div>
      <div class="form-group"><label>Location</label><input id="new-location" placeholder="e.g., Makindye"></div>
      <div class="form-group"><label>Bedrooms</label><input id="new-bedrooms" type="number" value="1"></div>
      <div class="form-group"><label>Price (UGX/month)</label><input id="new-price" type="number" value="500000"></div>
      <div class="form-group"><label>Contact Email</label><input id="new-contact" type="email"></div>
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
    <div id="my-listings">Loading...</div>
  `;
}

window.showAddListingForm = () => {
  document.getElementById('add-listing-form').style.display = 'block';
  const fileInput = document.getElementById('new-images');
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
};

window.addListing = async () => {
  const user = window.auth.currentUser;
  if (!user) {
    alert('You must be logged in as a landlord.');
    return;
  }

  const title = document.getElementById('new-title').value.trim();
  const location = document.getElementById('new-location').value.trim();
  const bedrooms = parseInt(document.getElementById('new-bedrooms').value);
  const price = parseInt(document.getElementById('new-price').value);
  const contactEmail = document.getElementById('new-contact').value.trim();
  const description = document.getElementById('new-description').value.trim();
  const imageFiles = document.getElementById('new-images').files;

  if (!title || !location) {
    alert('Title and location are required.');
    return;
  }

  // Upload images to Cloudinary (with error handling)
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
                console.log('Uploaded image:', data.url); // for debugging
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
  } catch (uploadError) {
    alert('Image upload failed: ' + uploadError.message);
    console.error(uploadError);
    return; // stop the whole listing process
  }

  // Save listing to Firestore
  try {
    await addDoc(collection(window.db, 'listings'), {
      landlordId: user.uid,
      title, location, bedrooms, price, contactEmail, description,
      images: imageURLs,
      active: true,
      createdAt: new Date()
    });
    document.getElementById('add-listing-form').style.display = 'none';
    showSection('dashboard'); // refresh dashboard
  } catch (error) {
    alert('Error saving listing: ' + error.message);
    console.error(error);
  }
};

// ---- Load own listings ----
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
      <div class="listing-card">
        ${l.images && l.images.length > 0
          ? `<img src="${l.images[0]}" alt="${l.title}">`
          : `<div style="height:150px;background:#dfe6e9;display:flex;align-items:center;justify-content:center;">
              <span style="color:#b2bec3;">No Image</span></div>`}
        <div class="card-body">
          <h3>${l.title} - ${l.location}</h3>
          <p>Bedrooms: ${l.bedrooms} | Price: ${l.price.toLocaleString()} UGX</p>
          <p>Status: ${l.active ? '✅ Active' : '⛔ Inactive'}</p>
          <button class="secondary" onclick="toggleListing('${l.id}', ${!l.active})">
            ${l.active ? 'Deactivate' : 'Activate'}
          </button>
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
  loadListings(); // refresh home listings if visible
};

// On page load show home
showSection('home');