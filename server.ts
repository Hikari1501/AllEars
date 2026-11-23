import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { INITIAL_LESSONS } from './src/data/mockLessons.ts';
import {
  initDatabase,
  getDatabaseStatus,
  getActivePool,
  findTeacher,
  getTeacherById,
  addTeacher,
  updateTeacher,
  deleteTeacher,
  getAllTeachers,
  getAllLessons,
  getLessonById,
  saveLesson,
  deleteLesson,
  setLessonPublishStatus,
  getAllReports,
  saveSessionReport,
  deleteSessionReport,
  TeacherRecord,
  StudentRecord,
  findStudent,
  getStudentById,
  addStudent,
  updateStudent,
  getAllStudents,
  deleteStudent,
  getStudentLessons,
  saveStudentLesson,
  deleteStudentLesson,
  getStudentSavedVocab,
  saveStudentSavedVocabWord,
  deleteStudentSavedVocabWord,
  syncStudentSavedVocab,
} from './server/db.ts';
import {
  exportDatabaseSnapshot,
  migratePostgresToTarget,
  validateTargetUrl,
} from './server/migrate-core.ts';

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

// Lazy server-side GoogleGenAI initializer (reads key exclusively from server env)
function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err: any = new Error(
      'GEMINI_API_KEY is not configured in server environment secrets. Add it in Settings > Secrets (or your hosting environment variables).'
    );
    err.status = 503;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseGeminiJson<T>(rawText: string | undefined, fallback: T): T {
  if (!rawText) return fallback;
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!cleaned) return fallback;
  return JSON.parse(cleaned) as T;
}

function formatGeminiError(err: any, fallbackMessage: string): { status: number; message: string } {
  const rawMessage = String(err?.message || '');
  const numericStatus = Number(err?.status || err?.statusCode || 0);

  if (numericStatus === 503) {
    return { status: 503, message: rawMessage || fallbackMessage };
  }
  if (
    numericStatus === 400 ||
    numericStatus === 403 ||
    /API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(rawMessage)
  ) {
    return {
      status: numericStatus === 403 ? 403 : 400,
      message:
        'Gemini API key is invalid or lacks permission. Please verify GEMINI_API_KEY in Settings > Secrets (or your hosting environment variables).',
    };
  }
  if (numericStatus === 404 || /NOT_FOUND|is not found for API version/i.test(rawMessage)) {
    return {
      status: 404,
      message: 'The configured Gemini model could not be found or is unavailable.',
    };
  }
  if (numericStatus === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(rawMessage)) {
    return {
      status: 429,
      message:
        'Gemini API quota or rate limit was exceeded. Please try again shortly or check your API billing/quota in Settings > Secrets.',
    };
  }
  return {
    status: numericStatus >= 400 && numericStatus < 600 ? numericStatus : 500,
    message: rawMessage || fallbackMessage,
  };
}

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
  revealedKeyQuestionIds?: string[];
  activeVocabWord: any | null;
  activeStudentResponse: any | null;
  allowEditAnswer?: boolean;
  allowStudentCaptions?: boolean;
  allowStudentVideo?: boolean;
  autoPauseAtCheckpoints?: boolean;
  isCompleted: boolean;
  students: Record<string, LiveStudent>;
  lastUpdated: number;
  createdAt: number;
}

const liveSessions: Record<string, LiveSession> = {};
// Track ended sessions so students cannot join and active viewers are told the session ended
const endedSessionPins: Record<string, number> = {};

// Helper to extract authenticated teacher / admin identity from headers or body
function getRequester(req: Request) {
  const role = (req.headers['x-user-role'] || req.headers['role'] || req.body?.userRole || '').toString().toLowerCase();
  const userId = (req.headers['x-user-id'] || req.headers['x-teacher-id'] || req.body?.userId || req.body?.teacherId || '').toString();
  const userEmail = (req.headers['x-user-email'] || req.headers['x-teacher-email'] || req.body?.userEmail || req.body?.teacherEmail || '').toString().toLowerCase();
  const userName = (req.headers['x-user-name'] || req.headers['x-teacher-name'] || req.body?.userName || req.body?.teacherName || '').toString();
  const isAdminHeader = (req.headers['x-is-admin'] || req.headers['x-user-is-admin'] || '').toString().toLowerCase() === 'true';

  const isChuck = userEmail === 'chuckacr1501@gmail.com' || userId === 'teacher-chuck';
  const isAdmin = isChuck || isAdminHeader;

  return {
    role,
    userId,
    userEmail,
    userName,
    isAdmin,
  };
}

// Verify caller is an existing teacher or admin in database (blocks students and unauthenticated guests)
async function verifyTeacherOrAdminRequester(req: Request): Promise<TeacherRecord | null> {
  const { role, userId, userEmail } = getRequester(req);
  if (role !== 'teacher' && role !== 'admin') {
    return null;
  }

  let teacher: TeacherRecord | null = null;
  if (userId) {
    teacher = await getTeacherById(userId);
  }
  if (!teacher && userEmail) {
    teacher = await findTeacher(userEmail);
  }
  return teacher;
}

// Strict Admin verification requiring an existing Admin in DB AND valid current admin password
async function verifyAdminWithPassword(req: Request): Promise<TeacherRecord | null> {
  const teacher = await verifyTeacherOrAdminRequester(req);
  if (!teacher) return null;
  const isAdminAccount = Boolean(
    teacher.isAdmin || teacher.email.toLowerCase() === 'chuckacr1501@gmail.com' || teacher.id === 'teacher-chuck'
  );
  if (!isAdminAccount) return null;

  const suppliedPassword = typeof req.body?.adminPassword === 'string' ? req.body.adminPassword : '';
  if (!suppliedPassword || suppliedPassword !== teacher.password) {
    return null;
  }
  return teacher;
}

