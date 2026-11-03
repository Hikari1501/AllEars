# LinguaPulse: Interactive English Listening & Formative Assessment Platform

LinguaPulse is an interactive ESL/EFL video and audio listening comprehension platform inspired by Edpuzzle and Nearpod. It equips teachers to turn YouTube videos and audio tracks into engaging listening lessons with auto-pausing formative assessments, synchronized live classroom sessions, CEFR-graded interactive vocabulary glossaries, and comprehensive analytics.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during clarification:
> - **Media & Transcription Handling**: YouTube-first library with automatic video caption extraction, plus manual caption editing, custom audio upload, and Gemini AI transcription.
> - **Live Classroom Mode**: Full-stack synchronized classroom with live student response feeds, multi-tab/client sync, and an integrated **Student Bot Simulator** so teachers can immediately test real-time classroom flows with simulated peers.
> - **Visual Identity**: Warm academic aesthetic featuring deep navy, warm parchment neutrals, and amber gold accents.

---

### 1. Overview & Core Concept

- **What It Does**: Teachers design interactive listening lessons by embedding formative assessments (multiple-choice, true/false, matching pairs, close-ended fill-ins, and open-ended reflections) into YouTube videos or audio recordings. Lessons can be run in two modes:
  1. **Live Classroom Mode**: Teacher leads playback synchronously, pausing all student screens at question gates and displaying live aggregate response distribution.
  2. **Self-Paced Homework Mode**: Students progress at their own speed with optional skip-prevention, receiving instant feedback and vocabulary help.
- **Target Audience / Persona**: English language teachers, ESL/EFL instructors, and K-12/higher-ed students practicing active listening, listening-for-gist, and vocabulary acquisition.
- **Key Value**: Replaces passive video consumption with active comprehension checks, contextual vocabulary acquisition right inside the captions, and real-time formative insight into student listening gaps.

---

### 2. User Experience & Visual Design

#### Visual Identity & Theme
- **Aesthetic Direction**: Warm Academic. Grounded, scholarly, and inviting—combining timeless academic editorial poise with modern EdTech responsiveness.
- **Color Palette**:
  - Dominant Canvas: Warm off-white / parchment (`#FBFBFA` and `#F4F3EE`)
  - Deep Structural Contrast: Academic Navy (`#0F172A` / `#1E293B`)
  - Accent Gold & Amber: Warm Ochre (`#D97706` / `#F59E0B`) for playback progress, active timestamps, and interactive question callouts
  - Semantic Colors: Sage Emerald (`#059669`) for correct answers, Terracotta Rose (`#E11D48`) for incorrect answers, Indigo (`#4338CA`) for C1 advanced vocabulary, Teal (`#0D9488`) for B2 vocabulary
- **Typography**:
  - Display & Headings: `Plus Jakarta Sans` / `DM Sans` (bold, crisp, generous letter spacing)
  - Captions & Prose: `Public Sans` / `DM Sans` (16px, 1.6 line height for effortless subtitle readability)
  - Tabular Data & Timestamps: `JetBrains Mono` / `font-mono tabular-nums` for precise `01:24 / 04:50` counters
- **Zero-Pill & Anti-Slop Discipline**:
  - No decorative capsules or floating pills around dates, levels, or durations. Clean unboxed typographic dividers (`A2 Elementary · 4 min · 5 questions`).
  - Strict 3-zone top bar: Wordmark, navigation links (`whitespace-nowrap`), and quick role/account selector.
  - No thick left accent borders (`border-l-4`). Elegant subtle hairline borders (`border border-slate-200`).

#### Key User Flows
1. **Teacher Dashboard & Lesson Creator**:
   - Browse curated YouTube ESL listening lessons (BBC 6-Minute English, TED-Ed, Daily Dialogues, Workplace English) or input any YouTube URL / custom audio file.
   - Interactive timeline scrubber with timestamp markers showing where questions are placed.
   - Add/edit 5 question types: Multiple Choice, True/False, Matching Pairs, Close-Ended (exact/keyword match), Open-Ended.
   - Configure lesson parameters: Prevent skipping toggle, caption visibility, and vocabulary highlighting.
2. **Interactive Listening Player (Student / Homework Mode)**:
   - Full keyboard controls: Space/K (play/pause), Left/Right arrows (-5s / +5s rewind/forward), 1/2/3/4/5 keys (playback speeds: 0.75x, 1.0x, 1.25x, 1.5x, 2.0x).
   - Dynamic captions sync with playback. Difficult words are highlighted in subtle color tiers (B1, B2, C1).
   - Clicking any highlighted word opens a rich Vocabulary Card with phonetic pronunciation, part of speech, audio text-to-speech speak button, definition, example sentence, and illustrative graphic.
   - Video automatically pauses upon reaching a question timestamp. The interactive question drawer slides in smoothly. Students cannot skip past if skip-prevention is enabled.
3. **Live Classroom Experience**:
   - Teacher starts a live session, generating a 6-digit Join Code and direct URL.
   - Teacher view has Master Playback controls (play/pause/scrub), connected student roster, and live response bars that update in real time.
   - Integrated **Simulated Students toggle** (e.g. Alex, Maya, Liam, Chloe) allowing the teacher to test and demonstrate live classroom dynamics immediately without needing 5 physical devices.
   - Teacher can toggle "Reveal Class Responses" to project anonymous aggregated answers for class discussion.
