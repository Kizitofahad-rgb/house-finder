import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Expose auth functions globally
window.signup = async (email, password, role) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(window.auth, email, password);
    const user = userCredential.user;
    // Save user role in Firestore
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    await setDoc(doc(window.db, 'users', user.uid), { email, role });
    showSection('home');
  } catch (error) {
    const signupError = document.getElementById('signup-error');
    if (signupError) signupError.textContent = error.message;
  }
};

window.login = async (email, password) => {
  try {
    await signInWithEmailAndPassword(window.auth, email, password);
    showSection('home');
  } catch (error) {
    const loginError = document.getElementById('login-error');
    if (loginError) loginError.textContent = error.message;
  }
};

window.logout = async () => {
  await signOut(window.auth);
};

// Listen to auth state securely with element guard checks
onAuthStateChanged(window.auth, (user) => {
  const guestLinks = document.getElementById('guest-links');
  const userLinks = document.getElementById('user-links');
  const dashboardBtn = document.getElementById('dashboard-btn');

  if (user) {
    // Only execute styles if the UI navigation components exist on the current viewport
    if (guestLinks) guestLinks.style.display = 'none';
    if (userLinks) userLinks.style.display = 'inline';
    
    // Fetch role and decide if dashboard should show
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js').then(({ doc, getDoc }) => {
      getDoc(doc(window.db, 'users', user.uid)).then(docSnap => {
        if (docSnap.exists() && docSnap.data().role === 'landlord') {
          if (dashboardBtn) dashboardBtn.style.display = 'inline-block';
        } else {
          if (dashboardBtn) dashboardBtn.style.display = 'none';
        }
      });
    });
  } else {
    if (guestLinks) guestLinks.style.display = 'inline';
    if (userLinks) userLinks.style.display = 'none';
  }

  // Redraw current section safely if available
  if (window.currentSection && typeof showSection === 'function') {
    showSection(window.currentSection);
  }
});