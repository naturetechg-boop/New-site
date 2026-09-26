require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../models/User');

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    console.error('DATABASE_URL is not set. Add it to your .env file first.');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const name = process.env.ADMIN_NAME || (await ask('Admin name: '));
  const email = (process.env.ADMIN_EMAIL || (await ask('Admin email: '))).toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || (await ask('Admin password (min 10 chars): '));

  if (!name || !email || !password || password.length < 10) {
    console.error('Name, a valid email and a password of at least 10 characters are required.');
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`An admin with email ${email} already exists. Updating their password instead.`);
    await existing.setPassword(password);
    await existing.save();
    console.log('Password updated successfully.');
  } else {
    const user = new User({ name, email, role: 'admin' });
    await user.setPassword(password);
    await user.save();
    console.log(`Admin account created for ${email}.`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to create admin account:', err.message);
  process.exit(1);
});