// Teacher Login API (Backed by PostgreSQL / DB)
app.post('/api/auth/teacher-login', async (req: Request, res: Response) => {
  const username = req.body.username || req.body.email;
  const password = req.body.password;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password required' });
  }

  const found = await findTeacher(username);

  if (!found || found.password !== password) {
    return res.status(401).json({ error: 'Invalid teacher account name or password.' });
  }

  const isChuck = found.email.toLowerCase() === 'chuckacr1501@gmail.com';
  const isAdmin = isChuck ? true : !!found.isAdmin;

  res.json({
    success: true,
    user: {
      id: found.id,
      name: found.name,
      email: found.email,
      role: 'teacher',
      isAdmin,
    },
  });
});

// Admin: Get all registered teachers (includes passwords if caller is Admin)
app.get('/api/auth/teachers', async (req: Request, res: Response) => {
  try {
    const requester = getRequester(req);
    const teachers = await getAllTeachers();

    if (requester.isAdmin) {
      return res.json({ teachers, isCallerAdmin: true });
    }

    res.json({
      teachers: teachers.map((t) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        isAdmin: t.isAdmin,
      })),
      isCallerAdmin: false,
    });
  } catch (e) {
    console.error('[API] Error fetching teachers:', e);
    res.status(500).json({ error: 'Failed to retrieve teachers' });
  }
});

// Admin: Authorize / create a new teacher account
app.post('/api/auth/add-teacher', async (req: Request, res: Response) => {
  const requester = getRequester(req);
  if (!requester.isAdmin) {
    return res.status(403).json({
      error: 'Permission denied: Only administrators can create teacher accounts.',
    });
  }

  const { name, email, password, isAdmin } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password required' });
  }

  const isChuck = email.trim().toLowerCase() === 'chuckacr1501@gmail.com';
  const id = `teacher-${Date.now()}`;
  const newTeacher: TeacherRecord = {
    id,
    name: name.trim(),
    email: email.trim(),
    password: password.trim(),
    isAdmin: isChuck ? true : Boolean(isAdmin),
  };

  await addTeacher(newTeacher);

  res.json({
    success: true,
    teacher: newTeacher,
  });
});

// Admin: Edit teacher account details (name, email, password, role)
app.put('/api/auth/teachers/:id', async (req: Request, res: Response) => {
  const requester = getRequester(req);
  if (!requester.isAdmin) {
    return res.status(403).json({
      error: 'Teachers cannot edit information of admins and other teachers. Administrator permission is required.',
    });
  }

  const { id } = req.params;
  const { name, email, password, isAdmin } = req.body;

  const existing = await getTeacherById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Teacher account not found.' });
  }

  const isChuck = (email || existing.email).toLowerCase() === 'chuckacr1501@gmail.com' || existing.id === 'teacher-chuck';

  const updated = await updateTeacher(id, {
    name: name?.trim(),
    email: email?.trim(),
    password: password?.trim(),
    isAdmin: isChuck ? true : isAdmin !== undefined ? Boolean(isAdmin) : existing.isAdmin,
  });

  res.json({ success: true, teacher: updated });
});

// Admin: Delete a teacher account
app.delete('/api/auth/teachers/:id', async (req: Request, res: Response) => {
  const requester = getRequester(req);
  if (!requester.isAdmin) {
    return res.status(403).json({
      error: 'Permission denied: Only administrators can delete teacher accounts.',
    });
  }

  const { id } = req.params;
  const existing = await getTeacherById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Teacher account not found.' });
  }

  if (existing.email.toLowerCase() === 'chuckacr1501@gmail.com' || existing.id === 'teacher-chuck') {
    return res.status(403).json({
      error: 'Cannot delete the primary administrator account (chuckacr1501@gmail.com).',
    });
  }

  await deleteTeacher(id);
  res.json({ success: true, id });
});

// Public student registration is disabled (student accounts are managed by teachers)
app.post('/api/auth/student-register', async (_req: Request, res: Response) => {
  return res.status(403).json({
    error: 'Student self-registration is disabled. Student accounts must be created by an authorized teacher.',
  });
});

// Teacher / Admin: Get registered student accounts
// - If caller is Admin: gets all students across all classes
// - If caller is Teacher: gets only students assigned to their class
app.get('/api/teacher/students', async (req: Request, res: Response) => {
  try {
    const requester = getRequester(req);
    let students: StudentRecord[] = [];

    if (requester.isAdmin) {
      students = await getAllStudents();
    } else if (requester.userId) {
      students = await getAllStudents(requester.userId);
    } else {
      students = await getAllStudents();
    }

    res.json({
      students,
      isCallerAdmin: requester.isAdmin,
      callerTeacherId: requester.userId,
    });
  } catch (e) {
    console.error('[API] Error fetching student accounts:', e);
    res.status(500).json({ error: 'Failed to retrieve students' });
  }
});

// Teacher / Admin: Create a new student account (automatically assigned to teacher's class)
app.post('/api/teacher/students', async (req: Request, res: Response) => {
  const { name, email, password, teacherId, teacherName, className } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email/username, and password required' });
  }

  const requester = getRequester(req);

  // If admin specified a specific teacher, use it; otherwise assign to the logged-in teacher
  const assignedTeacherId = (requester.isAdmin && teacherId) ? teacherId : (requester.userId || 'teacher-chuck');
  const assignedTeacherName = (requester.isAdmin && teacherName) ? teacherName : (requester.userName || 'Chuck');
  const assignedClassName = className || `${assignedTeacherName}'s Class`;

  const existing = await findStudent(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email or username already exists.' });
  }

  const newStudent: StudentRecord = {
    id: `student-${Date.now()}`,
    name: name.trim(),
    email: email.trim(),
    password: password.trim(),
    teacherId: assignedTeacherId,
    teacherName: assignedTeacherName,
    className: assignedClassName,
    createdAt: new Date().toISOString(),
  };

  await addStudent(newStudent);

  res.json({
    success: true,
    student: newStudent,
  });
});

