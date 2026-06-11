import { Router } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Blog from '../models/Blog.js';
import auth from '../middleware/auth.js';
import { fileStore } from '../utils/fileStore.js';
import { dbConnected } from '../index.js';

const router = Router();
const useDB = () => dbConnected && mongoose.connection.readyState === 1;
const COL = 'blogs';

router.get('/', async (req, res) => {
  try {
    if (useDB()) {
      const { status, category, tag, sort, search, page = 1, limit = 10 } = req.query;
      const query = {};
      if (status) query.status = status;
      else query.status = 'published';
      if (category) query.category = category;
      if (tag) query.tags = tag;
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { excerpt: { $regex: search, $options: 'i' } },
          { tags: { $regex: search, $options: 'i' } },
        ];
      }
      let sortOption = { createdAt: -1 };
      if (sort === 'mostRead') sortOption = { readCount: -1 };
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await Blog.countDocuments(query);
      const blogs = await Blog.find(query)
        .populate('category', 'name slug')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-content');
      return res.json({ blogs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    }

    let items = fileStore.find(COL, { status: 'published' });
    const p = parseInt(req.query.page) || 1;
    const l = parseInt(req.query.limit) || 10;
    const total = items.length;
    items = fileStore.sort(items, { createdAt: -1 });
    const blogs = items.slice((p - 1) * l, p * l).map(b => {
      const { content, ...rest } = b;
      return rest;
    });
    res.json({ blogs, total, page: p, pages: Math.ceil(total / l) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/all', auth, async (req, res) => {
  try {
    if (useDB()) {
      const blogs = await Blog.find().populate('category', 'name slug').sort({ createdAt: -1 });
      return res.json(blogs);
    }
    const items = fileStore.sort(fileStore.find(COL), { createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/by-id/:id', auth, async (req, res) => {
  try {
    if (useDB()) {
      const blog = await Blog.findById(req.params.id).populate('category', 'name slug');
      if (!blog) return res.status(404).json({ message: 'Blog not found' });
      return res.json(blog);
    }
    const blog = fileStore.findById(COL, req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    if (useDB()) {
      const blog = await Blog.findOne({ slug: req.params.slug }).populate('category', 'name slug');
      if (!blog) return res.status(404).json({ message: 'Blog not found' });
      if (blog.status !== 'published') {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
          return res.status(404).json({ message: 'Blog not found' });
        }
        try {
          const token = header.split(' ')[1];
          jwt.verify(token, process.env.JWT_SECRET);
        } catch {
          return res.status(404).json({ message: 'Blog not found' });
        }
      }
      blog.readCount += 1;
      await blog.save();
      return res.json(blog);
    }

    const blog = fileStore.findOne(COL, { slug: req.params.slug });
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    if (blog.status !== 'published') {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        return res.status(404).json({ message: 'Blog not found' });
      }
      try {
        const token = header.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(404).json({ message: 'Blog not found' });
      }
    }
    blog.readCount = (blog.readCount || 0) + 1;
    fileStore.updateById(COL, blog._id, { readCount: blog.readCount });
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    if (useDB()) {
      const blog = new Blog(req.body);
      await blog.save();
      return res.status(201).json(blog);
    }
    const entry = fileStore.insertOne(COL, req.body);
    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    if (useDB()) {
      const blog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!blog) return res.status(404).json({ message: 'Blog not found' });
      return res.json(blog);
    }
    const blog = fileStore.updateById(COL, req.params.id, req.body);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.json(blog);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    if (useDB()) {
      const blog = await Blog.findByIdAndDelete(req.params.id);
      if (!blog) return res.status(404).json({ message: 'Blog not found' });
      return res.json({ message: 'Blog deleted' });
    }
    const ok = fileStore.deleteById(COL, req.params.id);
    if (!ok) return res.status(404).json({ message: 'Blog not found' });
    res.json({ message: 'Blog deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
