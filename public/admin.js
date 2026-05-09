import { collection, getDocs, query, orderBy, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const ADMIN_EMAIL = 'kizitofahad665@gmail.com'.trim();

// Debug helper
function showDebug(msg) {
  const dbg = document.getElementById('debug-info');
  if (dbg) dbg.textContent = msg;
}

// Login handler for admin page
window.adminLogin = async () => {
  const email = document.getElementById('admin-email')?.value.trim();
  const password = document.getElementById('admin-password')?.value;
  if (!email || !password) {
    alert('Enter email and password');
    return;
  }
  try {
    await signInWithEmailAndPassword(window.auth, email, password);
    // after login the onAuthStateChanged will trigger and load admin panel
  } catch (error) {
    alert('Login failed: ' + error.message);
  }
};

window.logout = async () => {
  await signOut(window.auth);
  document.getElementById('login-section')?.style?.setProperty('display', 'block');
  document.getElementById('admin-panel')?.style?.setProperty('display', 'none');
  document.getElementById('listing-list').innerHTML = '';
  showDebug('Logged out');
};

onAuthStateChanged(window.auth, async (user) => {
  const loginSection = document.getElementById('login-section');
  const adminPanel = document.getElementById('admin-panel');
  const listingContainer = document.getElementById('listing-list');

  if (!user) {
    // Not logged in – show login form
    showDebug('Not logged in. Please sign in with admin email.');
    if (loginSection) loginSection.style.display = 'block';
    if (adminPanel) adminPanel.style.display = 'none';
    if (listingContainer) listingContainer.innerHTML = '';
    return;
  }

  // Show debug info
  const msg = `Logged in as: ${user.email} (Admin required: ${ADMIN_EMAIL})`;
  showDebug(msg);

  if (user.email !== ADMIN_EMAIL) {
    if (loginSection) loginSection.style.display = 'block';
    if (adminPanel) adminPanel.style.display = 'none';
    if (listingContainer) listingContainer.innerHTML = '<p class="error">Access denied. Only admin can view this page.</p>';
    return;
  }

  // Authorized admin
  if (loginSection) loginSection.style.display = 'none';
  if (adminPanel) adminPanel.style.display = 'block';
  await loadAdminListings();
});

async function loadAdminListings() {
  const container = document.getElementById('listing-list');
  if (!container) return;
  try {
    const q = query(collection(window.db, 'listings'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (listings.length === 0) {
      container.innerHTML = '<p>No listings found.</p>';
      return;
    }
    container.innerHTML = listings.map(l => `
      <div class="admin-card">
        <div>
          <strong>${l.title || 'Untitled'}</strong><br>
          <small>${l.location} | ${l.price?.toLocaleString()} UGX</small><br>
          <small>ID: ${l.id}</small>
        </div>
        <div class="toggle-group">
          <button class="toggle-btn ${l.featured ? 'on' : 'off'}" 
                  onclick="toggleField('${l.id}', 'featured', ${!l.featured})">
            ${l.featured ? '⭐ Featured' : '★ Feature'}
          </button>
          <button class="toggle-btn ${l.verified ? 'on' : 'off'}" 
                  onclick="toggleField('${l.id}', 'verified', ${!l.verified})">
            ${l.verified ? '✅ Verified' : '✓ Verify'}
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = `<p class="error">Error: ${error.message}</p>`;
  }
}

window.toggleField = async (listingId, field, newValue) => {
  try {
    const ref = doc(window.db, 'listings', listingId);
    await updateDoc(ref, { [field]: newValue });
    loadAdminListings();
  } catch (error) {
    alert('Error: ' + error.message);
  }
};