// Teacher / Admin: Edit student username, display name, password
// - Teacher can ONLY edit students in their class
// - Admin can edit any student
app.put('/api/teacher/students/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, password, teacherId, teacherName, className } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Student ID required' });
  }

  const existing = await getStudentById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Student account not found.' });
  }

  const requester = getRequester(req);

  // Requirement: "Only the teacher of that class can delete, edit username, display name, password of students in that class. Admins can edit any student"
  const isClassTeacher = requester.userId && existing.teacherId === requester.userId;
  const isEmailMatch = requester.userEmail && existing.teacherId === requester.userEmail;

  if (!requester.isAdmin && !isClassTeacher && !isEmailMatch) {
    return res.status(403).json({
      error: 'Permission denied: Only the teacher of this class or an administrator can edit this student account.',
    });
  }

  if (email && email.trim().toLowerCase() !== existing.email.toLowerCase()) {
    const collision = await findStudent(email.trim());
    if (collision && collision.id !== id) {
      return res.status(409).json({ error: 'An account with this email or username already exists.' });
    }
  }

  const updated = await updateStudent(id, {
    name: name?.trim(),
    email: email?.trim(),
    password: password?.trim(),
    teacherId: requester.isAdmin && teacherId ? teacherId : existing.teacherId,
    teacherName: requester.isAdmin && teacherName ? teacherName : existing.teacherName,
    className: requester.isAdmin && className ? className : existing.className,
  });

  res.json({ success: true, student: updated });
});

// Teacher / Admin: Delete a student account
// - Teacher can ONLY delete students in their class
// - Admin can delete any student
app.delete('/api/teacher/students/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Student ID required' });
  }

  const existing = await getStudentById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Student account not found' });
  }

  const requester = getRequester(req);
  const isClassTeacher = requester.userId && existing.teacherId === requester.userId;
  const isEmailMatch = requester.userEmail && existing.teacherId === requester.userEmail;

  if (!requester.isAdmin && !isClassTeacher && !isEmailMatch) {
    return res.status(403).json({
      error: 'Permission denied: Only the teacher of this class or an administrator can delete this student account.',
    });
  }

  try {
    await deleteStudent(id);
    res.json({ success: true, id });
  } catch (e) {
    console.error('[API] Error deleting student account:', e);
    res.status(500).json({ error: 'Failed to delete student account' });
  }
});

// Student Login API (Backed by PostgreSQL / DB)
app.post('/api/auth/student-login', async (req: Request, res: Response) => {
  const username = req.body.username || req.body.email;
  const password = req.body.password;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password required' });
  }

  const found = await findStudent(username);
  if (!found || found.password !== password) {
    return res.status(401).json({ error: 'Invalid student username/email or password.' });
  }

  res.json({
    success: true,
    user: {
      id: found.id,
      name: found.name,
      email: found.email,
      role: 'student',
    },
  });
});

// Student Private Lessons API (Private to each student, not shared with others)
app.get('/api/student-lessons', async (req: Request, res: Response) => {
  const studentId = (req.headers['x-student-id'] || req.query.studentId) as string;
  if (!studentId) {
    return res.json({ lessons: [] });
  }

  try {
    const lessons = await getStudentLessons(studentId);
    res.json({ lessons });
  } catch (e) {
    console.error('[API] Error getting student lessons:', e);
    res.status(500).json({ error: 'Failed to retrieve student lessons' });
  }
});

app.post('/api/student-lessons', async (req: Request, res: Response) => {
  const studentId = (req.headers['x-student-id'] || req.body.studentId) as string;
  const lesson = req.body.lesson || req.body;
  if (!studentId || !lesson || !lesson.id) {
    return res.status(400).json({ error: 'Student ID and valid lesson required' });
  }

  try {
    const saved = await saveStudentLesson(studentId, lesson);
    res.json({ success: true, lesson: saved });
  } catch (e) {
    console.error('[API] Error saving student private lesson:', e);
    res.status(500).json({ error: 'Failed to save student lesson' });
  }
});

