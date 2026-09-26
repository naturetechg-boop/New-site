# Informat

A production-ready editorial blog/news platform built with Node.js, Express, EJS and MongoDB — designed to run on Render's free tier using a free `onrender.com` subdomain.

---

## 1. What's included

- Public site: home, articles, single article pages, categories, search, about, contact, privacy, terms
- Full admin CMS at `/admin`: articles (Markdown editor), categories, trending control, media library, announcements, contact messages, analytics, site settings
- Session-based authentication with bcrypt password hashing, CSRF protection, rate limiting, security headers
- Privacy-conscious, self-hosted analytics (no third-party trackers, no stored IP addresses)
- SEO: dynamic `sitemap.xml`, `robots.txt`, canonical URLs, Open Graph/Twitter cards, Article/WebSite JSON-LD schema, Google Search Console verification support
- Media uploads stored in MongoDB (GridFS) so images survive Render's free-plan restarts

---

## 2. Project structure

```
informat/
  server.js                 Entry point
  package.json
  render.yaml                Render blueprint (optional)
  .env.example                Environment variable template
  config/
    site.js                   Central site config (name, tagline, etc.)
    database.js                MongoDB connection
  models/                      Mongoose schemas
  controllers/                 Route handlers
  middleware/                  Auth, CSRF, security, uploads, analytics, error handling
  routes/                       public.js and admin.js
  views/                        EJS templates (layouts, partials, public, admin, errors)
  public/                       CSS, client-side JS, static assets
  scripts/create-admin.js       One-time admin account creation/reset script
  utils/                        Slugify, reading time, Markdown rendering, analytics helpers
```

---

## 3. Local setup

1. Install Node.js 18+ and clone/extract this project.
2. `cd informat && npm install`
3. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `SESSION_SECRET` at minimum (see section 5).
4. Create your admin account (section 6).
5. `npm run dev` (or `npm start`) and open `http://localhost:3000`.

---

## 4. Database setup (MongoDB Atlas — free tier)

1. Create a free account at https://www.mongodb.com/cloud/atlas/register
2. Create a free "M0" cluster.
3. Under **Database Access**, create a database user with a strong password.
4. Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere) so Render can connect — Atlas free tier does not support fixed Render IPs.
5. Click **Connect > Drivers**, copy the connection string, and replace `<password>` with your database user's password. It looks like:
   ```
   mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/informat?retryWrites=true&w=majority
   ```
6. Use this as your `DATABASE_URL`.

---

## 5. Environment variables

Set these in your `.env` file locally, and in **Render Dashboard → your service → Environment** when deployed. See `.env.example` for the full template.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | MongoDB Atlas connection string |
| `SESSION_SECRET` | Yes | Long random string. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SITE_URL` | Yes | Your public URL, e.g. `https://informat.onrender.com` (no trailing slash) — used in the sitemap, canonical URLs and SEO tags |
| `PORT` | No | Render sets this automatically; leave blank on Render |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | No | Only used by `npm run create-admin`; safe to leave unset and enter interactively instead |
| `SETUP_TOKEN` | No | Enables the no-shell `/admin/setup?token=...` page (see section 6, Method A). Safe to leave set permanently — the page self-disables once an admin exists |
| `GOOGLE_SITE_VERIFICATION_FILE` | No | See section 8 |
| `GOOGLE_SITE_VERIFICATION_META` | No | See section 8 (can also be set from the admin Settings page) |
| `CONTACT_EMAIL` | No | Shown on the Contact page |
| `NODE_ENV` | No | Set to `production` on Render |

**Never commit your real `.env` file to GitHub.** `.gitignore` already excludes it.

---

## 6. Admin account setup (no default password exists)

This project does **not** ship with a hard-coded or default admin password. You create your own the first time you deploy, using **one** of the two methods below.

### Method A — from a browser, no shell required (recommended for Render's free tier)

Render's free-tier web services do **not** include shell/SSH access, and GitHub itself never runs your code or touches your live database — so a normal terminal-based setup often isn't available at all. This method works around that entirely from a browser.

1. Before (or after) deploying, set an environment variable `SETUP_TOKEN` to any long random string you make up — e.g. generate one with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` and set it in Render's Environment tab.
2. Deploy or redeploy so the variable takes effect.
3. Visit:
   ```
   https://YOUR-SITE-NAME.onrender.com/admin/setup?token=YOUR_SETUP_TOKEN
   ```
   (replacing `YOUR_SETUP_TOKEN` with the exact value you set).
4. Fill in your name, email and password (10+ characters minimum) and submit. You'll be logged straight into `/admin`.
5. **This page permanently disables itself** the instant one admin account exists — visiting it again afterwards (with or without the token) just shows "an admin account already exists." It's safe to leave `SETUP_TOKEN` set indefinitely.

The password is hashed with **bcrypt** (12 salt rounds) before it's stored — the plaintext password is never saved to the database, never logged, and never appears in the source code or GitHub repository.

### Method B — from a shell, if you have one

If you're running this locally, or on a host that does give you shell access:

```
npm run create-admin
```

You'll be prompted for admin name, email, and password (minimum 10 characters), hashed with bcrypt the same way as Method A.

### Access `/admin`

Visit `https://YOUR-SITE-NAME.onrender.com/admin` — you'll land on the login page. The admin panel is not accessible or listed anywhere on the public site, and `/admin` is disallowed in `robots.txt` so it won't be indexed by search engines.

### Log in

Enter the email and password you created. Login attempts are rate-limited (10 attempts per 15 minutes) to slow down brute-force attempts — the same limiter also applies to the `/admin/setup` page.

### Change your password

Once logged in, go to **Admin → Account** and use the "Change password" form. You'll need your current password to set a new one.

### Log out

Click **Log out** at the bottom of the admin sidebar. This destroys your server-side session.