4. **Reports & Learning Analytics**:
   - Teacher Report: Class mastery score, completion rate, question breakdown (identifying the most challenging audio segments), and student-by-student scorecards.
   - Student Report: Individual grade, transcript review with timestamp links, correct vs submitted answers, and personalized explanations.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: YouTube Iframe API + HTML5 Audio/Video Dual Player Engine**
  - *Chosen Approach*: Implement a unified player controller that seamlessly handles YouTube videos via the YouTube IFrame Player API and uploaded/direct audio files via HTML5 Audio API.
  - *Why*: YouTube is the #1 source of real-world ESL listening content. Combining it with standard HTML5 audio allows teachers to use podcast MP3s and custom voice recordings.
- **Decision 2: Live Synchronization & Student Simulation**
  - *Chosen Approach*: Multi-tab BroadcastChannel + Server sync with an integrated realistic Student Bot engine.
  - *Why*: Allows true multi-client classroom synchronization while providing single-click classroom simulation for solitary teachers testing or presenting lessons.
- **Decision 3: Server-Side Gemini AI for Audio Transcription & Smart Vocabulary Tagging**
  - *Chosen Approach*: Server-side endpoint using `@google/genai` to transcribe uploaded audio or enrich lesson captions with CEFR-leveled difficult vocabulary definitions and example sentences.
  - *Why*: Saves teachers hours of preparation time while keeping API keys secure on the server.
- **Decision 4: Client & Guest Account Architecture**
  - *Chosen Approach*: Role-based account system (Teacher & Student) with instant guest join (enter name & room code) and local session persistence.
  - *Why*: Removes friction for young learners and classroom students who cannot manage complex passwords.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LinguaPulse Application                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────┐                          ┌──────────────────────┐
│  Teacher Workspace   │                          │  Student Workspace   │
├──────────────────────┤                          ├──────────────────────┤
│ • Lesson Editor      │                          │ • Live Room / Code   │
│ • Question Timeline  │                          │ • Homework Player    │
│ • Live Broadcast Host│                          │ • Vocab Inspector    │
│ • Analytics & Export │                          │ • Review & Feedback  │
└──────────┬───────────┘                          └──────────┬───────────┘
           │                                                 │
           └────────────────────────┬────────────────────────┘
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │                Core Interactive Engine                  │
       ├─────────────────────────────────────────────────────────┤
       │ • Unified Player (YouTube IFrame + HTML5 Audio)         │
       │ • Keyboard Shortcuts Manager (Arrows, Speeds 1-5, Space)│
       │ • Question Interceptor & Auto-Pause Gatekeeper          │
       │ • Interactive Subtitles & Vocabulary Inspector          │
       │ • Live Session State Sync & Student Bot Engine          │
       └────────────────────────────┬────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────┐                          ┌──────────────────────┐
│ Express Server API   │                          │ Local Storage / Sync │
├──────────────────────┤                          ├──────────────────────┤
│ • POST /api/transcribe                          │ • Active Lessons     │
│ • POST /api/vocab-enrich                        │ • Student Submissions│
│ • Live Session State │                          │ • User Profiles      │
└──────────────────────┘                          └──────────────────────┘
```

#### Key Data Entities
- **Lesson**: `id`, `title`, `level` (A2, B1, B2, C1), `mediaType` ('youtube' | 'audio'), `mediaUrl`, `duration`, `preventSkipping`, `captions` (array of `{ id, start, end, text, words }`), `questions` (array of `Question`), `difficultWords` (array of `VocabEntry`).
- **Question**: `id`, `timestamp` (seconds), `type` ('multiple_choice' | 'true_false' | 'matching' | 'close_ended' | 'open_ended'), `prompt`, `options`, `correctAnswer`, `matchingPairs`, `explanation`.
- **VocabEntry**: `word`, `phonetic`, `cefrLevel`, `partOfSpeech`, `definition`, `example`, `imageUrl`.
- **LiveSession**: `pin`, `lessonId`, `teacherId`, `status` ('waiting' | 'playing' | 'question_active' | 'finished'), `currentTime`, `currentQuestionId`, `students` (array of `{ id, name, isBot, answers, connected }`), `revealAnswers`.
- **Submission**: `id`, `lessonId`, `studentName`, `score`, `totalPossible`, `answers`, `completedAt`.

---

### Verification & Testing Plan
- Test YouTube embed playback, play/pause synchronization, and arrow key seeking.
- Test playback speed hotkeys (`1` = 0.75x, `2` = 1x, `3` = 1.25x, `4` = 1.5x, etc.).
- Verify auto-pause triggers precisely at question timestamps without looping or bypassing.
- Verify skip-prevention locks the scrub bar until questions are submitted.
- Test all 5 question types: Multiple Choice, True/False, Matching, Close-ended text input, Open-ended text response.
- Test clicking difficult words in subtitles to reveal the phonetic audio, definition, and illustrative visual card.
- Test Live Classroom mode with Simulated Students and live class response percentage bars.
- Test Teacher Analytics summary and Student individual feedback report.
- Verify full TypeScript compilation via `compile_applet`.
