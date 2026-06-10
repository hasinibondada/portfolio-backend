import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';
import connectDB from './config/db.js';

const seed = async () => {
  await connectDB();

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await User.findOne({ username });
  if (existing) {
    console.log('Admin user already exists');
    process.exit(0);
  }

  await User.create({ username, password });
  console.log(`Admin user created: ${username}`);
  process.exit(0);
};

seed();
