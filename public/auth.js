import { supabase } from './supabase-client.js';

window.signup = async (email, password, role) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
      },
    });

    if (error) throw error;

    if (data.user) {
      showSection('home');
    }
  } catch (error) {
    const signupError = document.getElementById('signup-error');
    if (signupError) signupError.textContent = error.message;
  }
};

window.login = async (email, password) => {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    showSection('home');
  } catch (error) {
    const loginError = document.getElementById('login-error');
    if (loginError) loginError.textContent = error.message;
  }
};

window.logout = async () => {
  await supabase.auth.signOut();
  window.location.reload();
};

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, full_name, phone')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', error.message);
    return null;
  }
  return data;
}

window.getCurrentUser = () => supabase.auth.getUser();

window.getCurrentProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return fetchProfile(user.id);
};

supabase.auth.onAuthStateChange((event, session) => {
  (async () => {
    const linksContainer = document.getElementById('nav-links');
    if (!linksContainer) return;

    if (session?.user) {
      const profile = await fetchProfile(session.user.id);
      const role = profile?.role || 'seeker';

      linksContainer.innerHTML = `
        <button onclick="showSection('home')">Home</button>
        ${role === 'landlord' || role === 'agent' ? `<button id="dashboard-btn" onclick="showSection('dashboard')">Dashboard</button>` : ''}
        <button onclick="window.logout()">Logout</button>
      `;
    } else {
      linksContainer.innerHTML = `
        <button onclick="showSection('home')">Home</button>
        <button onclick="showSection('login')">Login</button>
        <button onclick="showSection('signup')">Sign Up</button>
      `;
    }

    if (window.currentSection && typeof showSection === 'function') {
      showSection(window.currentSection);
    }
  })();
});
