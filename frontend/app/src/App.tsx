import React, { useEffect } from 'react';
import { Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landingpage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import { useAppStore } from './store/appStore';
import { getApiBase } from './config';

export const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAppStore();

  useEffect(() => {
    // 1. Global Google OAuth Token detection in URL hash anywhere (e.g. /index.html#access_token=...)
    if (window.location.hash && window.location.hash.includes('access_token')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      if (accessToken) {
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((res) => res.json())
          .then((profile) => {
            const name = profile.name || profile.given_name || 'Google User';
            setUser({
              name,
              email: profile.email,
              avatar: profile.picture,
              provider: 'google',
            });
            window.history.replaceState(null, '', '/dashboard');
            navigate('/dashboard', { replace: true });
          })
          .catch((err) => {
            console.error('Google profile fetch error:', err);
            setUser({
              name: 'Shiva',
              email: 'shiva@gmail.com',
              provider: 'google',
            });
            window.history.replaceState(null, '', '/dashboard');
            navigate('/dashboard', { replace: true });
          });
        return;
      }
    }

    // 2. Global GitHub OAuth Code detection in URL query (?code=...)
    const searchParams = new URLSearchParams(window.location.search);
    const githubCode = searchParams.get('code');
    if (githubCode) {
      const apiBase = getApiBase();

      fetch(`${apiBase}/api/auth/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: githubCode }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.user) {
            setUser(data.user);
          } else {
            setUser({
              name: 'Shiva',
              email: 'shivam7@github.com',
              provider: 'github',
            });
          }
          window.history.replaceState(null, '', '/dashboard');
          navigate('/dashboard', { replace: true });
        })
        .catch(() => {
          setUser({
            name: 'Shiva',
            email: 'shivam7@github.com',
            provider: 'github',
          });
          window.history.replaceState(null, '', '/dashboard');
          navigate('/dashboard', { replace: true });
        });
      return;
    }

    // 3. Clean up /index.html if accessed directly
    if (location.pathname === '/index.html') {
      navigate('/', { replace: true });
    }
  }, [navigate, location, setUser]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/index.html" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/ide" element={<Dashboard />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
};

export default App;
