import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { INITIAL_LESSONS } from './src/data/mockLessons.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json({ limit: '25mb' }));

// Ensure database directory exists
const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const LESSONS_FILE = path.join(DATA_DIR, 'db-lessons.json');
const REPORTS_FILE = path.join(DATA_DIR, 'db-session-reports.json');

// Initialize GoogleGenAI server-side with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// In-memory store for synchronized live classroom sessions
interface LiveStudent {
  id: string;
  name: string;
  isBot?: boolean;
  score: number;
  answers: Record<string, any>; // questionId -> answer
  joinedAt: number;
}

interface LiveSession {
  pin: string;
  lessonId: string;
  teacherId: string;
  teacherName: string;
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  currentQuestionId: string | null;
  revealedFeedbackForQuestionId: string | null;
  activeVocabWord: any | null;
  isCompleted: boolean;
  students: Record<string, LiveStudent>;
  lastUpdated: number;
  createdAt: number;
}

const liveSessions: Record<string, LiveSession> = {};
// Track ended sessions so students cannot join and active viewers are told the session ended
const endedSessionPins: Record<string, number> = {};

// Teachers and Admin store
interface TeacherRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  isAdmin: boolean;
}

const teachersStore: Record<string, TeacherRecord> = {
  'chuck': {
    id: 'teacher-chuck',
    name: 'Chuck',
    email: 'ChuckACR1501@gmail.com',
    password: 'password123',
    isAdmin: true,
  },
  'ChuckACR1501@gmail.com': {
    id: 'teacher-chuck',
    name: 'Chuck',
    email: 'ChuckACR1501@gmail.com',
    password: 'password123',
    isAdmin: true,
  },
};

// Teacher Login API
app.post('/api/auth/teacher-login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password required' });
  }

  const normalized = username.trim().toLowerCase();
  const found = Object.values(teachersStore).find(
    (t) => t.email.toLowerCase() === normalized || t.name.toLowerCase() === normalized
  );

  if (!found || found.password !== password) {
    return res.status(401).json({ error: 'Invalid teacher account name or password.' });
  }

  res.json({
    success: true,
    user: {
      id: found.id,
      name: found.name,
      email: found.email,
      role: 'teacher',
      isAdmin: found.isAdmin,
    },
  });
});

// Admin adds a new teacher
app.post('/api/auth/add-teacher', (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password required' });
  }

  const id = `teacher-${Date.now()}`;
  const newTeacher: TeacherRecord = {
    id,
    name: name.trim(),
    email: email.trim(),
    password: password.trim(),
    isAdmin: false,
  };

  teachersStore[newTeacher.email.toLowerCase()] = newTeacher;
  teachersStore[newTeacher.name.toLowerCase()] = newTeacher;

  res.json({
    success: true,
    teacher: {
      id: newTeacher.id,
      name: newTeacher.name,
      email: newTeacher.email,
    },
  });
});

app.get('/api/auth/teachers', (_req: Request, res: Response) => {
  const list = Object.values(teachersStore).map(({ id, name, email, isAdmin }) => ({
    id,
    name,
    email,
    isAdmin,
  }));
  // Deduplicate by email
  const unique = Array.from(new Map(list.map((item) => [item.email, item])).values());
  res.json({ teachers: unique });
});

// Helper functions for database persistence and session reports
let sessionReports: any[] = [];
try {
  if (fs.existsSync(REPORTS_FILE)) {
    const raw = fs.readFileSync(REPORTS_FILE, 'utf-8');
    sessionReports = JSON.parse(raw);
  }
} catch (e) {
  console.warn('Could not read REPORTS_FILE, initializing empty/seed:', e);
}

