const Category = require('../models/Category');
const slugify = require('./slugify');

const DEFAULT_CATEGORIES = ['News', 'Forex', 'Crypto', 'Finance', 'Technology', 'Business', 'Markets'];

// Only ever seeds empty-state categories so the nav isn't blank on first deploy.
// Never creates sample/fake articles, users, or analytics data.
async function seedDefaultCategories() {
  const count = await Category.countDocuments();
  if (count > 0) return;

  await Category.insertMany(
    DEFAULT_CATEGORIES.map((name) => ({ name, slug: slugify(name) }))
  );
  console.log('[seed] Created default categories:', DEFAULT_CATEGORIES.join(', '));
}

module.exports = seedDefaultCategories;