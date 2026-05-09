import { collection, getDocs, query, orderBy, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// ---- Security: only allow your specific admin email ----
const ADMIN_EMAIL = 'kizitofahad665@gmail.com';  // change to your email

onAuthStateChanged(window.auth, async (user) => {
  if (!user || user.email !== ADMIN_EMAIL) {
    document.getElementById('listing-list').innerHTML = '<p class="error">Access denied. Only admin can view this page.</p>';
    return;
  }
  await loadAdminListings();
});

window.logout = async () => {
  await signOut(window.auth);
  window.location.href = 'index.html';
};

async function loadAdminListings() {
  const container = document.getElementById('listing-list');
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
    loadAdminListings(); // refresh
  } catch (error) {
    alert('Error: ' + error.message);
  }
};