// Seed initial session report if empty
if (!sessionReports || sessionReports.length === 0) {
  sessionReports = [
    {
      sessionId: 'sess-live-918234',
      pin: '918234',
      lessonId: 'lesson-curiosity-science',
      lessonTitle: 'Curiosity: The Science of Learning',
      teacherId: 'teacher-chuck',
      teacherName: 'Chuck',
      mode: 'live',
      createdAt: Date.now() - 86400000 * 2,
      endedAt: Date.now() - 86400000 * 2 + 1800000,
      totalStudents: 4,
      averageScore: 88,
      students: [
        {
          id: 'stu-alex',
          name: 'Alex Johnson',
          score: 30,
          maxScore: 30,
          percentage: 100,
          answers: { 'q1': { answer: 'a', isCorrect: true, points: 10 }, 'q2': { answer: 'true', isCorrect: true, points: 10 }, 'q3': { answer: 'hippocampus', isCorrect: true, points: 10 } },
          isBot: true,
          completedAt: new Date(Date.now() - 86400000 * 2 + 1500000).toLocaleString(),
        },
        {
          id: 'stu-maya',
          name: 'Maya Lin',
          score: 25,
          maxScore: 30,
          percentage: 83,
          answers: { 'q1': { answer: 'a', isCorrect: true, points: 10 }, 'q2': { answer: 'true', isCorrect: true, points: 10 }, 'q3': { answer: 'dopamine', isCorrect: false, points: 0 } },
          isBot: true,
          completedAt: new Date(Date.now() - 86400000 * 2 + 1600000).toLocaleString(),
        },
        {
          id: 'stu-liam',
          name: 'Liam Davies',
          score: 20,
          maxScore: 30,
          percentage: 67,
          answers: { 'q1': { answer: 'b', isCorrect: false, points: 0 }, 'q2': { answer: 'true', isCorrect: true, points: 10 }, 'q3': { answer: 'hippocampus', isCorrect: true, points: 10 } },
          isBot: true,
          completedAt: new Date(Date.now() - 86400000 * 2 + 1700000).toLocaleString(),
        },
        {
          id: 'stu-chloe',
          name: 'Chloe Dubois',
          score: 30,
          maxScore: 30,
          percentage: 100,
          answers: { 'q1': { answer: 'a', isCorrect: true, points: 10 }, 'q2': { answer: 'true', isCorrect: true, points: 10 }, 'q3': { answer: 'hippocampus', isCorrect: true, points: 10 } },
          isBot: true,
          completedAt: new Date(Date.now() - 86400000 * 2 + 1800000).toLocaleString(),
        },
      ],
      questionStats: {
        'q1': { questionId: 'q1', prompt: 'According to cognitive psychology, what causes curiosity?', type: 'multiple_choice', totalAnswered: 4, correctCount: 3, accuracy: 75 },
        'q2': { questionId: 'q2', prompt: 'Satisfying curiosity activates the dopamine reward pathway.', type: 'true_false', totalAnswered: 4, correctCount: 4, accuracy: 100 },
        'q3': { questionId: 'q3', prompt: 'Which part of the brain is primed when curiosity is activated?', type: 'close_ended', totalAnswered: 4, correctCount: 3, accuracy: 75 },
      },
    },
  ];
  try {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(sessionReports, null, 2), 'utf-8');
  } catch (e) {}
}

