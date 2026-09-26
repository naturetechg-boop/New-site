const mongoose = require('mongoose');

async function connectDatabase() {
  const uri = process.env.DATABASE_URL;

  if (!uri) {
    console.error(
      '[database] DATABASE_URL is not set. Create a .env file (see .env.example) ' +
        'or set DATABASE_URL in your Render environment variables.'
    );
    process.exit(1);
  }

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('[database] Connected to MongoDB');
  } catch (err) {
    console.error('[database] Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('[database] Connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[database] Disconnected from MongoDB');
  });
}

module.exports = connectDatabase;
