import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import User from './models/User.js';
import Blog from './models/Blog.js';
import authRoutes from './routes/auth.js';
import blogRoutes from './routes/blogs.js';
import categoryRoutes from './routes/categories.js';
import projectRoutes from './routes/projects.js';
import contactRoutes from './routes/contact.js';
import { fileStore } from './utils/fileStore.js';

const app = express();
const PORT = process.env.PORT || 5000;

let dbConnected = false;

app.use(cors({
  origin: ['https://portfolio-frontend-pgup.onrender.com', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.redirect('https://portfolio-frontend-pgup.onrender.com');
});

app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/contact', contactRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dbConnected });
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = process.env.SITE_URL || 'https://hasinibondada25.vercel.app';
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += `<url><loc>${baseUrl}/</loc><priority>1.0</priority></url>\n`;
    xml += `<url><loc>${baseUrl}/blog</loc><priority>0.8</priority></url>\n`;
    if (dbConnected && mongoose.connection.readyState === 1) {
      const blogs = await Blog.find({ status: 'published' }).select('slug updatedAt');
      blogs.forEach((blog) => {
        xml += `<url><loc>${baseUrl}/blog/${blog.slug}</loc><lastmod>${blog.updatedAt.toISOString()}</lastmod><priority>0.6</priority></url>\n`;
      });
    } else {
      fileStore.find('blogs', { status: 'published' }).forEach((blog) => {
        xml += `<url><loc>${baseUrl}/blog/${blog.slug}</loc><lastmod>${blog.updatedAt}</lastmod><priority>0.6</priority></url>\n`;
      });
    }
    xml += '</urlset>';
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch {
    res.status(500).send('Error generating sitemap');
  }
});

app.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.SITE_URL || 'https://hasinibondada25.vercel.app';
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`);
});

const start = async () => {
  try {
    await Promise.race([
      connectDB(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('MongoDB timeout')), 6000))
    ]);
    dbConnected = true;
    console.log('MongoDB connected');
  } catch (err) {
    dbConnected = false;
    console.log('MongoDB not available — running without database');
  }
};
start().then(async () => {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  try {
    if (dbConnected) {
      const existing = await User.findOne({ username: adminUsername });
      if (!existing) {
        await User.create({ username: adminUsername, password: adminPassword });
        console.log(`Admin user created in MongoDB: ${adminUsername}`);
      }
    } else {
      const existing = fileStore.findOne('users', { username: adminUsername });
      if (!existing) {
        fileStore.insertOne('users', { username: adminUsername, password: adminPassword });
        console.log(`Admin user created in file store: ${adminUsername}`);
      }
    }
  } catch (err) {
    console.log('Could not seed admin user:', err.message);
  }
}).catch(() => {
  console.log('MongoDB not available — running without database');
}).finally(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