function saveReportsToDisk() {
  try {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(sessionReports, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write reports database to disk:', e);
  }
}

function archiveLiveSession(session: LiveSession) {
  const lesson = serverLessons.find((l: any) => l.id === session.lessonId);
  const questions: any[] = lesson?.questions || [];
  const maxPossiblePoints = questions.reduce((sum: number, q: any) => sum + (q.points || 10), 0) || 10;

  const studentsList = Object.values(session.students);
  const questionStats: Record<string, any> = {};

  questions.forEach((q: any) => {
    let totalAnswered = 0;
    let correctCount = 0;
    studentsList.forEach((stu) => {
      const stuAns = stu.answers[q.id];
      if (stuAns) {
        totalAnswered++;
        if (stuAns.isCorrect) correctCount++;
      }
    });
    questionStats[q.id] = {
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      totalAnswered,
      correctCount,
      accuracy: totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0,
    };
  });

  const studentsFormatted = studentsList.map((stu) => {
    const stuScore = stu.score || 0;
    const percentage = maxPossiblePoints > 0 ? Math.round((stuScore / maxPossiblePoints) * 100) : 100;
    return {
      id: stu.id,
      name: stu.name,
      score: stuScore,
      maxScore: maxPossiblePoints,
      percentage,
      answers: stu.answers,
      isBot: stu.isBot || false,
      joinedAt: stu.joinedAt,
      completedAt: new Date().toLocaleString(),
    };
  });

  const avgScore =
    studentsFormatted.length > 0
      ? Math.round(studentsFormatted.reduce((acc, s) => acc + s.percentage, 0) / studentsFormatted.length)
      : 0;

  const report = {
    sessionId: `live-sess-${session.pin}-${Date.now()}`,
    pin: session.pin,
    lessonId: session.lessonId,
    lessonTitle: lesson ? lesson.title : 'Live Listening Lesson',
    teacherId: session.teacherId,
    teacherName: session.teacherName || 'Teacher',
    mode: 'live',
    createdAt: session.createdAt || Date.now() - 900000,
    endedAt: Date.now(),
    totalStudents: studentsFormatted.length,
    averageScore: avgScore,
    students: studentsFormatted,
    questionStats,
  };

  sessionReports.unshift(report);
  saveReportsToDisk();

  endedSessionPins[session.pin] = Date.now();
  delete liveSessions[session.pin];

  return report;
}

// REST API for Live Sessions
app.post('/api/live/create', (req: Request, res: Response) => {
  const { lessonId, teacherId = 'teacher-chuck', teacherName = 'Chuck' } = req.body;

  // Auto-end and archive any active sessions previously hosted by this teacher
  Object.keys(liveSessions).forEach((oldPin) => {
    const s = liveSessions[oldPin];
    if (s && s.teacherId === teacherId) {
      archiveLiveSession(s);
    }
  });

  // Generate a friendly 6-digit pin
  const pin = Math.floor(100000 + Math.random() * 900000).toString();

  liveSessions[pin] = {
    pin,
    lessonId,
    teacherId,
    teacherName,
    currentTime: 0,
    isPlaying: false,
    playbackSpeed: 1,
    currentQuestionId: null,
    revealedFeedbackForQuestionId: null,
    activeVocabWord: null,
    isCompleted: false,
    students: {},
    lastUpdated: Date.now(),
    createdAt: Date.now(),
  };

  res.json({ success: true, session: liveSessions[pin] });
});

// Explicit endpoint to end live session and archive its report
app.post('/api/live/end', (req: Request, res: Response) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'Session PIN is required' });
  }

  const session = liveSessions[pin];
  if (!session) {
    if (endedSessionPins[pin]) {
      return res.json({ success: true, message: 'Session was already ended', isEnded: true });
    }
    return res.status(404).json({ error: 'Active session not found' });
  }

  const report = archiveLiveSession(session);
  res.json({ success: true, report, message: 'Session ended and archived successfully' });
});

app.get('/api/live/session/:pin', (req: Request, res: Response) => {
  const { pin } = req.params;
  if (endedSessionPins[pin]) {
    return res.status(410).json({ error: 'This live session has ended by the teacher.', isEnded: true });
  }
  const session = liveSessions[pin];
  if (!session) {
    return res.status(404).json({ error: 'Session not found or has expired' });
  }
  res.json({ session });
});

