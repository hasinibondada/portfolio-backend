import { Router } from 'express';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import auth from '../middleware/auth.js';
import { fileStore } from '../utils/fileStore.js';

const router = Router();
const useDB = () => mongoose.connection.readyState === 1;
const COL = 'categories';

router.get('/', async (req, res) => {
  try {
    if (useDB()) {
      const categories = await Category.find().populate('parent', 'name slug').sort({ name: 1 });
      return res.json(categories);
    }
    const items = fileStore.find(COL).sort((a, b) => a.name.localeCompare(b.name));
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, slug, parent } = req.body;
    if (useDB()) {
      const category = new Category({ name, slug, parent: parent || null });
      await category.save();
      return res.status(201).json(category);
    }
    const entry = fileStore.insertOne(COL, { name, slug, parent: parent || null });
    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { parent } = req.body;
    if (parent && parent === req.params.id) {
      return res.status(400).json({ message: 'A category cannot be its own parent' });
    }
    if (useDB()) {
      if (parent) {
        const allCats = await Category.find({});
        const descendants = new Set();
        const findDescendants = (id) => {
          allCats.forEach((c) => {
            if (c.parent && (c.parent._id?.toString() === id || c.parent.toString() === id)) {
              if (!descendants.has(c._id.toString())) {
                descendants.add(c._id.toString());
                findDescendants(c._id.toString());
              }
            }
          });
        };
        findDescendants(req.params.id);
        if (descendants.has(parent)) {
          return res.status(400).json({ message: 'Circular parent reference detected' });
        }
      }
      const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!category) return res.status(404).json({ message: 'Category not found' });
      return res.json(category);
    }
    const entry = fileStore.updateById(COL, req.params.id, req.body);
    if (!entry) return res.status(404).json({ message: 'Category not found' });
    res.json(entry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    if (useDB()) {
      await Category.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Category deleted' });
    }
    const ok = fileStore.deleteById(COL, req.params.id);
    if (!ok) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
