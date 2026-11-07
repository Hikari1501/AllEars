# All Ears 🎧 — Interactive English Listening Comprehension Platform

An interactive English listening learning and formative assessment web platform inspired by Edpuzzle and Nearpod, built with React 19, TypeScript, Tailwind CSS, Express, and YouTube Player API.

---

## 🚀 Deploying on Render (Free Tier: Web Service + PostgreSQL)

Render hosts both the **frontend**, the **Node.js/Express backend**, and the **managed PostgreSQL database** under its Free plan:

### 1-Click Blueprint Deployment
1. Push your updated code to your GitHub repository:
   ```bash
   git add .
   git commit -m "feat: student accounts, 2-tab live mode, and render migration"
   git push
   ```
2. Log into [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** → **Blueprint**.
4. Connect your `AllEars` GitHub repository.
5. Render detects `render.yaml` and provisions:
   - **`allears-db`**: A managed PostgreSQL database (Free plan).
   - **`allears`**: A Node.js web service running both backend API and static frontend (Free plan).
6. Click **Apply**.
   - Note: The build command is already configured with `--legacy-peer-deps` (`npm install --legacy-peer-deps && npm run build`) to ensure build success with Node 24.
7. Once deployment finishes, open your Render URL (e.g., `https://allears.onrender.com`). All lessons, student accounts, teacher curriculum, and live classroom sessions will be stored in your PostgreSQL database!

---

## 🚀 GitHub Pages Deployment Guide (Static Alternative)

Why did you see `github-pages 232 | Error: No such file or directory @ dir_chdir0 - /github/workspace/docs`?
This error happened because GitHub's default **Jekyll** builder ran on your repository and couldn't find the `/docs` folder or tried to process non-Jekyll files. Because **All Ears** is a modern React/Vite web application, Jekyll should **not** build it.

Here are the two ways to deploy cleanly:

### ⭐ Option 1: GitHub Actions (Recommended — Fully Automated)
1. In your GitHub repository, click **Settings** → **Pages** (under "Code and automation").
2. Under **Build and deployment** → **Source**, change the dropdown from *Deploy from a branch* to **GitHub Actions**.
3. That's it! The workflow in `.github/workflows/jekyll-gh-pages.yml` (now updated for Vite) will automatically install dependencies, build the static site, and deploy it live on every push.

---

### Option 2: Deploy from a branch (`/docs` folder)
If you prefer deploying from the `/docs` folder on your branch:
1. Make sure the `/docs` folder is committed to your repository:
   ```bash
   npm run build:docs
   git add docs -f
   git commit -m "Build static site into docs"
   git push
   ```
2. The `.nojekyll` files at root and in `/docs` will stop GitHub from trying to run Jekyll.
3. In GitHub Settings → **Pages** → Source: **Deploy from a branch**, Branch: `main` (or `master`), Folder: `/docs`.

---

## 🔑 Teacher Account Access

- Teacher accounts are restricted to authorized instructors.
- All users enter their credentials manually in the **Teacher Sign In** modal.
- Students do not need to sign in and can complete homework or join live lessons with a room PIN.

---

## ✨ Key Features

- **Side-by-Side Question Layout**:
  - In both Live Classroom and Homework modes, all questions are displayed in a clean, persistent right-hand column.
  - Video auto-pauses when reaching a checkpoint timestamp, smoothly scrolling and highlighting that question card with an active pulsing border.
  - Students can also answer any question ahead of time, self-paced.
  - Audio rewind buttons (`Rewind 5s`, `Rewind 10s`) inside the active question card and player bar allow students to re-listen with ease.
- **Whole-Video / General Comprehension Questions**:
  - Teachers can create questions with no timestamp (`timestamp: null`). These appear as "Whole Video / General" tasks and do not pause playback.
- **Dual Subtitles / Captions**:
  - **Teacher CC**: Custom interactive timed captions with CEFR vocabulary highlights (B1–C2) and instant dictionary popovers.
  - **YouTube CC**: Native YouTube closed captions toggled directly via the YouTube IFrame API.
- **Multi-Select Multiple Choice**:
  - Multiple choice questions can have more than one correct answer.
- **Live Classroom Sync & Bot Simulation**:
  - Teacher controls play/pause/speed; student screens sync in real-time.
  - Formative live poll tally and score tracking.
- **Per-Session Reports**:
  - Dedicated analytics reports for each live or homework session.
