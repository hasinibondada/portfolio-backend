import { Router } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { dbConnected } from '../index.js';

const router = Router();

const loginWithEnv = (username, password, res) => {
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  if (username !== adminUser || password !== adminPass) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { id: 'local-admin', username: adminUser },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, username: adminUser });
};

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    if (dbConnected && mongoose.connection.readyState === 1) {
      try {
        const user = await User.findOne({ username });
        if (!user) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign(
          { id: user._id, username: user.username },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );
        return res.json({ token, username: user.username });
      } catch (mongoErr) {
        console.log('MongoDB login failed, falling back to env:', mongoErr.message);
        return loginWithEnv(username, password, res);
      }
    }

    loginWithEnv(username, password, res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/verify', async (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false });
  }
  try {
    const token = header.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true });
  } catch {
    res.status(401).json({ valid: false });
  }
});

export default router;