app.post('/api/live/join', (req: Request, res: Response) => {
  const { pin, studentId, studentName } = req.body;
  if (endedSessionPins[pin]) {
    return res.status(400).json({ error: 'This session has already ended by the teacher. Students can no longer join.' });
  }
  const session = liveSessions[pin];
  if (!session) {
    return res.status(404).json({ error: 'Invalid room PIN. Please check the code with your teacher.' });
  }

  const id = studentId || `stu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  session.students[id] = {
    id,
    name: studentName || 'Student',
    score: 0,
    answers: {},
    joinedAt: Date.now(),
  };
  session.lastUpdated = Date.now();

  res.json({ success: true, studentId: id, session });
});

app.post('/api/live/update-state', (req: Request, res: Response) => {
  const { pin, currentTime, isPlaying, playbackSpeed, currentQuestionId, isCompleted, activeVocabWord } = req.body;
  const session = liveSessions[pin];
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (currentTime !== undefined) session.currentTime = currentTime;
  if (isPlaying !== undefined) session.isPlaying = isPlaying;
  if (playbackSpeed !== undefined) session.playbackSpeed = playbackSpeed;
  if (currentQuestionId !== undefined) session.currentQuestionId = currentQuestionId;
  if (isCompleted !== undefined) session.isCompleted = isCompleted;
  if (activeVocabWord !== undefined) {
    session.activeVocabWord = activeVocabWord;
    if (activeVocabWord) {
      session.isPlaying = false;
    }
  }
  session.lastUpdated = Date.now();

  res.json({ success: true, session });
});

// Teacher reveals feedback & answers to the whole class
app.post('/api/live/reveal-feedback', (req: Request, res: Response) => {
  const { pin, questionId } = req.body;
  const session = liveSessions[pin];
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.revealedFeedbackForQuestionId = questionId;
  session.lastUpdated = Date.now();

  res.json({ success: true, session });
});

// Student submits an answer in live room
app.post('/api/live/submit-answer', (req: Request, res: Response) => {
  const { pin, studentId, questionId, answer, isCorrect, points = 0 } = req.body;
  const session = liveSessions[pin];
  if (!session || !session.students[studentId]) {
    return res.status(404).json({ error: 'Student or session not found' });
  }

  session.students[studentId].answers[questionId] = {
    answer,
    isCorrect,
    points,
    submittedAt: Date.now(),
  };
  if (isCorrect) {
    session.students[studentId].score += points;
  }
  session.lastUpdated = Date.now();

  res.json({ success: true, session });
});

// Simulated student bots engine for live classroom testing
app.post('/api/live/add-bot-students', (req: Request, res: Response) => {
  const { pin, count = 4 } = req.body;
  const session = liveSessions[pin];
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const sampleBots = [
    { name: 'Alex Johnson', id: 'bot-alex' },
    { name: 'Maya Lin', id: 'bot-maya' },
    { name: 'Liam Davies', id: 'bot-liam' },
    { name: 'Chloe Dubois', id: 'bot-chloe' },
    { name: 'Kenji Sato', id: 'bot-kenji' },
    { name: 'Sofia Rodriguez', id: 'bot-sofia' },
  ];

  const added: string[] = [];
  sampleBots.slice(0, count).forEach(bot => {
    session.students[bot.id] = {
      id: bot.id,
      name: bot.name,
      isBot: true,
      score: 0,
      answers: {},
      joinedAt: Date.now(),
    };
    added.push(bot.name);
  });

  session.lastUpdated = Date.now();
  res.json({ success: true, added, session });
});

// Bot auto-answer trigger when teacher opens a question in live session
app.post('/api/live/bot-answer', (req: Request, res: Response) => {
  const { pin, questionId, questionType, correctAnswer, options = [] } = req.body;
  const session = liveSessions[pin];
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const botIds = Object.keys(session.students).filter(id => session.students[id].isBot);
  botIds.forEach(botId => {
    const student = session.students[botId];
    if (student.answers[questionId]) return;

    // 75% chance of correct answer to simulate a realistic classroom
    const isCorrect = Math.random() < 0.75;
    let chosenAnswer = correctAnswer;

    if (!isCorrect && options.length > 1) {
      const wrongOptions = options.filter((opt: any) => opt.id !== correctAnswer && opt.text !== correctAnswer);
      if (wrongOptions.length > 0) {
        chosenAnswer = wrongOptions[Math.floor(Math.random() * wrongOptions.length)].id || wrongOptions[0].text;
      }
    }

    student.answers[questionId] = {
      answer: chosenAnswer,
      isCorrect,
      points: isCorrect ? 10 : 0,
      submittedAt: Date.now(),
    };
    if (isCorrect) student.score += 10;
  });

  session.lastUpdated = Date.now();
  res.json({ success: true, session });
});

// ==========================================
// Gemini AI Endpoints
// ==========================================

// AI Audio / Video Transcription & Subtitle Generation
app.post('/api/ai/transcribe', async (req: Request, res: Response) => {
  try {
    const { mediaTitle, mediaDescription, sampleTranscript } = req.body;

    const prompt = `You are an expert ESL/EFL listening curriculum specialist.
Generate a structured, timed subtitle transcript for an English listening lesson titled "${mediaTitle || 'English Conversation'}".
Context / Topic: ${mediaDescription || 'Natural English listening exercise'}.
${sampleTranscript ? `Reference transcript content: "${sampleTranscript}"` : ''}

Output an array of 5 to 10 timed caption lines in JSON format.
Each caption must have:
- start: float number (seconds)
- end: float number (seconds)
- text: natural spoken English text spoken in that segment
- speaker: speaker name or role (e.g. "Narrator", "Emma", "David")

Return strictly JSON matching this structure.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
              text: { type: Type.STRING },
              speaker: { type: Type.STRING },
            },
            required: ['start', 'end', 'text'],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    res.json({ success: true, captions: parsed });
  } catch (err: any) {
    console.error('Error in /api/ai/transcribe:', err);
    res.status(500).json({ error: err.message || 'Failed to generate transcription' });
  }
});

