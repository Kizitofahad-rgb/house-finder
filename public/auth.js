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
    document.getElementById('signup-error').textContent = error.message;
  }
};

window.login = async (email, password) => {
  try {
    await signInWithEmailAndPassword(window.auth, email, password);
    showSection('home');
  } catch (error) {
    document.getElementById('login-error').textContent = error.message;
  }
};

window.logout = async () => {
  await signOut(window.auth);
};

// Listen to auth state
onAuthStateChanged(window.auth, (user) => {
  const guestLinks = document.getElementById('guest-links');
  const userLinks = document.getElementById('user-links');
  const dashboardBtn = document.getElementById('dashboard-btn');
  if (user) {
    guestLinks.style.display = 'none';
    userLinks.style.display = 'inline';
    // Fetch role and decide if dashboard should show
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js').then(({ doc, getDoc }) => {
      getDoc(doc(window.db, 'users', user.uid)).then(docSnap => {
        if (docSnap.exists() && docSnap.data().role === 'landlord') {
          dashboardBtn.style.display = 'inline-block';
        } else {
          dashboardBtn.style.display = 'none';
        }
      });
    });
  } else {
    guestLinks.style.display = 'inline';
    userLinks.style.display = 'none';
  }
  // Redraw current section if needed
  if (window.currentSection) showSection(window.currentSection);
});