app.delete('/api/student-lessons/:id', async (req: Request, res: Response) => {
  const studentId = (req.headers['x-student-id'] || req.query.studentId) as string;
  const { id } = req.params;
  if (!studentId) {
    return res.status(400).json({ error: 'Student ID required' });
  }

  try {
    await deleteStudentLesson(studentId, id);
    res.json({ success: true, id });
  } catch (e) {
    console.error('[API] Error deleting student lesson:', e);
    res.status(500).json({ error: 'Failed to delete student lesson' });
  }
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

async function archiveLiveSession(session: LiveSession) {
  const lesson = await getLessonById(session.lessonId);
  const questions: any[] = lesson?.questions || [];
  const maxPossiblePoints = questions.reduce((sum: number, q: any) => sum + (q.type === 'open_ended' ? 0 : (q.points || 10)), 0) || 10;

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

  await saveSessionReport(report);

  endedSessionPins[session.pin] = Date.now();
  delete liveSessions[session.pin];

  return report;
}

// REST API for Live Sessions
app.post('/api/live/create', async (req: Request, res: Response) => {
  const { lessonId, teacherId = 'teacher-chuck', teacherName = 'Chuck' } = req.body;

  // Auto-end and archive any active sessions previously hosted by this teacher
  for (const oldPin of Object.keys(liveSessions)) {
    const s = liveSessions[oldPin];
    if (s && s.teacherId === teacherId) {
      await archiveLiveSession(s);
    }
  }

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
    revealedKeyQuestionIds: [],
    activeVocabWord: null,
    activeStudentResponse: null,
    allowEditAnswer: false,
    allowStudentCaptions: false,
    allowStudentVideo: false,
    autoPauseAtCheckpoints: true,
    isCompleted: false,
    students: {},
    lastUpdated: Date.now(),
    createdAt: Date.now(),
  };

  res.json({ success: true, session: liveSessions[pin] });
});

// Explicit endpoint to end live session and archive its report
app.post('/api/live/end', async (req: Request, res: Response) => {
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

  const report = await archiveLiveSession(session);
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

// Update live session state (supported via /api/live/update-state and /api/live/update alias)
const handleUpdateSessionState = (req: Request, res: Response) => {
  const { pin, currentTime, isPlaying, playbackSpeed, currentQuestionId, isCompleted, activeVocabWord, activeStudentResponse, allowEditAnswer, allowStudentCaptions, allowStudentVideo, autoPauseAtCheckpoints, revealedKeyQuestionIds } = req.body;
  const session = liveSessions[pin];
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (currentTime !== undefined) session.currentTime = currentTime;
  if (isPlaying !== undefined) session.isPlaying = isPlaying;
  if (playbackSpeed !== undefined) session.playbackSpeed = playbackSpeed;
  if (currentQuestionId !== undefined) session.currentQuestionId = currentQuestionId;
  if (isCompleted !== undefined) session.isCompleted = isCompleted;
  if (allowEditAnswer !== undefined) session.allowEditAnswer = Boolean(allowEditAnswer);
  if (allowStudentCaptions !== undefined) session.allowStudentCaptions = Boolean(allowStudentCaptions);
  if (allowStudentVideo !== undefined) session.allowStudentVideo = Boolean(allowStudentVideo);
  if (autoPauseAtCheckpoints !== undefined) session.autoPauseAtCheckpoints = Boolean(autoPauseAtCheckpoints);
  if (Array.isArray(revealedKeyQuestionIds)) {
    session.revealedKeyQuestionIds = revealedKeyQuestionIds.filter((id) => typeof id === 'string');
  }
  if (activeVocabWord !== undefined) {
    session.activeVocabWord = activeVocabWord;
    if (activeVocabWord) {
      session.isPlaying = false;
    }
  }
  if (activeStudentResponse !== undefined) {
    session.activeStudentResponse = activeStudentResponse;
  }
  session.lastUpdated = Date.now();

  res.json({ success: true, session });
};

app.post('/api/live/update-state', handleUpdateSessionState);
app.post('/api/live/update', handleUpdateSessionState);

// Teacher reveals or hides the answer key for a specific question to the whole class
app.post('/api/live/show-key', (req: Request, res: Response) => {
  const { pin, questionId, show } = req.body;
  const session = liveSessions[pin];
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (!questionId || typeof questionId !== 'string') {
    return res.status(400).json({ error: 'questionId is required' });
  }

  const current = Array.isArray(session.revealedKeyQuestionIds)
    ? session.revealedKeyQuestionIds
    : [];
  const shouldShow = show !== undefined ? Boolean(show) : !current.includes(questionId);

  if (shouldShow) {
    session.revealedKeyQuestionIds = current.includes(questionId)
      ? current
      : [...current, questionId];
    session.revealedFeedbackForQuestionId = questionId;
  } else {
    session.revealedKeyQuestionIds = current.filter((id) => id !== questionId);
    if (session.revealedFeedbackForQuestionId === questionId) {
      session.revealedFeedbackForQuestionId = null;
    }
  }
  session.lastUpdated = Date.now();

  res.json({ success: true, session });
});

// Legacy reveal-feedback alias (also reveals key for questionId)
app.post('/api/live/reveal-feedback', (req: Request, res: Response) => {
  const { pin, questionId } = req.body;
  const session = liveSessions[pin];
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.revealedFeedbackForQuestionId = questionId;
  if (questionId && typeof questionId === 'string') {
    const current = Array.isArray(session.revealedKeyQuestionIds)
      ? session.revealedKeyQuestionIds
      : [];
    if (!current.includes(questionId)) {
      session.revealedKeyQuestionIds = [...current, questionId];
    }
  }
  session.lastUpdated = Date.now();

  res.json({ success: true, session });
});

// Student submits an answer in live room (with support for editing answers if permitted by teacher)
app.post('/api/live/submit-answer', (req: Request, res: Response) => {
  const { pin, studentId, questionId, answer, isCorrect, points = 0 } = req.body;
  const session = liveSessions[pin];
  if (!session || !session.students[studentId]) {
    return res.status(404).json({ error: 'Student or session not found' });
  }

  const existingAnswer = session.students[studentId].answers[questionId];
  if (existingAnswer && !session.allowEditAnswer) {
    return res.status(403).json({ error: 'Editing answers is locked by your teacher.' });
  }

  // Adjust score if updating an existing answer
  if (existingAnswer) {
    session.students[studentId].score = Math.max(0, session.students[studentId].score - (existingAnswer.points || 0));
  }

  session.students[studentId].answers[questionId] = {
    answer,
    isCorrect,
    points,
    submittedAt: Date.now(),
  };
  session.students[studentId].score += (points || 0);
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

// AI Audio / Video Transcription & Subtitle Generation (Teachers & Admins only)
app.post('/api/ai/transcribe', async (req: Request, res: Response) => {
  try {
    const teacher = await verifyTeacherOrAdminRequester(req);
    if (!teacher) {
      return res.status(403).json({
        error: 'Permission denied: AI features are restricted to teachers and admins only.',
      });
    }
    const ai = getGeminiClient();
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
      model: 'gemini-4-hydrogen',
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

    const parsed = parseGeminiJson<any[]>(response.text, []);
    res.json({ success: true, captions: Array.isArray(parsed) ? parsed : [] });
  } catch (err: any) {
    console.error('Error in /api/ai/transcribe:', err);
    const { status, message } = formatGeminiError(err, 'Failed to generate transcription');
    res.status(status).json({ error: message });
  }
});

// AI Vocabulary Enrichment (Teachers & Admins only)
app.post('/api/ai/vocab-enrich', async (req: Request, res: Response) => {
  try {
    const teacher = await verifyTeacherOrAdminRequester(req);
    if (!teacher) {
      return res.status(403).json({
        error: 'Permission denied: AI features are restricted to teachers and admins only.',
      });
    }
    const transcriptText = typeof req.body?.transcriptText === 'string' ? req.body.transcriptText.trim() : '';
    if (!transcriptText) {
      return res.status(400).json({
        error: 'Please add captions, a lesson title, or description before running AI vocabulary detection.',
      });
    }

    const ai = getGeminiClient();

    const prompt = `Analyze this English listening lesson text for ESL/EFL learners:
"""
${transcriptText}
"""
Identify 4 to 8 challenging or notable vocabulary words, phrasal verbs, or idioms present in or directly relevant to this text.
Assign accurate CEFR levels (A1, A2, B1, B2, C1, or C2).
For each entry provide:
- word: the target word or phrase in base/root form
- inflections: array containing ONLY inflected or conjugated forms of this word/phrase that literally appear in the text above (e.g. include "tried on" ONLY if "tried on" actually appears in the text). If no inflected forms appear in the text above, return an empty array [] — NEVER add forms that do not appear in the text!
- vietnameseTranslation: concise, natural Vietnamese translation of the word/phrase in this context
- phonetic: IPA phonetic pronunciation (e.g. "/ɪnˈtrɪn.zɪk/")
- cefrLevel: one of "A1", "A2", "B1", "B2", "C1", "C2"
- partOfSpeech: one of "noun", "verb", "adjective", "adverb", "idiom", "phrasal verb", "pronoun", "preposition", "conjunction", "determiner", "interjection"
- definition: clear, learner-friendly definition
- example: an illustrative example sentence showing natural usage
- cambridgeSlug: lowercase hyphenated Cambridge Dictionary URL slug (e.g. "intrinsic", "take-for-granted")`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an expert ESL/EFL lexicographer and curriculum designer. Return accurate CEFR-graded vocabulary entries with inflections and Vietnamese translations strictly matching the JSON schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              inflections: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              vietnameseTranslation: { type: Type.STRING },
              phonetic: { type: Type.STRING },
              cefrLevel: { type: Type.STRING },
              partOfSpeech: { type: Type.STRING },
              definition: { type: Type.STRING },
              example: { type: Type.STRING },
              cambridgeSlug: { type: Type.STRING },
            },
            required: [
              'word',
              'inflections',
              'vietnameseTranslation',
              'phonetic',
              'cefrLevel',
              'partOfSpeech',
              'definition',
              'example',
            ],
          },
        },
      },
    });

    const allowedLevels = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    const allowedPos = new Set([
      'noun',
      'verb',
      'adjective',
      'adverb',
      'pronoun',
      'preposition',
      'conjunction',
      'determiner',
      'interjection',
      'idiom',
      'phrasal verb',
    ]);

    const rawList = parseGeminiJson<any[]>(response.text, []);
    const words = (Array.isArray(rawList) ? rawList : [])
      .filter((item) => item && typeof item.word === 'string' && item.word.trim().length > 0)
      .map((item) => {
        const cleanWord = item.word.trim();
        const normalizedLevel = String(item.cefrLevel || 'B2').toUpperCase().trim();
        const normalizedPos = String(item.partOfSpeech || 'noun').toLowerCase().trim();
        const slugSource =
          typeof item.cambridgeSlug === 'string' && item.cambridgeSlug.trim()
            ? item.cambridgeSlug.trim()
            : cleanWord;
        const rawInflections = Array.isArray(item.inflections) ? item.inflections : [];
        const seenInf = new Set<string>([cleanWord.toLowerCase()]);
        const doesInflectionAppearInTranscript = (term: string): boolean => {
          const tokens = term
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          if (tokens.length === 0) return false;
          const patternStr = tokens.join('\\s+');
          const regex = new RegExp(`(?<![\\p{L}\\p{N}_])${patternStr}(?![\\p{L}\\p{N}_])`, 'iu');
          return regex.test(transcriptText);
        };
        const cleanInflections: string[] = [];
        for (const inf of rawInflections) {
          if (typeof inf !== 'string') continue;
          const trimmed = inf.trim();
          const lower = trimmed.toLowerCase();
          if (trimmed && !seenInf.has(lower) && doesInflectionAppearInTranscript(trimmed)) {
            seenInf.add(lower);
            cleanInflections.push(trimmed);
          }
        }
        const viTrans =
          typeof item.vietnameseTranslation === 'string'
            ? item.vietnameseTranslation.trim()
            : '';

        return {
          word: cleanWord,
          inflections: cleanInflections.length > 0 ? cleanInflections : undefined,
          vietnameseTranslation: viTrans || undefined,
          phonetic: typeof item.phonetic === 'string' ? item.phonetic.trim() : '',
          cefrLevel: allowedLevels.has(normalizedLevel) ? normalizedLevel : 'B2',
          partOfSpeech: allowedPos.has(normalizedPos) ? normalizedPos : 'noun',
          definition: typeof item.definition === 'string' ? item.definition.trim() : '',
          example: typeof item.example === 'string' ? item.example.trim() : '',
          cambridgeSlug: slugSource
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-'),
        };
      });

    res.json({ success: true, words });
  } catch (err: any) {
    console.error('Error in /api/ai/vocab-enrich:', err);
    const { status, message } = formatGeminiError(err, 'Failed to enrich vocabulary');
    res.status(status).json({ error: message });
  }
});