// AI Vocabulary Enrichment (B1, B2, C1, C2 identification, definitions, examples, Cambridge dictionary links)
app.post('/api/ai/vocab-enrich', async (req: Request, res: Response) => {
  try {
    const { transcriptText } = req.body;

    const prompt = `Analyze this English transcript for ESL learners:
"""
${transcriptText}
"""
Identify 4 to 8 challenging or notable vocabulary words, phrasal verbs, or idioms suitable for English learners.
Assign accurate CEFR levels (B1, B2, C1, or C2).
For each word:
- word: the target word or phrase in root form
- phonetic: IPA phonetic spelling e.g. "/ˌkɑːm.prəˈhen.ʃən/"
- cefrLevel: "B1", "B2", "C1", or "C2"
- partOfSpeech: "noun", "verb", "adjective", "adverb", "idiom", "phrasal verb", "pronoun", "preposition", "conjunction", "determiner", or "interjection"
- definition: learner-friendly clear definition
- example: an illustrative example sentence highlighting how to use it
- cambridgeSlug: URL slug for Cambridge Dictionary (e.g. "comprehension", "take-for-granted")

Return strictly a JSON array.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              phonetic: { type: Type.STRING },
              cefrLevel: { type: Type.STRING },
              partOfSpeech: { type: Type.STRING },
              definition: { type: Type.STRING },
              example: { type: Type.STRING },
              cambridgeSlug: { type: Type.STRING },
            },
            required: ['word', 'phonetic', 'cefrLevel', 'partOfSpeech', 'definition', 'example'],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    res.json({ success: true, words: parsed });
  } catch (err: any) {
    console.error('Error in /api/ai/vocab-enrich:', err);
    res.status(500).json({ error: err.message || 'Failed to enrich vocabulary' });
  }
});

// AI Formative Assessment Question Generator
app.post('/api/ai/generate-questions', async (req: Request, res: Response) => {
  try {
    const { transcript, videoDuration = 180 } = req.body;

    const prompt = `Based on the following English listening transcript:
"""
${transcript}
"""
Total video duration: ${videoDuration} seconds.
Create 3 high-quality formative listening assessment questions placed at meaningful timestamp checkpoints.
Include a variety of question types:
- multiple_choice (with 4 options, 1 correct)
- true_false (with True / False)
- matching (matching 3 terms with definitions or causes with effects)
- close_ended (short answer / fill-in-the-blank where students type a word heard)
- open_ended (reflection or synthesis question)

For each question:
- timestamp: integer seconds where the video should pause (must be between 10 and ${videoDuration - 10})
- type: 'multiple_choice' | 'true_false' | 'matching' | 'close_ended' | 'open_ended'
- prompt: clear instruction or question testing listening comprehension
- options: array of { id: string, text: string } (for multiple_choice and true_false)
- correctAnswer: correct option id or string value
- matchingPairs: array of { left: string, right: string } (for matching type)
- explanation: educational explanation why this is correct and what listener should notice

Return strictly a JSON array.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    res.json({ success: true, questions: parsed });
  } catch (err: any) {
    console.error('Error in /api/ai/generate-questions:', err);
    res.status(500).json({ error: err.message || 'Failed to generate questions' });
  }
});

