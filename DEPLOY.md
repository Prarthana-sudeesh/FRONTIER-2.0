# Deploying FRONTIER (no GitHub Actions needed)

Three ways to put the site online. **Option 1 is the easiest** and needs no GitHub account.

---

## Option 1: Netlify drag-and-drop (about 10 minutes)

**1. Install Node.js**
Go to https://nodejs.org, download the **LTS** version, and install it with the default settings.

**2. Get the code**
- Open https://github.com/Prarthana-sudeesh/FRONTIER-2.0
- Click the green **Code** button → **Download ZIP**.
- Unzip it somewhere easy, such as the Desktop. You get a folder like `FRONTIER-2.0-main`.

**3. Open a terminal in that folder**
- **Windows:** open the folder, click the address bar, type `cmd`, press Enter.
- **Mac:** right-click the folder → **New Terminal at Folder**. If that option isn't there, open Terminal, type `cd ` (with a space), drag the folder into the window, and press Enter.

**4. Build the site**

Run these one at a time:

```bash
npm install
```

```bash
npm run build
```

When it says `✓ built`, there is a new folder called **`dist`**. That folder is the whole website.

**5. Publish it**
- Go to https://app.netlify.com/drop and sign up (free) or log in.
- Drag the **`dist`** folder onto the page.
- After a few seconds you get a live link like `https://random-name-123.netlify.app`.

**6. Optional: rename the link**
In Netlify: **Site configuration** → **Change site name**, e.g. `frontier-research`.

**To update later:** download the code again, run `npm run build` again, then open the site in Netlify → **Deploys** tab and drag the new `dist` folder in.

---

## Option 2: Vercel, connected to your own GitHub (auto-updates)

1. Sign in to GitHub, open https://github.com/Prarthana-sudeesh/FRONTIER-2.0 and click **Fork** → **Create fork**.
2. Go to https://vercel.com and sign up with GitHub.
3. Click **Add New…** → **Project**, find your fork and click **Import**.
4. Leave every setting as it is (the repo already includes them) and click **Deploy**.
5. About a minute later you get a link like `https://frontier-2-0.vercel.app`. Every push to your fork redeploys it automatically.

Netlify works the same way: **Add new site** → **Import an existing project** → pick your fork → **Deploy**.

---

## Option 3: GitHub Pages on your own fork, without the workflow

1. Fork the repo (Option 2, step 1). Then follow Option 1, steps 1 to 4, but download the ZIP from **your fork**.
2. Publish the built files to a `gh-pages` branch. This needs Git installed, from https://git-scm.com. Replace `YOUR-USERNAME` with your GitHub username:

   ```bash
   npx gh-pages -d dist -r https://github.com/YOUR-USERNAME/FRONTIER-2.0.git
   ```

   Git may ask you to sign in to GitHub; that's expected.
3. In your fork on GitHub: **Settings** → **Pages** → **Source: Deploy from a branch** → Branch **gh-pages**, folder **/ (root)** → **Save**.
4. After about a minute the site is at `https://YOUR-USERNAME.github.io/FRONTIER-2.0/`

---

## Using real data instead of the demo

Before building, replace `public/data/forecasts.json` with the file produced by the
FRONTIER model (`pipeline/frontier_model.py` or `b2/export_web.py` in the FRONTIER repo).

## If something goes wrong

- **`npm` is "not recognized":** restart the computer after installing Node.js, then try again.
- **Blank page:** make sure you uploaded the **`dist`** folder, not the whole project folder.