// AI Formative Assessment Question Generator (Teachers & Admins only)
app.post('/api/ai/generate-questions', async (req: Request, res: Response) => {
  try {
    const teacher = await verifyTeacherOrAdminRequester(req);
    if (!teacher) {
      return res.status(403).json({
        error: 'Permission denied: AI features are restricted to teachers and admins only.',
      });
    }
    const ai = getGeminiClient();
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
- drag_and_drop (categorizing 4-6 items into 2-3 categories)
- close_ended (short answer / fill-in-the-blank where students type a word heard)
- open_ended (reflection or synthesis question)

For each question:
- timestamp: integer seconds where the video should pause (must be between 10 and ${videoDuration - 10})
- type: 'multiple_choice' | 'true_false' | 'matching' | 'drag_and_drop' | 'close_ended' | 'open_ended'
- prompt: clear instruction or question testing listening comprehension
- options: array of { id: string, text: string } (for multiple_choice and true_false)
- correctAnswer: correct option id or string value
- matchingPairs: array of { left: string, right: string } (for matching type)
- categories: array of { id: string, name: string, items: string[] } (for drag_and_drop type)
- tip: optional helpful hint for students (string)
- explanation: educational explanation why this is correct and what listener should notice

Return strictly a JSON array.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = parseGeminiJson<any[]>(response.text, []);
    res.json({ success: true, questions: Array.isArray(parsed) ? parsed : [] });
  } catch (err: any) {
    console.error('Error in /api/ai/generate-questions:', err);
    const { status, message } = formatGeminiError(err, 'Failed to generate questions');
    res.status(status).json({ error: message });
  }
});