// AI Feedback for Student Open-Ended Responses
app.post('/api/ai/grade-open-ended', async (req: Request, res: Response) => {
  try {
    const { questionPrompt, studentAnswer, listeningContext } = req.body;

    const prompt = `You are a supportive, encouraging English teacher assessing an ESL student's listening comprehension.
Question: "${questionPrompt}"
Listening context: "${listeningContext || ''}"
Student's answer: "${studentAnswer}"

Evaluate their listening comprehension and English expression.
Provide:
- score: integer from 0 to 100
- isPassing: boolean
- feedback: warm, encouraging 2-sentence feedback acknowledging what they understood well and offering one linguistic tip.

Return JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            isPassing: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
          },
          required: ['score', 'isPassing', 'feedback'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, result: parsed });
  } catch (err: any) {
    console.error('Error in /api/ai/grade-open-ended:', err);
    res.status(500).json({ error: err.message || 'Failed to grade response' });
  }
});

// YouTube Transcript & Captions Extraction with instant fallback & timeout protection
app.post('/api/youtube/transcript', async (req: Request, res: Response) => {
  try {
    const { videoUrl, videoId: providedId } = req.body;
    let videoId = providedId;
    if (!videoId && videoUrl) {
      const match = videoUrl.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
      if (match && match[2].length === 11) videoId = match[2];
    }

    if (!videoId) {
      return res.status(400).json({ error: 'Valid YouTube URL or Video ID is required' });
    }

    // Preset instant caption tracks for verified educational IDs
    const PRESET_CAPTIONS: Record<string, any[]> = {
      'f99P4eWbC9w': [
        { id: 'yt-1', start: 0, end: 8.5, text: 'Curiosity is an intrinsic drive—a psychological itch that compels us to investigate the unknown.', speaker: 'Narrator' },
        { id: 'yt-2', start: 8.6, end: 17.0, text: 'In cognitive psychology, the information gap theory explains why not knowing creates acute mental discomfort.', speaker: 'Narrator' },
        { id: 'yt-3', start: 17.2, end: 26.5, text: 'Neuroscientists have discovered that satisfying curiosity activates the brain\'s dopaminergic reward pathway.', speaker: 'Dr. Sarah' },
        { id: 'yt-4', start: 26.8, end: 36.0, text: 'Psychologists distinguish between perceptual curiosity and epistemic curiosity, the deep pursuit of knowledge.', speaker: 'Dr. Sarah' },
        { id: 'yt-5', start: 36.2, end: 46.5, text: 'When teachers harness epistemic curiosity, students exhibit higher retention because the hippocampus is primed.', speaker: 'Narrator' },
        { id: 'yt-6', start: 46.8, end: 57.0, text: 'So whenever you feel the urge to delve into an esoteric topic, remember your synapses are orchestrating discovery.', speaker: 'Narrator' },
      ],
      'M0yi0A9jGvY': [
        { id: 'yt-1', start: 0, end: 6.0, text: 'Hey Marcus! Over here by the window! It has been an absolute age since we last caught up.', speaker: 'Elena' },
        { id: 'yt-2', start: 6.2, end: 13.0, text: 'Elena! Good to see you. Sorry I\'m late, finding a parking spot was a total nightmare.', speaker: 'Marcus' },
        { id: 'yt-3', start: 13.5, end: 20.5, text: 'No worries at all. I actually ordered you a flat white already—I remembered you like oat milk.', speaker: 'Elena' },
        { id: 'yt-4', start: 21.0, end: 29.0, text: 'You\'re a lifesaver. So tell me everything! How did that interview at the environmental consultancy go?', speaker: 'Marcus' },
        { id: 'yt-5', start: 29.5, end: 39.0, text: 'It went surprisingly smoothly! The panel asked very practical questions about urban sustainability projects.', speaker: 'Elena' },
      ],
      'UF8uR6Z6KLc': [
        { id: 'yt-1', start: 0, end: 8.5, text: 'Good morning everyone. Let\'s cut to the chase: Q3 engineering deliverables are currently facing a bottleneck in QA testing.', speaker: 'Julian' },
        { id: 'yt-2', start: 9.0, end: 18.5, text: 'If we want to hit our November milestone without compromising software integrity, we need to deprioritize peripheral feature requests.', speaker: 'Julian' },
        { id: 'yt-3', start: 19.0, end: 27.5, text: 'From a marketing standpoint, postponing the localization roll-out is viable, provided the core analytics dashboard remains intact.', speaker: 'Clara' },
        { id: 'yt-4', start: 28.0, end: 37.5, text: 'Agreed. Let\'s establish a unified triage protocol so our engineers aren\'t pulled in disparate directions during the final sprint.', speaker: 'Julian' },
      ],
    };

    if (PRESET_CAPTIONS[videoId]) {
      return res.json({ success: true, source: 'verified_preset', captions: PRESET_CAPTIONS[videoId] });
    }

    // Attempt 1: Fetch from YouTube public timedtext XML with strict 2.5s timeout
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const ytResponse = await fetch(`https://video.google.com/timedtext?lang=en&v=${videoId}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const xmlText = await ytResponse.text();
      if (xmlText && xmlText.includes('<text')) {
        const regex = /<text start="([\d.]+)" dur="([\d.]+)">(.*?)<\/text>/g;
        const segments: any[] = [];
        let match;
        let idCounter = 1;
        while ((match = regex.exec(xmlText)) !== null) {
          const start = parseFloat(match[1]);
          const dur = parseFloat(match[2]);
          const rawText = match[3]
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
          segments.push({
            id: `yt-cap-${idCounter++}`,
            start: Math.round(start * 10) / 10,
            end: Math.round((start + dur) * 10) / 10,
            text: rawText.trim(),
            speaker: 'Speaker',
          });
        }
        if (segments.length > 0) {
          return res.json({ success: true, source: 'youtube_timedtext', captions: segments });
        }
      }
    } catch (e) {
      console.warn('Timedtext fetch timed out or failed, falling back to Gemini extraction');
    }

    // Attempt 2: Fast Gemini Subtitle Generation
    const prompt = `Generate a realistic 6-sentence timed English listening transcript for YouTube video ID "${videoId}".
Context: Natural spoken ESL listening material.
Format as JSON array with properties: start (float), end (float), text (string), speaker (string).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
              text: { type: Type.STRING },
              speaker: { type: Type.STRING },
            },
            required: ['start', 'end', 'text'],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    const formatted = parsed.map((c: any, idx: number) => ({
      id: `yt-cap-${idx + 1}`,
      start: c.start !== undefined ? c.start : idx * 8,
      end: c.end !== undefined ? c.end : (idx + 1) * 8,
      text: c.text,
      speaker: c.speaker || 'Speaker',
    }));

    return res.json({ success: true, source: 'gemini_enhanced', captions: formatted });
  } catch (err: any) {
    console.error('Error in /api/youtube/transcript:', err);
    // Guarantee response with fallback so the frontend NEVER hangs
    res.json({
      success: true,
      source: 'fallback',
      captions: [
        { id: 'fb-1', start: 0, end: 7.5, text: 'Welcome to this listening comprehension segment.', speaker: 'Speaker' },
        { id: 'fb-2', start: 8.0, end: 15.0, text: 'Please pay close attention to the main points and vocabulary.', speaker: 'Speaker' },
        { id: 'fb-3', start: 15.5, end: 23.0, text: 'Notice how the speaker emphasizes key details throughout the dialogue.', speaker: 'Speaker' },
      ],
    });
  }
});

// Shared server lessons store with persistent disk database
let serverLessons: any[] = [];
try {
  if (fs.existsSync(LESSONS_FILE)) {
    const raw = fs.readFileSync(LESSONS_FILE, 'utf-8');
    serverLessons = JSON.parse(raw);
  }
} catch (e) {
  console.warn('Could not read LESSONS_FILE, fallback to INITIAL_LESSONS:', e);
}

if (!serverLessons || serverLessons.length === 0) {
  serverLessons = [...INITIAL_LESSONS];
  try {
    fs.writeFileSync(LESSONS_FILE, JSON.stringify(serverLessons, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to initialize LESSONS_FILE on disk:', e);
  }
}

function saveLessonsToDisk() {
  try {
    fs.writeFileSync(LESSONS_FILE, JSON.stringify(serverLessons, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write lessons database to disk:', e);
  }
}

// Lessons CRUD API
app.get('/api/lessons', (req: Request, res: Response) => {
  const { role = 'student' } = req.query;
  // If student, only return published lessons
  if (role === 'student') {
    const published = serverLessons.filter((l) => l.isPublished !== false);
    return res.json({ lessons: published });
  }
  // If teacher, return all lessons including drafts
  res.json({ lessons: serverLessons });
});

app.post('/api/lessons', (req: Request, res: Response) => {
  const lesson = req.body;
  if (!lesson || !lesson.id) {
    return res.status(400).json({ error: 'Valid lesson object required' });
  }

  // Ensure isPublished defaults to true if not specified
  if (lesson.isPublished === undefined) {
    lesson.isPublished = true;
  }

  const existingIdx = serverLessons.findIndex((l) => l.id === lesson.id);
  if (existingIdx >= 0) {
    serverLessons[existingIdx] = lesson;
  } else {
    serverLessons.unshift(lesson);
  }

  // Save to database
  saveLessonsToDisk();

  res.json({ success: true, lesson });
});

app.delete('/api/lessons/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  serverLessons = serverLessons.filter((l) => l.id !== id);
  // Delete from database
  saveLessonsToDisk();
  res.json({ success: true, id });
});

app.patch('/api/lessons/:id/publish', (req: Request, res: Response) => {
  const { id } = req.params;
  const { isPublished } = req.body;
  const target = serverLessons.find((l) => l.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Lesson not found' });
  }

  target.isPublished = !!isPublished;
  // Save to database
  saveLessonsToDisk();
  res.json({ success: true, lesson: target });
});

// ==========================================
// Session Reports API (Per-Session Analytics)
// ==========================================

// Get all session reports (optionally filtered by lessonId or studentId)
app.get('/api/reports/sessions', (req: Request, res: Response) => {
  const { lessonId, role, studentId } = req.query;
  let filtered = [...sessionReports];

  if (lessonId && typeof lessonId === 'string') {
    filtered = filtered.filter((r) => r.lessonId === lessonId);
  }

  if (role === 'student' && studentId && typeof studentId === 'string') {
    filtered = filtered.filter((r) => r.students.some((s: any) => s.id === studentId));
  }

  res.json({ success: true, reports: filtered });
});

// Get a single session report
app.get('/api/reports/sessions/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const report = sessionReports.find((r) => r.sessionId === sessionId);
  if (!report) {
    return res.status(404).json({ error: 'Session report not found' });
  }
  res.json({ success: true, report });
});

// Record homework submission as an individual session report
app.post('/api/reports/homework', (req: Request, res: Response) => {
  const { submission } = req.body;
  if (!submission || !submission.lessonId) {
    return res.status(400).json({ error: 'Valid homework submission required' });
  }

  const lesson = serverLessons.find((l) => l.id === submission.lessonId);
  const questions: any[] = lesson?.questions || [];

  const questionStats: Record<string, any> = {};
  questions.forEach((q: any) => {
    const studentAns = submission.answers ? submission.answers[q.id] : null;
    const isCorrect = studentAns?.isCorrect;
    questionStats[q.id] = {
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      totalAnswered: studentAns ? 1 : 0,
      correctCount: isCorrect ? 1 : 0,
      accuracy: studentAns ? (isCorrect ? 100 : 0) : 0,
    };
  });

  const hwReport = {
    sessionId: `hw-sess-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    pin: 'HOMEWORK',
    lessonId: submission.lessonId,
    lessonTitle: lesson ? lesson.title : 'Homework Assignment',
    teacherId: lesson ? lesson.teacherId : 'teacher-chuck',
    teacherName: lesson ? lesson.teacherName : 'Chuck',
    mode: 'homework',
    createdAt: Date.now() - 600000,
    endedAt: Date.now(),
    totalStudents: 1,
    averageScore: submission.percentage || 0,
    students: [
      {
        id: submission.studentId,
        name: submission.studentName,
        score: submission.totalScore,
        maxScore: submission.maxScore,
        percentage: submission.percentage,
        answers: submission.answers || {},
        completedAt: submission.completedAt || new Date().toLocaleString(),
      },
    ],
    questionStats,
  };

  sessionReports.unshift(hwReport);
  saveReportsToDisk();

  res.json({ success: true, report: hwReport });
});

// Delete a session report
app.delete('/api/reports/sessions/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  sessionReports = sessionReports.filter((r) => r.sessionId !== sessionId);
  saveReportsToDisk();
  res.json({ success: true, sessionId });
});

// Setup Vite middleware in dev or static serving in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`All Ears listening platform running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
