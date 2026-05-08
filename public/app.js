import { onSnapshot, collection, addDoc, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Global state
window.currentSection = 'home';

// Routing / section display
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
  
  }
};

// ---- HOME PAGE ----
async function getHomeHTML() {
  // Search filters
  let html = `<h2>Find a House in Uganda</h2>
    <div class="search-area">
      <input type="text" id="searchLocation" placeholder="Location (e.g., Makindye)" style="width:60%">
      <input type="number" id="maxPrice" placeholder="Max price (UGX/month)" style="width:30%">
      <button onclick="searchListings()">Search</button>
    </div>
    <div id="listings-container">Loading...</div>`;

  setTimeout(() => loadListings(''), 100); // initial load all active
  return html;
}

async function loadListings(locationFilter = '', maxPriceFilter = '') {
  const container = document.getElementById('listings-container');
  if (!container) return;
  
  const { getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
  let q = query(collection(window.db, 'listings'), where('active', '==', true));
  if (locationFilter) q = query(q, where('location', '>=', locationFilter), where('location', '<=', locationFilter + '\uf8ff'));
  
  try {
    const snapshot = await getDocs(q);
    let listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (maxPriceFilter) {
      listings = listings.filter(l => l.price <= parseInt(maxPriceFilter));
    }
    if (listings.length === 0) {
      container.innerHTML = '<p>No active listings found. Check back later!</p>';
      return;
    }
    container.innerHTML = listings.map(l => `
      <div class="listing-card">
        <h3>${l.title || l.location} - ${l.bedrooms} Bd</h3>
        <p><strong>Location:</strong> ${l.location}</p>
        <p><strong>Price:</strong> ${l.price.toLocaleString()} UGX/month</p>
        <p><strong>Contact:</strong> ${l.contactEmail || l.contactPhone || 'N/A'}</p>
        <p>${l.description || ''}</p>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = `<p>Error loading listings: ${error.message}</p>`;
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
    <h2>Login</h2>
    <div class="form-group"><label>Email</label><input type="email" id="login-email"></div>
    <div class="form-group"><label>Password</label><input type="password" id="login-password"></div>
    <div id="login-error" class="error"></div>
    <button class="primary" onclick="login(document.getElementById('login-email').value, document.getElementById('login-password').value)">Login</button>
  `;
}

function getSignupHTML() {
  return `
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
  `;
}

// ---- LANDLORD DASHBOARD ----
async function getDashboardHTML() {
  const user = window.auth.currentUser;
  if (!user) return '<p>Please login first.</p>';
  
  // Check role
  const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
  const userDoc = await getDoc(doc(window.db, 'users', user.uid));
  if (!userDoc.exists() || userDoc.data().role !== 'landlord') {
    return '<p>Access denied. This dashboard is for landlords only.</p>';
  }

  return `
    <h2>Welcome, Landlord!</h2>
    <button class="primary" onclick="showAddListingForm()">+ Add New Listing</button>
    <div id="add-listing-form" style="display:none; margin:1rem 0; border:1px solid #ccc; padding:1rem;">
      <h3>New Listing</h3>
      <div class="form-group"><label>Title</label><input id="new-title" placeholder="e.g., Cozy 2BR in Central Division"></div>
      <div class="form-group"><label>Location</label><input id="new-location" placeholder="e.g., Makindye"></div>
      <div class="form-group"><label>Bedrooms</label><input id="new-bedrooms" type="number" value="1"></div>
      <div class="form-group"><label>Price (UGX/month)</label><input id="new-price" type="number" value="500000"></div>
      <div class="form-group"><label>Contact Email</label><input id="new-contact" type="email"></div>
      <div class="form-group"><label>Description</label><textarea id="new-description"></textarea></div>
      <button class="primary" onclick="addListing()">Submit Listing</button>
      <button onclick="document.getElementById('add-listing-form').style.display='none'">Cancel</button>
    </div>
    <h3>Your Listings</h3>
    <div id="my-listings">Loading...</div>
  `;
}

window.showAddListingForm = () => {
  document.getElementById('add-listing-form').style.display = 'block';
};

window.addListing = async () => {
  const user = window.auth.currentUser;
  const title = document.getElementById('new-title').value;
  const location = document.getElementById('new-location').value;
  const bedrooms = parseInt(document.getElementById('new-bedrooms').value);
  const price = parseInt(document.getElementById('new-price').value);
  const contactEmail = document.getElementById('new-contact').value;
  const description = document.getElementById('new-description').value;
  
  try {
    const { addDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    await addDoc(collection(window.db, 'listings'), {
      landlordId: user.uid,
      title, location, bedrooms, price, contactEmail, description,
      active: true,
      createdAt: new Date()
    });
    document.getElementById('add-listing-form').style.display = 'none';
    showSection('dashboard'); // refresh
  } catch (error) {
    alert('Error: ' + error.message);
  }
};

// Load landlord's listings when dashboard is opened
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'dashboard-btn') {
    setTimeout(loadMyListings, 200);
  }
});

async function loadMyListings() {
  const container = document.getElementById('my-listings');
  if (!container) return;
  const user = window.auth.currentUser;
  if (!user) return;
  
  const { getDocs, query, collection, where, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
  const q = query(collection(window.db, 'listings'), where('landlordId', '==', user.uid), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  const listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if (listings.length === 0) {
    container.innerHTML = '<p>You have no listings yet.</p>';
    return;
  }
  container.innerHTML = listings.map(l => `
    <div class="listing-card">
      <h3>${l.title} - ${l.location}</h3>
      <p>Bedrooms: ${l.bedrooms} | Price: ${l.price.toLocaleString()} UGX</p>
      <p>Status: ${l.active ? 'Active' : 'Inactive'}</p>
      <button onclick="toggleListing('${l.id}', ${!l.active})">${l.active ? 'Deactivate' : 'Activate'}</button>
    </div>
  `).join('');
}

window.toggleListing = async (id, newStatus) => {
  const { updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
  await updateDoc(doc(window.db, 'listings', id), { active: newStatus });
  loadMyListings();
  loadListings(); // refresh home listings
};

// On page load show home
showSection('home');