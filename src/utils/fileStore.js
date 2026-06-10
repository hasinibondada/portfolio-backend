import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');

function getFilePath(collection) {
  return path.join(DATA_DIR, `${collection}.json`);
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAll(collection) {
  ensureDir();
  const fp = getFilePath(collection);
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

function writeAll(collection, data) {
  ensureDir();
  fs.writeFileSync(getFilePath(collection), JSON.stringify(data, null, 2));
}

let idCounter = Date.now();
function genId() {
  return (++idCounter).toString(36);
}

export const fileStore = {
  find(collection, query = {}) {
    let items = readAll(collection);
    const keys = Object.keys(query);
    if (keys.length === 0) return items;
    return items.filter(item =>
      keys.every(k => {
        if (k === '$or') {
          return query.$or.some(clause =>
            Object.entries(clause).every(([ck, cv]) => {
              const val = item[ck];
              if (typeof cv === 'object' && cv.$regex) {
                return new RegExp(cv.$regex, cv.$options || '').test(val);
              }
              return val === cv;
            })
          );
        }
        return item[k] === query[k];
      })
    );
  },

  findById(collection, id) {
    return readAll(collection).find(i => i._id === id) || null;
  },

  findOne(collection, query) {
    return this.find(collection, query)[0] || null;
  },

  insertOne(collection, doc) {
    const items = readAll(collection);
    const now = new Date().toISOString();
    const entry = { _id: genId(), ...doc, createdAt: now, updatedAt: now };
    items.push(entry);
    writeAll(collection, items);
    return entry;
  },

  updateById(collection, id, update) {
    const items = readAll(collection);
    const idx = items.findIndex(i => i._id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...update, updatedAt: new Date().toISOString() };
    writeAll(collection, items);
    return items[idx];
  },

  deleteById(collection, id) {
    const items = readAll(collection);
    const idx = items.findIndex(i => i._id === id);
    if (idx === -1) return false;
    items.splice(idx, 1);
    writeAll(collection, items);
    return true;
  },

  countDocuments(collection, query = {}) {
    return this.find(collection, query).length;
  },

  sort(items, sortOption) {
    const [key, order] = Object.entries(sortOption)[0];
    return [...items].sort((a, b) => {
      if (order === -1) return new Date(b[key]) - new Date(a[key]);
      return new Date(a[key]) - new Date(b[key]);
    });
  },
};