### Forgot your password? (reset)

Since this project intentionally has no email/SMTP service configured, there's no "forgot password" email link. To reset:

- **If you still have your `SETUP_TOKEN` and no other admin account should exist:** you generally can't reuse `/admin/setup` once an account exists — it's a one-time page by design, not a general reset tool.
- **If you have shell access** (locally, or on a host that provides it): run `npm run create-admin` again with the **same email** as your existing account — it detects the existing account and securely updates its password hash.
- **If you have neither:** connect to your MongoDB Atlas database directly (via Atlas's web-based "Browse Collections" tool or `mongosh`), delete the single document in the `users` collection, then use Method A above (`/admin/setup?token=...`) to create a fresh admin account.

---

## 7. Deploying to Render

1. **Push to GitHub**
   - Create a new repository on GitHub.
   - `git init && git add . && git commit -m "Initial commit"`
   - `git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git`
   - `git branch -M main && git push -u origin main`
2. **Create the Render service**
   - Go to https://dashboard.render.com → **New → Web Service**.
   - Connect your GitHub repository.
   - Environment: **Node**. Build command: `npm install`. Start command: `npm start`.
   - Choose the **Free** instance type.
3. **Set environment variables** (Render Dashboard → your service → Environment): at minimum `DATABASE_URL`, `SESSION_SECRET`, `SITE_URL`, `NODE_ENV=production`.
4. **Deploy.** Render will build and start the app. Your site will be live at `https://YOUR-SITE-NAME.onrender.com`.
5. **Create your admin account** using the Render Shell tab (section 6).
6. Log in at `/admin` and start publishing.

---

## 8. Connecting Google Search Console

1. Go to https://search.google.com/search-console and add a property using your Render URL (`https://YOUR-SITE-NAME.onrender.com`) as a **URL prefix** property.
2. **Verify ownership** — pick ONE method:
   - **HTML file (recommended for Render):** Google gives you a file like `google1234567890abcdef.html`. Take just the code (`1234567890abcdef`) and set it as the `GOOGLE_SITE_VERIFICATION_FILE` environment variable on Render, then redeploy. The app will automatically serve that exact file at `https://YOUR-SITE-NAME.onrender.com/google1234567890abcdef.html`. Click "Verify" in Search Console.
   - **HTML meta tag:** Google gives you a `content="..."` value. Paste it into **Admin → Settings → Google Search Console** (or set the `GOOGLE_SITE_VERIFICATION_META` environment variable). It will be added as a `<meta name="google-site-verification">` tag on every page. Click "Verify" in Search Console.
3. **Submit your sitemap:** In Search Console, go to **Sitemaps** and submit:
   ```
   sitemap.xml
   ```
   (i.e. `https://YOUR-SITE-NAME.onrender.com/sitemap.xml`). It updates automatically as you publish, edit or add articles and categories — no manual regeneration needed.
4. **Request indexing:** Use the URL Inspection tool for your homepage and key articles, and click "Request Indexing".

**Important:** Search Console makes your site technically discoverable and crawlable — it does **not** guarantee rankings, guarantee Google will index every page, or guarantee your content appears in specific searches. Indexing and ranking depend on Google's own algorithms and can take time.

- Sitemap URL: `https://YOUR-SITE-NAME.onrender.com/sitemap.xml`
- Robots URL: `https://YOUR-SITE-NAME.onrender.com/robots.txt`

---

## 9. Publishing your first article

1. Log in at `/admin`.
2. Go to **Categories** and confirm/add the categories you want (a default set — Forex, Crypto, Finance, Technology, Business, Markets — is created automatically the first time the app runs against an empty database).
3. Go to **Create Article**.
4. Fill in title, category, and write your content in the Markdown editor.
5. Optionally upload or link a featured image, add tags, and fill in SEO title/description.
6. Set **Status** to "Published" and click **Save article**.
7. Optionally mark it as "Featured on homepage" or "Trending" from the article form, or later from **Trending**.

---

## 10. Limitations of the free Render subdomain / free plan

- **No custom domain** — your site is reachable at `https://YOUR-SITE-NAME.onrender.com`. You can add a custom domain later without changing any code (just update `SITE_URL`).
- **Ephemeral disk** — Render's free plan wipes local disk storage on every restart/redeploy. This is why uploaded images are stored in MongoDB (GridFS) instead of the local filesystem — they will persist correctly.
- **Cold starts** — free-tier services spin down after periods of inactivity and take a few seconds to wake up on the next request.
- **No built-in email sending** — the contact form stores messages in the database (visible under **Admin → Messages**) rather than emailing you, since no SMTP service is configured. Password resets work via the `create-admin` script instead of an email link, for the same reason.
- **Shared free MongoDB Atlas cluster (M0)** has storage and connection limits suitable for a small-to-medium blog, but you may need to upgrade as traffic/content grows.

---

## 11. Security notes

- Passwords are hashed with bcrypt (12 rounds); plaintext passwords are never stored or logged.
- Sessions are stored server-side in MongoDB (`connect-mongo`), with `httpOnly`, `sameSite=lax` cookies, and `secure` cookies in production.
- CSRF protection is applied to all state-changing requests via a session-bound token.
- `helmet` sets standard security headers and a Content-Security-Policy.
- Rate limiting is applied globally and more strictly on the login and contact-form routes.
- All Markdown article content is rendered to HTML and then sanitized (DOMPurify) before being stored, as defense-in-depth against stored XSS.
- Error pages never expose stack traces to visitors; errors are logged server-side only.

---

## 12. Customization

- Change the site name, tagline and defaults in `config/site.js`, or from **Admin → Settings** (settings there override the config file).
- Colors, typography and layout live in `public/css/main.css` (public site) and `public/css/admin.css` (admin panel).
