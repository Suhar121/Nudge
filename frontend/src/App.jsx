import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus,
  Check,
  X,
  Users,
  BarChart2,
  Home,
  Send,
  Search,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { urlBase64ToUint8Array } from './utils';

const API_URL = 'http://localhost:3001/api';
const VAPID_PUBLIC_KEY = 'BHY2DeQsRFmrzUQHFn-1SZCsLTyT-2txyH50iIkYxwvjhiEZPakdObrtG4fPylncwjGN8Hc2qCakxcdnBTSmq8w';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('welcome');
  const [reminders, setReminders] = useState([]);
  const [connections, setConnections] = useState([]);
  const [stats, setStats] = useState({ done: 0, ignored: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('nudge_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setScreen('dashboard');
      fetchData(parsedUser.username);
      setupNotifications(parsedUser.username);
    }
  }, []);

  // Real-time updates (Polling for simplicity in MVP)
  useEffect(() => {
    if (user && screen === 'dashboard') {
      const interval = setInterval(() => {
        fetchData(user.username);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user, screen]);

  const fetchData = async (username) => {
    try {
      const [remRes, connRes, statRes] = await Promise.all([
        axios.get(`${API_URL}/reminders/${username}`),
        axios.get(`${API_URL}/connections/${username}`),
        axios.get(`${API_URL}/stats/${username}`)
      ]);
      setReminders(remRes.data);
      setConnections(connRes.data);
      setStats(statRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const setupNotifications = async (username) => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        await axios.post(`${API_URL}/subscribe`, { username, subscription });
      } catch (err) {
        console.error('Push notification setup failed:', err);
      }
    }
  };

  const handleLogin = async (username) => {
    if (!username) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/users`, { username });
      localStorage.setItem('nudge_user', JSON.stringify(res.data));
      setUser(res.data);
      setScreen('dashboard');
      fetchData(username);
      setupNotifications(username);
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user && screen === 'welcome') return <WelcomeScreen onLogin={handleLogin} loading={loading} />;

  return (
    <div className="min-h-screen bg-surface font-sans text-on-background pb-20">
      <TopBar username={user?.username} />

      <main className="max-w-md mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {screen === 'dashboard' && (
            <Dashboard
              reminders={reminders}
              stats={stats}
              onAction={fetchData}
              username={user.username}
              setScreen={setScreen}
            />
          )}
          {screen === 'create' && (
            <CreateReminder
              connections={connections}
              username={user.username}
              onBack={() => setScreen('dashboard')}
              onSent={() => { setScreen('dashboard'); fetchData(user.username); }}
            />
          )}
          {screen === 'connections' && (
            <Connections
              connections={connections}
              username={user.username}
              onBack={() => setScreen('dashboard')}
              onUpdate={() => fetchData(user.username)}
            />
          )}
        </AnimatePresence>
      </main>

      <BottomNav active={screen} setScreen={setScreen} />
    </div>
  );
}

function WelcomeScreen({ onLogin, loading }) {
  const [username, setUsername] = useState('');
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-8 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 max-w-sm"
      >
        <h1 className="text-4xl font-jakarta font-bold text-primary">Welcome to Nudge</h1>
        <p className="text-on-background/70">Accountability made simple. Enter a username to get started.</p>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-6 py-4 rounded-full bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <button
            onClick={() => onLogin(username)}
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-primary-container text-white font-semibold py-4 rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all"
          >
            {loading ? 'Starting...' : 'Get Started'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function TopBar({ username }) {
  return (
    <header className="sticky top-0 bg-surface/70 backdrop-blur-xl z-10 px-6 py-4 flex items-center justify-between">
      <h2 className="text-2xl font-jakarta font-bold text-primary">Nudge</h2>
      {username && (
        <span className="bg-primary/10 text-primary px-4 py-1 rounded-full text-sm font-medium">
          @{username}
        </span>
      )}
    </header>
  );
}

function Dashboard({ reminders, stats, onAction, username, setScreen }) {
  const handleUpdate = async (id, status) => {
    try {
      await axios.post(`${API_URL}/reminders/update`, { id, status, seen: true });
      onAction(username);
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-sm">
          <p className="text-sm text-on-background/60 font-medium uppercase tracking-wider">Done</p>
          <p className="text-3xl font-jakarta font-bold mt-1">{stats.done}</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-sm">
          <p className="text-sm text-on-background/60 font-medium uppercase tracking-wider">Ignored</p>
          <p className="text-3xl font-jakarta font-bold mt-1 text-primary">{stats.ignored}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-jakarta font-bold">Today's Reminders</h3>
          <button
            onClick={() => setScreen('create')}
            className="p-2 bg-primary text-white rounded-full"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {reminders.length === 0 ? (
            <p className="text-center py-12 text-on-background/40">No nudges yet. Go send some!</p>
          ) : (
            reminders.map((rem) => (
              <motion.div
                layout
                key={rem.id}
                className={cn(
                  "p-6 rounded-[2rem] shadow-sm transition-all",
                  rem.status === 'pending' ? "bg-surface-container-lowest" : "bg-surface-container-low opacity-60"
                )}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-jakarta font-semibold">{rem.text}</h4>
                    <p className="text-sm text-on-background/60">From: {rem.createdBy}</p>
                  </div>
                  <span className="text-sm font-medium text-primary bg-primary/5 px-3 py-1 rounded-full">
                    {rem.time}
                  </span>
                </div>

                {rem.status === 'pending' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleUpdate(rem.id, 'done')}
                      className="flex-1 flex items-center justify-center gap-2 bg-primary/10 text-primary py-3 rounded-full font-semibold"
                    >
                      <Check size={18} /> Done
                    </button>
                    <button
                      onClick={() => handleUpdate(rem.id, 'ignored')}
                      className="flex-1 flex items-center justify-center gap-2 bg-on-background/5 text-on-background/60 py-3 rounded-full font-semibold"
                    >
                      <X size={18} /> Ignore
                    </button>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </section>
    </motion.div>
  );
}

function CreateReminder({ connections, username, onBack, onSent }) {
  const [text, setText] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);

  const friends = connections
    .filter(c => c.status === 'accepted')
    .map(c => c.user1 === username ? c.user2 : c.user1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text || !assignedTo || !time) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/reminders`, {
        text,
        createdBy: username,
        assignedTo,
        time
      });
      onSent();
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 bg-surface-container-low rounded-full">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-xl font-jakarta font-bold">New Nudge</h3>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface-container-lowest p-8 rounded-[2.5rem] shadow-sm space-y-8">
        <div className="space-y-4">
          <label className="text-sm font-semibold uppercase tracking-wider text-on-background/50 ml-2">Who to nudge?</label>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {friends.map(friend => (
              <button
                key={friend}
                type="button"
                onClick={() => setAssignedTo(friend)}
                className={cn(
                  "px-6 py-3 rounded-full whitespace-nowrap font-medium transition-all",
                  assignedTo === friend ? "bg-primary text-white" : "bg-surface-container-low text-on-background/60"
                )}
              >
                {friend}
              </button>
            ))}
            {friends.length === 0 && <p className="text-sm text-on-background/40">No friends yet.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-sm font-semibold uppercase tracking-wider text-on-background/50 ml-2">Reminder Text</label>
          <input
            type="text"
            placeholder="e.g. Go to gym 💪"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-6 py-4 rounded-3xl bg-surface-container-low focus:outline-none"
          />
        </div>

        <div className="space-y-4">
          <label className="text-sm font-semibold uppercase tracking-wider text-on-background/50 ml-2">Due Time</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-6 py-4 rounded-3xl bg-surface-container-low focus:outline-none"
          />
        </div>

        <button
          disabled={loading}
          className="w-full bg-primary text-white font-bold py-5 rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all"
        >
          {loading ? 'Sending...' : 'Send Nudge'}
        </button>
      </form>
    </motion.div>
  );
}

function Connections({ connections, username, onBack, onUpdate }) {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search || search === username) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/users/search?username=${search}`);
      await axios.post(`${API_URL}/connections`, { user1: username, user2: search });
      setSearch('');
      onUpdate();
      alert('Request sent!');
    } catch (err) {
      alert(err.response?.data?.error || 'User not found');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.post(`${API_URL}/connections/update`, { id, status });
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const pending = connections.filter(c => c.status === 'pending' && c.user2 === username);
  const active = connections.filter(c => c.status === 'accepted');

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 bg-surface-container-low rounded-full">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-xl font-jakarta font-bold">Connections</h3>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          placeholder="Find username to connect"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-6 py-4 pr-14 rounded-full bg-surface-container-lowest shadow-sm focus:outline-none"
        />
        <button className="absolute right-2 top-2 p-3 bg-primary text-white rounded-full">
          <Search size={18} />
        </button>
      </form>

      {pending.length > 0 && (
        <section className="space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-on-background/50 ml-2">Pending Requests</h4>
          {pending.map(c => (
            <div key={c.id} className="bg-white p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
              <span className="font-semibold">@{c.user1}</span>
              <div className="flex gap-2">
                <button onClick={() => updateStatus(c.id, 'accepted')} className="p-2 bg-primary text-white rounded-full">
                  <Check size={18} />
                </button>
                <button onClick={() => updateStatus(c.id, 'declined')} className="p-2 bg-surface-container-low text-on-background/40 rounded-full">
                  <X size={18} />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-4">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-on-background/50 ml-2">My Connections</h4>
        <div className="space-y-3">
          {active.map(c => {
            const friend = c.user1 === username ? c.user2 : c.user1;
            return (
              <div key={c.id} className="bg-white p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
                <span className="font-semibold">@{friend}</span>
                <button className="text-xs font-semibold text-primary/40 uppercase tracking-widest">Remove</button>
              </div>
            );
          })}
          {active.length === 0 && <p className="text-center py-8 text-on-background/30 italic">No connections yet.</p>}
        </div>
      </section>
    </motion.div>
  );
}

function BottomNav({ active, setScreen }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-xl border-t border-on-background/5 px-8 py-4">
      <div className="max-w-md mx-auto flex items-center justify-around">
        <button
          onClick={() => setScreen('dashboard')}
          className={cn("p-2 transition-all", active === 'dashboard' ? "text-primary scale-110" : "text-on-background/40")}
        >
          <Home size={24} />
        </button>
        <button
          onClick={() => setScreen('connections')}
          className={cn("p-2 transition-all", active === 'connections' ? "text-primary scale-110" : "text-on-background/40")}
        >
          <Users size={24} />
        </button>
        <button
          className="p-2 text-on-background/40"
        >
          <BarChart2 size={24} />
        </button>
      </div>
    </nav>
  );
}