// AI Feedback for Open-Ended Responses (Teachers & Admins only)
app.post('/api/ai/grade-open-ended', async (req: Request, res: Response) => {
  try {
    const teacher = await verifyTeacherOrAdminRequester(req);
    if (!teacher) {
      return res.status(403).json({
        error: 'Permission denied: AI features are restricted to teachers and admins only.',
      });
    }
    const ai = getGeminiClient();
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
      model: 'gemini-4-hydrogen',
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

    const parsed = parseGeminiJson<Record<string, any>>(response.text, {});
    res.json({ success: true, result: parsed });
  } catch (err: any) {
    console.error('Error in /api/ai/grade-open-ended:', err);
    const { status, message } = formatGeminiError(err, 'Failed to grade response');
    res.status(status).json({ error: message });
  }
});

// YouTube Metadata / Original Duration Extraction
app.post('/api/youtube/metadata', async (req: Request, res: Response) => {
  try {
    const { videoUrl, videoId: providedId } = req.body || {};
    let videoId = typeof providedId === 'string' ? providedId.trim() : '';
    if (!videoId && typeof videoUrl === 'string') {
      const match = videoUrl.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/);
      if (match && match[2] && match[2].length === 11) {
        videoId = match[2];
      }
    }

    if (!videoId) {
      return res.status(400).json({ error: 'Valid YouTube URL or Video ID is required' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const ytRes = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeout);

    if (!ytRes.ok) {
      return res.json({ success: false, duration: 0 });
    }

    const html = await ytRes.text();
    let duration = 0;

    const lengthSecMatch = html.match(/"lengthSeconds":"(\d+)"/);
    if (lengthSecMatch && lengthSecMatch[1]) {
      duration = parseInt(lengthSecMatch[1], 10);
    }

    if (!duration) {
      const approxMsMatch = html.match(/"approxDurationMs":"(\d+)"/);
      if (approxMsMatch && approxMsMatch[1]) {
        duration = Math.round(parseInt(approxMsMatch[1], 10) / 1000);
      }
    }

    if (!duration) {
      const isoMatch = html.match(/itemprop="duration" content="PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"/);
      if (isoMatch) {
        const hrs = parseInt(isoMatch[1] || '0', 10);
        const mins = parseInt(isoMatch[2] || '0', 10);
        const secs = parseInt(isoMatch[3] || '0', 10);
        duration = hrs * 3600 + mins * 60 + secs;
      }
    }

    return res.json({ success: duration > 0, duration: Number.isFinite(duration) && duration > 0 ? duration : 0 });
  } catch (err) {
    console.warn('Could not fetch YouTube metadata:', err);
    return res.json({ success: false, duration: 0 });
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
          });
        }
        if (segments.length > 0) {
          return res.json({ success: true, source: 'youtube_timedtext', captions: segments });
        }
      }
    } catch (e) {
      console.warn('Timedtext fetch timed out or failed, falling back to Gemini extraction');
    }

    // Attempt 2: Fast Gemini Subtitle Generation (Teachers & Admins only)
    const teacher = await verifyTeacherOrAdminRequester(req);
    if (!teacher) {
      return res.status(403).json({
        error: 'Could not find YouTube captions. AI caption generation is restricted to teachers and admins only.',
      });
    }
    const ai = getGeminiClient();
    const prompt = `Generate a realistic 6-sentence timed English listening transcript for YouTube video ID "${videoId}".
Context: Natural spoken ESL listening material.
Format as JSON array with properties: start (float), end (float), text (string), speaker (optional string).`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
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

    const parsed = parseGeminiJson<any[]>(response.text, []);
    const formatted = (Array.isArray(parsed) ? parsed : []).map((c: any, idx: number) => ({
      id: `yt-cap-${idx + 1}`,
      start: c.start !== undefined ? c.start : idx * 8,
      end: c.end !== undefined ? c.end : (idx + 1) * 8,
      text: c.text,
      speaker:
        typeof c.speaker === 'string' && c.speaker.trim() && c.speaker.trim().toLowerCase() !== 'speaker'
          ? c.speaker.trim()
          : undefined,
    }));

    return res.json({ success: true, source: 'gemini_enhanced', captions: formatted });
  } catch (err: any) {
    console.error('Error in /api/youtube/transcript:', err);
    // Guarantee response with fallback so the frontend NEVER hangs
    res.json({
      success: true,
      source: 'fallback',
      captions: [
        { id: 'fb-1', start: 0, end: 7.5, text: 'Welcome to this listening comprehension segment.' },
        { id: 'fb-2', start: 8.0, end: 15.0, text: 'Please pay close attention to the main points and vocabulary.' },
        { id: 'fb-3', start: 15.5, end: 23.0, text: 'Notice how the speaker emphasizes key details throughout the dialogue.' },
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

// Helper middleware/check for teacher-only operations
function isTeacherAuthorized(req: Request): boolean {
  const roleHeader = (req.headers['x-user-role'] || req.headers['role'] || '') as string;
  const bodyRole = req.body?.userRole as string | undefined;
  return roleHeader.toLowerCase() === 'teacher' || bodyRole === 'teacher';
}

// Lessons CRUD API (Backed by PostgreSQL / DB)
app.get('/api/lessons', async (req: Request, res: Response) => {
  const { role = 'student' } = req.query;
  try {
    const lessons = await getAllLessons(role === 'teacher');
    res.json({ lessons });
  } catch (e) {
    console.error('[API] Error getting lessons:', e);
    res.status(500).json({ error: 'Failed to retrieve lessons' });
  }
});

app.post('/api/lessons', async (req: Request, res: Response) => {
  if (!isTeacherAuthorized(req)) {
    return res.status(403).json({
      error: 'Permission denied: Only teachers can create, edit, or publish lessons to the central library.',
    });
  }

  const lesson = req.body;
  if (!lesson || !lesson.id) {
    return res.status(400).json({ error: 'Valid lesson object required' });
  }

  // Ensure isPublished defaults to true if not specified
  if (lesson.isPublished === undefined) {
    lesson.isPublished = true;
  }

  try {
    const saved = await saveLesson(lesson);
    res.json({ success: true, lesson: saved });
  } catch (e) {
    console.error('[API] Error saving lesson:', e);
    res.status(500).json({ error: 'Failed to save lesson' });
  }
});

app.delete('/api/lessons/:id', async (req: Request, res: Response) => {
  if (!isTeacherAuthorized(req)) {
    return res.status(403).json({
      error: 'Permission denied: Only teachers can delete lessons.',
    });
  }

  const { id } = req.params;
  try {
    await deleteLesson(id);
    res.json({ success: true, id });
  } catch (e) {
    console.error('[API] Error deleting lesson:', e);
    res.status(500).json({ error: 'Failed to delete lesson' });
  }
});

const handlePublishStatus = async (req: Request, res: Response) => {
  if (!isTeacherAuthorized(req)) {
    return res.status(403).json({
      error: 'Permission denied: Only teachers can publish or unpublish lessons.',
    });
  }

  const { id } = req.params;
  const { isPublished } = req.body;
  try {
    await setLessonPublishStatus(id, !!isPublished);
    const updated = await getLessonById(id);
    res.json({ success: true, lesson: updated });
  } catch (e) {
    console.error('[API] Error updating publish status:', e);
    res.status(500).json({ error: 'Failed to update lesson publish status' });
  }
};

app.patch('/api/lessons/:id/publish', handlePublishStatus);
app.put('/api/lessons/:id/publish', handlePublishStatus);

// ==========================================
// Session Reports API (Per-Session Analytics)
// ==========================================

// Get all session reports (optionally filtered by lessonId or studentId)
app.get('/api/reports/sessions', async (req: Request, res: Response) => {
  const { lessonId, role = 'teacher', studentId } = req.query;
  try {
    let reports = await getAllReports(role as string, studentId as string | undefined);
    if (lessonId && typeof lessonId === 'string') {
      reports = reports.filter((r) => r.lessonId === lessonId);
    }
    res.json({ success: true, reports });
  } catch (e) {
    console.error('[API] Error getting session reports:', e);
    res.status(500).json({ error: 'Failed to retrieve session reports' });
  }
});

// Get a single session report
app.get('/api/reports/sessions/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  try {
    const reports = await getAllReports('teacher');
    const report = reports.find((r) => r.sessionId === sessionId);
    if (!report) {
      return res.status(404).json({ error: 'Session report not found' });
    }
    res.json({ success: true, report });
  } catch (e) {
    console.error('[API] Error getting session report:', e);
    res.status(500).json({ error: 'Failed to retrieve session report' });
  }
});

// Record homework submission as an individual session report
app.post('/api/reports/homework', async (req: Request, res: Response) => {
  const { submission } = req.body;
  if (!submission || !submission.lessonId) {
    return res.status(400).json({ error: 'Valid homework submission required' });
  }

  try {
    const lesson = await getLessonById(submission.lessonId);
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

    await saveSessionReport(hwReport);
    res.json({ success: true, report: hwReport });
  } catch (e) {
    console.error('[API] Error saving homework report:', e);
    res.status(500).json({ error: 'Failed to save homework report' });
  }
});

// Delete a session report
app.delete('/api/reports/sessions/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  try {
    await deleteSessionReport(sessionId);
    res.json({ success: true, sessionId });
  } catch (e) {
    console.error('[API] Error deleting session report:', e);
    res.status(500).json({ error: 'Failed to delete session report' });
  }
});

