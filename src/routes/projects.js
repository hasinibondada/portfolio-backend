import { Router } from 'express';

const router = Router();

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

router.get('/', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.data && now - cache.timestamp < CACHE_TTL) {
      return res.json(cache.data);
    }

    const { GITHUB_TOKEN, GITHUB_USERNAME } = process.env;
    const username = GITHUB_USERNAME || 'hasinibondada';

    const headers = {};
    if (GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }

    const response = await fetch(
      `https://api.github.com/users/${username}/repos?sort=updated&per_page=50&type=owner`,
      { headers }
    );

    if (!response.ok) {
      if (cache.data) {
        return res.json(cache.data);
      }
      return res.status(502).json({ message: 'GitHub API error' });
    }

    const repos = await response.json();
    const projects = repos
      .filter(repo => !repo.fork && !repo.archived)
      .map(repo => ({
        id: repo.id,
        name: repo.name,
        description: repo.description || 'No description',
        url: repo.html_url,
        stars: repo.stargazers_count,
        language: repo.language,
        topics: repo.topics,
        updatedAt: repo.updated_at,
      }));

    cache = { data: projects, timestamp: Date.now() };
    res.json(projects);
  } catch (error) {
    if (cache.data) {
      return res.json(cache.data);
    }
    res.status(500).json({ message: error.message });
  }
});

export default router;
