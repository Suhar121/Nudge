require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const { db, initDb } = require('./database');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

webpush.setVapidDetails(
  'mailto:example@yourdomain.org',
  process.env.PUBLIC_KEY,
  process.env.PRIVATE_KEY
);

// Init DB
initDb().then(() => {
  console.log('Database initialized');
});

// USERS
app.post('/api/users', async (req, res) => {
  const { username } = req.body;
  try {
    const existing = await db('users').where({ username }).first();
    if (existing) {
      return res.json(existing);
    }
    const [id] = await db('users').insert({ username });
    res.json({ id, username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/search', async (req, res) => {
    const { username } = req.query;
    try {
        const user = await db('users').where({ username }).first();
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CONNECTIONS
app.post('/api/connections', async (req, res) => {
  const { user1, user2 } = req.body; // user1 is requester
  try {
    const existing = await db('connections')
      .where({ user1, user2 })
      .orWhere({ user1: user2, user2: user1 })
      .first();
    if (existing) {
      return res.status(400).json({ error: 'Connection already exists or pending' });
    }
    await db('connections').insert({ user1, user2, status: 'pending' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/connections/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const connections = await db('connections')
      .where({ user1: username })
      .orWhere({ user2: username });
    res.json(connections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/connections/update', async (req, res) => {
  const { id, status } = req.body;
  try {
    await db('connections').where({ id }).update({ status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REMINDERS
app.post('/api/reminders', async (req, res) => {
  const { text, createdBy, assignedTo, time } = req.body;
  try {
    const [id] = await db('reminders').insert({
      text,
      createdBy,
      assignedTo,
      time,
      status: 'pending',
      seen: false,
    });

    // Send Push Notification
    const subscriptions = await db('subscriptions').where({ username: assignedTo });
    const payload = JSON.stringify({
      title: 'New Nudge! 🔔',
      body: `${createdBy} reminded you: ${text}`,
    });

    subscriptions.forEach((sub) => {
      webpush.sendNotification(JSON.parse(sub.subscription), payload).catch((err) => {
        console.error('Error sending push notification:', err);
      });
    });

    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reminders/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const reminders = await db('reminders').where({ assignedTo: username }).orderBy('createdAt', 'desc');
    res.json(reminders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reminders/update', async (req, res) => {
  const { id, status, seen } = req.body;
  try {
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (seen !== undefined) updateData.seen = seen;
    await db('reminders').where({ id }).update(updateData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const done = await db('reminders').where({ assignedTo: username, status: 'done' }).count('id as count').first();
        const ignored = await db('reminders').where({ assignedTo: username, status: 'ignored' }).count('id as count').first();
        res.json({ done: done.count, ignored: ignored.count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUSH SUBSCRIPTIONS
app.post('/api/subscribe', async (req, res) => {
  const { username, subscription } = req.body;
  try {
    const existing = await db('subscriptions')
      .where({ username, subscription: JSON.stringify(subscription) })
      .first();
    if (!existing) {
      await db('subscriptions').insert({ username, subscription: JSON.stringify(subscription) });
    }
    res.status(201).json({});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