// ==========================================
// Student Saved Personal Vocabulary API (Database Persistent)
// ==========================================

app.get('/api/student-vocab/:studentId', async (req: Request, res: Response) => {
  const studentId = decodeURIComponent(req.params.studentId || '').trim();
  if (!studentId || studentId === 'student-guest') {
    return res.json({ success: true, items: [] });
  }
  try {
    const items = await getStudentSavedVocab(studentId);
    res.json({ success: true, items });
  } catch (e) {
    console.error('[API] Error fetching student saved vocabulary:', e);
    res.status(500).json({ error: 'Failed to fetch saved vocabulary' });
  }
});

app.post('/api/student-vocab/:studentId/sync', async (req: Request, res: Response) => {
  const studentId = decodeURIComponent(req.params.studentId || '').trim();
  if (!studentId || studentId === 'student-guest') {
    return res.json({ success: true, items: [] });
  }
  try {
    const localItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const items = await syncStudentSavedVocab(studentId, localItems);
    res.json({ success: true, items });
  } catch (e) {
    console.error('[API] Error syncing student saved vocabulary:', e);
    res.status(500).json({ error: 'Failed to sync saved vocabulary' });
  }
});

app.post('/api/student-vocab/:studentId', async (req: Request, res: Response) => {
  const studentId = decodeURIComponent(req.params.studentId || '').trim();
  if (!studentId || studentId === 'student-guest') {
    return res.status(400).json({ error: 'Valid studentId required for database storage' });
  }
  const item = req.body?.item;
  if (!item || typeof item.word !== 'string' || !item.word.trim()) {
    return res.status(400).json({ error: 'Valid vocabulary item with word is required' });
  }
  try {
    const items = await saveStudentSavedVocabWord(studentId, item);
    res.json({ success: true, items });
  } catch (e) {
    console.error('[API] Error saving student vocabulary word:', e);
    res.status(500).json({ error: 'Failed to save vocabulary word' });
  }
});

