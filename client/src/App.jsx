import { useState, useEffect, useCallback } from 'react';
import { checkAuth, login, logout, getFriends, getEvents } from './api.js';
import Header from './components/Header.jsx';
import Graph from './components/Graph.jsx';
import FriendPanel from './components/FriendPanel.jsx';
import LogModal from './components/LogModal.jsx';

export default function App() {
  const [authenticated, setAuthenticated] = useState(null);
  const [friends, setFriends] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [f, e] = await Promise.all([getFriends(), getEvents()]);
      setFriends(f);
      setEvents(e);
      // If a friend is selected, update their data
      if (selectedFriend) {
        const updated = f.find((fr) => fr.id === selectedFriend.id);
        if (updated) setSelectedFriend(updated);
        else setSelectedFriend(null);
      }
    } catch {
      // handled by 401 listener
    }
  }, [selectedFriend]);

  useEffect(() => {
    checkAuth()
      .then((res) => {
        setAuthenticated(res.authenticated);
        if (res.authenticated) refresh();
      })
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    const handler = () => setAuthenticated(false);
    window.addEventListener('unauthorized', handler);
    return () => window.removeEventListener('unauthorized', handler);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await login(loginPassword);
      setAuthenticated(true);
      setLoginPassword('');
      refresh();
    } catch {
      setLoginError('Invalid password');
    }
  };

  const handleLogout = async () => {
    await logout();
    setAuthenticated(false);
    setFriends([]);
    setEvents([]);
  };

  if (authenticated === null) return null; // loading

  if (!authenticated) {
    return (
      <div className="login-container">
        <form className="login-box glass-bright" onSubmit={handleLogin}>
          <h1>&#x2B21; Social Orbit</h1>
          <p>Enter your password to continue</p>
          {loginError && <div className="login-error">{loginError}</div>}
          <input
            type="password"
            placeholder="Password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary">
            Log In
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Header
        friends={friends}
        events={events}
        onLogHangout={() => setShowLogModal(true)}
        onLogout={handleLogout}
        onExport={null}
      />
      <div className="app-main">
        <Graph
          friends={friends}
          events={events}
          onSelectFriend={(f) => setSelectedFriend(f)}
          selectedFriend={selectedFriend}
        />
        <div className="panel-overlay">
          <div
            className={`panel-backdrop ${selectedFriend ? 'visible' : ''}`}
            onClick={() => setSelectedFriend(null)}
          />
          <FriendPanel
            friend={selectedFriend}
            onClose={() => setSelectedFriend(null)}
            onRefresh={refresh}
          />
        </div>
      </div>
      {showLogModal && (
        <LogModal
          friends={friends}
          onClose={() => setShowLogModal(false)}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
