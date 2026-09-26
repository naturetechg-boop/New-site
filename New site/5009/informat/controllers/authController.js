const User = require('../models/User');

function getLogin(req, res) {
  res.render('admin/login', {
    title: 'Admin Login',
    layout: 'layouts/admin',
    isLoginPage: true,
    error: req.session.flashError || null
  });
  delete req.session.flashError;
}

async function postLogin(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).render('admin/login', {
        title: 'Admin Login',
        layout: 'layouts/admin',
        isLoginPage: true,
        error: 'Please enter both email and password.'
      });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });

    // Compare against a dummy hash if user not found, to avoid a timing
    // side-channel that reveals whether an email address is registered.
    const dummyHash = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8Q2/EPr5B3lIRoZ4KFbVFWnDJa2vye';
    const isValid = user ? await user.verifyPassword(password) : await require('bcryptjs').compare(password, dummyHash);

    if (!user || !isValid) {
      return res.status(401).render('admin/login', {
        title: 'Admin Login',
        layout: 'layouts/admin',
        isLoginPage: true,
        error: 'Invalid email or password.'
      });
    }

    req.session.regenerate(async (err) => {
      if (err) return next(err);
      req.session.userId = user._id.toString();
      req.session.userName = user.name;
      user.lastLoginAt = new Date();
      await user.save();
      res.redirect('/admin');
    });
  } catch (err) {
    next(err);
  }
}

function postLogout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('informat.sid');
    res.redirect('/admin/login');
  });
}

async function getAccount(req, res, next) {
  try {
    const user = await User.findById(req.session.userId).lean();
    res.render('admin/account', {
      title: 'Account',
      layout: 'layouts/admin',
      user,
      error: null,
      success: null
    });
  } catch (err) {
    next(err);
  }
}

async function postChangePassword(req, res, next) {
  try {
    const user = await User.findById(req.session.userId);
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const renderWith = (error, success) =>
      res.render('admin/account', {
        title: 'Account',
        layout: 'layouts/admin',
        user,
        error,
        success
      });

    if (!currentPassword || !newPassword || !confirmPassword) {
      return renderWith('Please fill in all fields.', null);
    }

    const isCurrentValid = await user.verifyPassword(currentPassword);
    if (!isCurrentValid) {
      return renderWith('Your current password is incorrect.', null);
    }

    if (newPassword.length < 10) {
      return renderWith('New password must be at least 10 characters long.', null);
    }

    if (newPassword !== confirmPassword) {
      return renderWith('New password and confirmation do not match.', null);
    }

    await user.setPassword(newPassword);
    await user.save();

    return renderWith(null, 'Password updated successfully.');
  } catch (err) {
    next(err);
  }
}

// ---------- First-run web setup (no shell access required) ----------
// Lets the site owner create the very first admin account by visiting a
// URL in a browser, which is essential on hosts (like Render's free tier)
// that don't provide shell/SSH access. Protected by a SETUP_TOKEN so a
// stranger who finds the URL before you do can't create their own admin
// account. Once any admin account exists, this route refuses to create
// another one - use the normal admin panel (or the create-admin script,
// where shell access is available) to manage accounts after that.

async function getSetup(req, res, next) {
  try {
    const setupToken = process.env.SETUP_TOKEN;
    const existingAdminCount = await User.countDocuments();

    if (existingAdminCount > 0) {
      return res.status(403).render('admin/setup', {
        title: 'Setup',
        layout: 'layouts/admin',
        isLoginPage: true,
        alreadySetUp: true,
        tokenMissing: false,
        tokenInvalid: false,
        error: null
      });
    }

    if (!setupToken) {
      return res.status(500).render('admin/setup', {
        title: 'Setup',
        layout: 'layouts/admin',
        isLoginPage: true,
        alreadySetUp: false,
        tokenMissing: true,
        tokenInvalid: false,
        error: null
      });
    }

    if (req.query.token !== setupToken) {
      return res.status(403).render('admin/setup', {
        title: 'Setup',
        layout: 'layouts/admin',
        isLoginPage: true,
        alreadySetUp: false,
        tokenMissing: false,
        tokenInvalid: true,
        error: null
      });
    }

    res.render('admin/setup', {
      title: 'Setup',
      layout: 'layouts/admin',
      isLoginPage: true,
      alreadySetUp: false,
      tokenMissing: false,
      tokenInvalid: false,
      error: null,
      formToken: req.query.token
    });
  } catch (err) {
    next(err);
  }
}

async function postSetup(req, res, next) {
  try {
    const setupToken = process.env.SETUP_TOKEN;
    const existingAdminCount = await User.countDocuments();

    // Re-check everything server-side; never trust the hidden form token alone.
    if (existingAdminCount > 0) {
      return res.status(403).render('admin/setup', {
        title: 'Setup',
        layout: 'layouts/admin',
        isLoginPage: true,
        alreadySetUp: true,
        tokenMissing: false,
        tokenInvalid: false,
        error: null
      });
    }

    if (!setupToken || req.body.token !== setupToken) {
      return res.status(403).render('admin/setup', {
        title: 'Setup',
        layout: 'layouts/admin',
        isLoginPage: true,
        alreadySetUp: false,
        tokenMissing: !setupToken,
        tokenInvalid: !!setupToken,
        error: null
      });
    }

    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).render('admin/setup', {
        title: 'Setup',
        layout: 'layouts/admin',
        isLoginPage: true,
        alreadySetUp: false,
        tokenMissing: false,
        tokenInvalid: false,
        error: 'Please fill in every field.',
        formToken: req.body.token
      });
    }

    if (password.length < 10) {
      return res.status(400).render('admin/setup', {
        title: 'Setup',
        layout: 'layouts/admin',
        isLoginPage: true,
        alreadySetUp: false,
        tokenMissing: false,
        tokenInvalid: false,
        error: 'Password must be at least 10 characters long.',
        formToken: req.body.token
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).render('admin/setup', {
        title: 'Setup',
        layout: 'layouts/admin',
        isLoginPage: true,
        alreadySetUp: false,
        tokenMissing: false,
        tokenInvalid: false,
        error: 'Passwords do not match.',
        formToken: req.body.token
      });
    }

    const user = new User({ name: name.trim(), email: email.toLowerCase().trim(), role: 'admin' });
    await user.setPassword(password);
    await user.save();

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user._id.toString();
      req.session.userName = user.name;
      res.redirect('/admin');
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).render('admin/setup', {
        title: 'Setup',
        layout: 'layouts/admin',
        isLoginPage: true,
        alreadySetUp: false,
        tokenMissing: false,
        tokenInvalid: false,
        error: 'That email is already in use.',
        formToken: req.body.token
      });
    }
    next(err);
  }
}

module.exports = { getLogin, postLogin, postLogout, getAccount, postChangePassword, getSetup, postSetup };
