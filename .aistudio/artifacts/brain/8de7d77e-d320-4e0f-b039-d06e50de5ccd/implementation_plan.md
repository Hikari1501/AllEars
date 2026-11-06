# All Ears: Render Full-Stack & PostgreSQL Migration Plan

Migrate All Ears from static GitHub Pages to a unified Render full-stack Web Service backed by a managed PostgreSQL database, enabling cross-device lesson publishing, persistent student reports, and synchronized live classrooms.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been confirmed through your clarifying answers:
> - **Database**: Render Managed PostgreSQL database connected via `DATABASE_URL` (with an automatic JSON/SQLite fallback for local preview environments).
> - **Service Architecture**: Unified full-stack Render Web Service hosting both the Express API and the Vite production frontend on a single domain (zero CORS configuration required).
> - **Live Classroom Sync**: Server-authoritative Express state synchronization with high-frequency heartbeat polling and persistent session archiving.

---

## 1. Overview & Core Concept

### The Problem
GitHub Pages is a static-only web host without a Node.js runtime or server-side database. As a result:
1. When a teacher published a lesson, it was only stored in that individual teacher's browser `localStorage`. Students visiting from other devices could not see the newly published lessons.
2. The Live Classroom broadcast feature could not synchronize playback or questions across devices without an active server backend.
3. Student practice homework and classroom reports were isolated to single devices.

### The Solution: Unified Render Deployment
By moving to **Render**:
- A single Render Web Service runs the Express server, which hosts both the complete API backend and serves the compiled React SPA.
- All published lessons are saved directly to a **Render Managed PostgreSQL database**.
- Every visitor (student or teacher) dynamically loads published lessons from the centralized database on page load.
- Live Classroom sessions run authoritatively in the Express server, allowing teachers to control playback, trigger checkpoints, and broadcast difficult vocabulary to all connected student devices simultaneously.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RENDER HOSTED ENVIRONMENT                       │
│                                                                        │
│  ┌─────────────────────────┐            ┌───────────────────────────┐  │
│  │   Teacher / Student     │   HTTPS    │    Render Web Service     │  │
│  │     Client Devices      │ ─────────> │  (Express + Vite Bundle)  │  │
│  └─────────────────────────┘            └─────────────┬─────────────┘  │
│                                                       │                │
│                                                       │ SQL Pool (pg)  │
│                                                       ▼                │
│                                         ┌───────────────────────────┐  │
│                                         │ Render Managed PostgreSQL │  │
│                                         │ (Lessons, Reports, Users) │  │
│                                         └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. User Experience & Visual Design

The UI will retain its clean, educational aesthetic following the **Educational & Interactive Simulations** design guidelines:

### Key User Flows
1. **Teacher Publishes a Lesson**:
   - Teacher creates or edits a lesson in the Lesson Studio and clicks **"Save & Publish"**.
   - The lesson is immediately sent to `/api/lessons` and written to PostgreSQL.
   - A success toast confirms: `"Lesson published to global catalog!"`.
2. **Student Opens Website on Any Device**:
   - Student navigates to the website URL.
   - The frontend immediately queries `/api/lessons?role=student` from PostgreSQL.
   - All published lessons appear in the catalog instantly with full video thumbnails, CEFR level badges, checkpoint counts, and vocabulary glossaries.
3. **Live Classroom Hosting & Joining**:
   - Teacher clicks **"Live Class"** on any lesson to generate a synchronized 6-digit room PIN.
   - Students enter the 6-digit PIN on their devices via **"Join with PIN"**.
   - Teacher playback controls (play, pause, seek, speed) instantly mirror to student screens; when the video hits a checkpoint or vocabulary word, student screens pause and display interactive questions.

### Visual Architecture & Palette
- **Primary Surface**: Warm clean canvas (`#FBFBFA`) with crisp slate borders (`#E2E8F0`).
- **Brand Identity**: Amber-500 accent (`#F59E0B`) with slate-950 contrast typography.
- **Content Cards**: Clean unboxed metadata discipline (level tags, duration, and checkpoint counts rendered cleanly without static pill clutter).
- **Responsive Navigation**: Retains persistent access to Lessons catalog, Live Classroom, Dataset Import/Export, and Teacher Portal.

---

## 3. Key Product Decisions & Trade-Offs

### 1. Unified Web Service vs. Separate Frontend/Backend Services
- **Decision**: Unified full-stack Web Service on Render.
- **Why**: Render's free tier allows 1 Web Service and 1 PostgreSQL database. Combining Express and the built Vite SPA into one service means zero CORS issues, identical domain cookies/headers, simplified environment variables, and zero deployment mismatch risk.

