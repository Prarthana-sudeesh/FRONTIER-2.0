# Deploy your own copy of FRONTIER on GitHub

This guide is for anyone who wants to run FRONTIER on **their own GitHub account**.
Everything is done in the browser. You don't need to install anything.

At the end, your site will be live at `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

---

## Step 1: Get your own copy of the code

You need a free GitHub account (sign up at https://github.com).

**Way A: Import (recommended, gives you a fully independent copy)**
1. Go to https://github.com/new/import
2. In **"Your old repository's clone URL"** paste:
   `https://github.com/Prarthana-sudeesh/FRONTIER-2.0.git`
3. Choose a **Repository name**, e.g. `frontier`.
4. Pick **Public**. GitHub Pages is free for public repos.
5. Click **Begin import** and wait until it says the import is complete.

**Way B: Upload the files yourself**
1. Download the code as a ZIP (on the original repo: green **Code** button → **Download ZIP**) and unzip it.
2. Go to https://github.com/new, name the repo (e.g. `frontier`), choose **Public**, click **Create repository**.
3. Click **uploading an existing file**, drag in **everything inside** the unzipped folder, then click **Commit changes**.

> Uploading by dragging often skips the hidden `.github` folder, so your copy may have **no workflow file**.
> That's fine: Step 2 adds it.

---

## Step 2: Make sure your copy has the deploy workflow

1. In your repo, check whether the file `.github/workflows/deploy.yml` exists.
   **If it exists, skip to Step 3.**
2. If it doesn't: click **Add file** → **Create new file**.
3. In the file name box type exactly:
   `.github/workflows/deploy.yml`
   (typing the `/` creates the folders for you)
4. Paste this into the big text box:

```yaml
name: Deploy website

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

5. Click **Commit changes** → **Commit changes**.

> If your default branch is called `master` instead of `main`, change `[main]` to `[master]`.

---

## Step 3: Turn on GitHub Pages

1. In **your repo** (not your profile), click the **⚙️ Settings** tab.
   On a narrow screen it may be hidden under the **⋯** menu.
2. In the left menu click **Pages**.
3. Under **Build and deployment** → **Source**, choose **GitHub Actions**.

> If you only see "Verified domains", you're in your *account* settings.
> Go back to the repo page and use its Settings tab instead.

---

## Step 4: Publish

1. Click the **Actions** tab of your repo.
   - If GitHub asks, click **"I understand my workflows, go ahead and enable them"**.
2. Click **Deploy website** in the left list → **Run workflow** → **Run workflow**.
3. Wait about a minute until both steps, **build** and **deploy**, show a green ✓.
4. Your link appears on the finished run under **deploy**. It looks like:
   `https://YOUR-USERNAME.github.io/YOUR-REPO/`

From now on, every change you commit to `main` republishes the site automatically.

---

## Using real data instead of the demo

The site ships with clearly labelled **demo data**. To show real forecasts:

1. Open `public/data/forecasts.json` in your repo.
2. Click the **pencil** icon to edit it, or **Add file** → **Upload files** to upload a replacement
   with the same name into `public/data/`.
3. Commit. The site republishes by itself.

The real file is produced by the FRONTIER model (`pipeline/frontier_model.py` or
`b2/export_web.py` in the FRONTIER model repo).

---

## If something goes wrong

| Problem | Fix |
|---|---|
| **deploy** step fails, build is green | Pages isn't on yet: do Step 3, then re-run (open the run → **Re-run all jobs**). |
| No **Actions** tab or no **Run workflow** button | Actions are off: **Settings** → **Actions** → **General** → **Allow all actions**. Check Step 2's file name is exactly `.github/workflows/deploy.yml`. |
| **build** step fails | Make sure `package.json` and `package-lock.json` are in the top level of the repo, not inside a sub-folder. |
| Site shows a blank page or 404 | Wait a minute and hard-refresh (Ctrl+Shift+R / Cmd+Shift+R). Check the URL ends with `/YOUR-REPO/`. |
| Private repo, Pages not offered | Free accounts need the repo to be **Public** for Pages. |

---

## No-GitHub alternative

Prefer not to use GitHub? Use Netlify instead:

1. On a computer with Node.js installed (https://nodejs.org), download and unzip the code.
2. Open a terminal in that folder and run `npm install`, then `npm run build`.
3. Drag the new **`dist`** folder onto https://app.netlify.com/drop to get a live link.