app.delete('/api/student-vocab/:studentId/:word', async (req: Request, res: Response) => {
  const studentId = decodeURIComponent(req.params.studentId || '').trim();
  const word = decodeURIComponent(req.params.word || '').trim();
  if (!studentId || studentId === 'student-guest' || !word) {
    return res.status(400).json({ error: 'Valid studentId and word required' });
  }
  try {
    const items = await deleteStudentSavedVocabWord(studentId, word);
    res.json({ success: true, items });
  } catch (e) {
    console.error('[API] Error removing student vocabulary word:', e);
    res.status(500).json({ error: 'Failed to remove vocabulary word' });
  }
});

// Health & Database Connection Check (redacted: no credentials exposed)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    database: getDatabaseStatus(),
  });
});

// Admin-only (password-verified): Export full database backup snapshot as JSON
app.post('/api/admin/db-backup', async (req: Request, res: Response) => {
  const admin = await verifyAdminWithPassword(req);
  if (!admin) {
    return res.status(403).json({
      error: 'Administrator authentication failed. Please enter your current Admin password.',
    });
  }

  try {
    const snapshot = await exportDatabaseSnapshot();
    res.json({ success: true, snapshot });
  } catch (err: any) {
    console.error('[API] Error exporting database backup:', err?.message || err);
    res.status(500).json({ error: 'Failed to export database backup.' });
  }
});

// Admin-only (password-verified): Migrate active PostgreSQL data directly to Supabase Session Pooler URI
app.post('/api/admin/migrate-to-supabase', async (req: Request, res: Response) => {
  const admin = await verifyAdminWithPassword(req);
  if (!admin) {
    return res.status(403).json({
      error: 'Administrator authentication failed. Please enter your current Admin password.',
    });
  }

  const sourcePool = getActivePool();
  if (!sourcePool) {
    return res.status(400).json({
      error:
        'Source PostgreSQL database is not connected on this server. Run this from your live Render service while it is still connected to your Render database.',
    });
  }

  const rawTargetUrl = typeof req.body?.targetDatabaseUrl === 'string' ? req.body.targetDatabaseUrl : '';
  const check = validateTargetUrl(
    rawTargetUrl,
    process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || ''
  );
  if (check.valid === false) {
    return res.status(400).json({ error: check.error });
  }

  try {
    const result = await migratePostgresToTarget(sourcePool, check.normalizedUrl);
    const allOk = result.counts.every((c) => c.ok);
    res.json({
      success: allOk,
      ...result,
    });
  } catch (err: any) {
    console.error('[API] Database migration to Supabase failed:', err?.message || err);
    res.status(500).json({
      error:
        err?.message ||
        'Could not connect or copy data to Supabase. Double-check your Session Pooler URI, password, and region.',
    });
  }
});

// Setup Vite middleware in dev or static serving in production
async function startServer() {
  // Initialize Database tables and seeds (Supabase / Render PostgreSQL or fallback)
  await initDatabase(INITIAL_LESSONS);

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