### 2. Database Adapter Pattern (PostgreSQL + Local Fallback)
- **Decision**: Create a universal database abstraction layer (`src/db/index.ts` / `server/db.ts`).
- **Why**: When deployed on Render with `DATABASE_URL`, it automatically connects to PostgreSQL with automatic table creation (`CREATE TABLE IF NOT EXISTS`). If `DATABASE_URL` is omitted (e.g. running in local development or AI Studio preview), it seamlessly falls back to the file-based store so development never breaks.

### 3. Real-Time Sync Strategy
- **Decision**: Server-authoritative polling and state synchronization via Express.
- **Why**: Extremely resilient across server restarts, requires zero proxy configuration on Render, and handles student reconnections without dropped socket states.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM OVERVIEW                               │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  [Client React App]                                                        │
│   ├── LessonCatalog (fetches /api/lessons)                                 │
│   ├── HomeworkPlayer (submits /api/reports/homework)                       │
│   ├── LiveClassroom (polls /api/live/session/:pin every 1s)                │
│   └── DatasetTools (Import/Export .json client-side)                       │
│                           │                                                │
│                           ▼ REST / JSON API                                │
│  [Express Server (server.ts)]                                              │
│   ├── Static Asset Middleware (serves dist/ HTML & bundled JS)             │
│   ├── Auth Controller (/api/auth/teacher-login, /api/auth/teachers)        │
│   ├── Lessons Controller (/api/lessons - GET, POST, DELETE, PUT)           │
│   ├── Live Classroom Store (/api/live/* - in-memory room heartbeat)        │
│   └── Reports Controller (/api/reports/*)                                  │
│                           │                                                │
│                           ▼ pg Connection Pool                             │
│  [PostgreSQL Tables]                                                       │
│   ├── lessons (id, title, data JSONB, is_published, created_at)            │
│   ├── session_reports (id, lesson_id, type, data JSONB, created_at)        │
│   └── teachers (id, name, email, password_hash, is_admin)                  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### PostgreSQL Schema Design
1. **`lessons` Table**:
   - `id`: VARCHAR(128) PRIMARY KEY
   - `title`: TEXT NOT NULL
   - `level`: VARCHAR(8) NOT NULL
   - `media_type`: VARCHAR(32) NOT NULL
   - `media_url`: TEXT NOT NULL
   - `is_published`: BOOLEAN DEFAULT TRUE
   - `teacher_id`: VARCHAR(128)
   - `teacher_name`: TEXT
   - `data`: JSONB NOT NULL (holds complete questions, captions, difficultWords, trim timestamps)
   - `created_at`: TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   - `updated_at`: TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP

2. **`session_reports` Table**:
   - `id`: VARCHAR(128) PRIMARY KEY
   - `lesson_id`: VARCHAR(128) REFERENCES lessons(id) ON DELETE CASCADE
   - `session_type`: VARCHAR(32) NOT NULL ('live' | 'homework')
   - `data`: JSONB NOT NULL (student answers, scores, timestamps)
   - `created_at`: TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP

3. **`teachers` Table**:
   - `id`: VARCHAR(128) PRIMARY KEY
   - `name`: TEXT NOT NULL
   - `email`: VARCHAR(255) UNIQUE NOT NULL
   - `password`: TEXT NOT NULL
   - `is_admin`: BOOLEAN DEFAULT FALSE

---

## 5. Step-by-Step Render Migration Guide

When you are ready to deploy to Render, follow these exact steps:

### Step 1: Push Project to GitHub
Ensure the latest codebase is pushed to your GitHub repository (e.g. `main` branch).

### Step 2: Create a PostgreSQL Database on Render
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** at the top right and select **PostgreSQL**.
3. Name your database (e.g., `allears-db`).
4. Select region (choose closest to you) and select the **Free** tier.
5. Click **Create Database**.
6. Once provisioned, locate the **Internal Database URL** (or **External Database URL**). Copy this value.

### Step 3: Create the Web Service on Render
1. In Render Dashboard, click **New +** and select **Web Service**.
2. Connect your GitHub repository (`AllEars`).
3. Fill in the service configuration:
   - **Name**: `allears`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Instance Type**: `Free`
4. Expand **Environment Variables** and add:
   - `DATABASE_URL`: *(Paste the Database URL from Step 2)*
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (or leave default; Render automatically injects `PORT`)
   - `GEMINI_API_KEY`: *(Optional, for AI vocabulary enrichment and open-ended answer grading)*
5. Click **Create Web Service**.

Render will automatically pull your repository, install dependencies, compile the Vite frontend, run database migrations, and launch the Express server. Your app will be live at `https://allears.onrender.com`!
