# All Ears 🎧 — Interactive English Listening Comprehension Platform

An interactive English listening learning and formative assessment web platform inspired by Edpuzzle and Nearpod, built with React 19, TypeScript, Tailwind CSS, Express, and YouTube Player API.

---

## 🚀 GitHub Pages Deployment Guide

If you are deploying this website via **GitHub Pages** from the `/docs` folder:

1. **Root `/docs` Folder**:
   The `/docs` directory is automatically generated with your production build and already contains:
   - `index.html` (with relative asset linking `./assets/...`)
   - `404.html` (for seamless client-side single page app routing)
   - `.nojekyll` (disables default Jekyll processing, fixing `dir_chdir0 - /github/workspace/docs` errors)

2. **GitHub Repository Settings**:
   - Go to your repository on GitHub.
   - Navigate to **Settings** → **Pages** (under "Code and automation").
   - Under **Build and deployment**:
     - **Source**: Select `Deploy from a branch`.
     - **Branch**: Select your default branch (e.g. `main` or `master`), and in the folder dropdown choose `/docs`.
     - Click **Save**.
   - Your site will deploy cleanly without any Jekyll errors!

3. **Rebuilding for GitHub Pages**:
   Whenever you make updates and want to refresh the `/docs` build:
   ```bash
   npm run build:docs
   git add docs
   git commit -m "Update docs build for GitHub Pages"
   git push
   ```

---

## 🔑 Teacher Account Access

- **Email / Username**: `ChuckACR1501@gmail.com` (or `chuck`)
- **Password**: `password123`

*Note: Default visitors join as Students. Only Chuck and teachers explicitly added by Chuck can create, edit, publish, and host live sessions.*

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
