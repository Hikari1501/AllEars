import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Lesson } from '../src/types.ts';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TeacherRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  isAdmin: boolean;
}

export interface StudentRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt?: string;
  teacherId?: string;
  teacherName?: string;
  className?: string;
}

// Fallback JSON data directories
const DATA_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const LESSONS_FILE = path.join(DATA_DIR, 'db-lessons.json');
const REPORTS_FILE = path.join(DATA_DIR, 'db-session-reports.json');
const TEACHERS_FILE = path.join(DATA_DIR, 'db-teachers.json');
const STUDENTS_FILE = path.join(DATA_DIR, 'db-students.json');
const STUDENT_LESSONS_FILE = path.join(DATA_DIR, 'db-student-lessons.json');

let pool: pg.Pool | null = null;
let isPostgresActive = false;

// Default admin teacher: Chuck
export const DEFAULT_TEACHER: TeacherRecord = {
  id: 'teacher-chuck',
  name: 'Chuck',
  email: 'ChuckACR1501@gmail.com',
  password: 'password123',
  isAdmin: true,
};

// Fallback in-memory stores
let memoryTeachers: Record<string, TeacherRecord> = {
  'chuck': DEFAULT_TEACHER,
  'chuckacr1501@gmail.com': DEFAULT_TEACHER,
};
let memoryStudents: Record<string, StudentRecord> = {};
let memoryStudentLessons: Record<string, Lesson[]> = {};
let memoryLessons: Lesson[] = [];
let memoryReports: any[] = [];

// Helper to safely parse JSON from file
function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn(`[DB] Could not read ${filePath}:`, e);
  }
  return fallback;
}

function writeJsonSafe(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn(`[DB] Could not write ${filePath}:`, e);
  }
}

/**
 * Initialize Database: Connects to Render PostgreSQL or sets up local JSON fallback
 */
export async function initDatabase(initialLessons: Lesson[]) {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    try {
      console.log('[DB] Connecting to PostgreSQL database...');
      pool = new Pool({
        connectionString: dbUrl,
        ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      });

      // Verify connection
      const client = await pool.connect();
      console.log('[DB] PostgreSQL connection established successfully.');

      // Create Tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS teachers (
          id VARCHAR(128) PRIMARY KEY,
          name TEXT NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password TEXT NOT NULL,
          is_admin BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS students (
          id VARCHAR(128) PRIMARY KEY,
          name TEXT NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password TEXT NOT NULL,
          teacher_id VARCHAR(128),
          teacher_name TEXT,
          class_name TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS lessons (
          id VARCHAR(128) PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          level VARCHAR(16) NOT NULL,
          media_type VARCHAR(32) NOT NULL,
          media_url TEXT NOT NULL,
          duration NUMERIC DEFAULT 180,
          trim_start NUMERIC DEFAULT 0,
          trim_end NUMERIC DEFAULT 180,
          prevent_skipping BOOLEAN DEFAULT FALSE,
          thumbnail_url TEXT,
          teacher_id VARCHAR(128),
          teacher_name TEXT,
          is_published BOOLEAN DEFAULT TRUE,
          captions JSONB DEFAULT '[]'::jsonb,
          questions JSONB DEFAULT '[]'::jsonb,
          difficult_words JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS student_lessons (
          id VARCHAR(128) PRIMARY KEY,
          student_id VARCHAR(128) NOT NULL,
          lesson_data JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_student_lessons_student_id ON student_lessons(student_id);

        CREATE TABLE IF NOT EXISTS session_reports (
          session_id VARCHAR(128) PRIMARY KEY,
          lesson_id VARCHAR(128),
          lesson_title TEXT,
          teacher_id VARCHAR(128),
          teacher_name TEXT,
          mode VARCHAR(32) NOT NULL,
          pin VARCHAR(32),
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        -- Self-healing schema migrations for existing Render tables
        ALTER TABLE students ADD COLUMN IF NOT EXISTS teacher_id VARCHAR(128);
        ALTER TABLE students ADD COLUMN IF NOT EXISTS teacher_name TEXT;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS class_name TEXT;
        UPDATE students SET teacher_id = 'teacher-chuck', teacher_name = 'Chuck', class_name = 'Chuck''s Class' WHERE teacher_id IS NULL;

        ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
        UPDATE teachers SET is_admin = TRUE WHERE LOWER(email) = 'chuckacr1501@gmail.com';

        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS trim_start NUMERIC DEFAULT 0;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS trim_end NUMERIC DEFAULT 180;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS prevent_skipping BOOLEAN DEFAULT FALSE;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS teacher_id VARCHAR(128);
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS teacher_name TEXT;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS captions JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE lessons ADD COLUMN IF NOT EXISTS difficult_words JSONB DEFAULT '[]'::jsonb;
      `);

      // Seed Chuck's default teacher record with Admin permission
      await client.query(`
        INSERT INTO teachers (id, name, email, password, is_admin)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, is_admin = TRUE, name = EXCLUDED.name;
      `, [DEFAULT_TEACHER.id, DEFAULT_TEACHER.name, DEFAULT_TEACHER.email, DEFAULT_TEACHER.password, DEFAULT_TEACHER.isAdmin]);

      // Seed initial catalog lessons if table is empty
      const countRes = await client.query('SELECT COUNT(*) FROM lessons');
      const count = parseInt(countRes.rows[0].count, 10);
      if (count === 0 && initialLessons.length > 0) {
        console.log(`[DB] Seeding ${initialLessons.length} initial lessons into PostgreSQL...`);
        for (const l of initialLessons) {
          await client.query(`
            INSERT INTO lessons (
              id, title, description, level, media_type, media_url, duration, trim_start, trim_end,
              prevent_skipping, thumbnail_url, teacher_id, teacher_name, is_published,
              captions, questions, difficult_words
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (id) DO NOTHING;
          `, [
            l.id,
            l.title,
            l.description || '',
            l.level,
            l.mediaType,
            l.mediaUrl,
            l.duration,
            l.trimStart || 0,
            l.trimEnd || l.duration,
            l.preventSkipping || false,
            l.thumbnailUrl || null,
            l.teacherId || 'teacher-chuck',
            l.teacherName || 'Chuck',
            l.isPublished !== false,
            JSON.stringify(l.captions || []),
            JSON.stringify(l.questions || []),
            JSON.stringify(l.difficultWords || []),
          ]);
        }
      }

      client.release();
      isPostgresActive = true;
      console.log('[DB] PostgreSQL tables ready.');
      return;
    } catch (err) {
      console.error('[DB] Failed to initialize PostgreSQL, switching to local JSON fallback:', err);
      isPostgresActive = false;
    }
  } else {
    console.log('[DB] No DATABASE_URL provided. Operating with local persistent JSON fallback.');
  }

  // Local JSON fallback initialization
  const savedTeachers = readJsonSafe<Record<string, TeacherRecord>>(TEACHERS_FILE, {});
  memoryTeachers = { ...memoryTeachers, ...savedTeachers };
  // Guarantee Chuck is always marked Admin
  if (memoryTeachers['chuckacr1501@gmail.com']) {
    memoryTeachers['chuckacr1501@gmail.com'].isAdmin = true;
  }
  if (memoryTeachers['chuck']) {
    memoryTeachers['chuck'].isAdmin = true;
  }

  const savedStudents = readJsonSafe<Record<string, StudentRecord>>(STUDENTS_FILE, {});
  memoryStudents = { ...memoryStudents, ...savedStudents };
  // Ensure default teacher on legacy student records
  Object.values(memoryStudents).forEach((s) => {
    if (!s.teacherId) {
      s.teacherId = 'teacher-chuck';
      s.teacherName = 'Chuck';
      s.className = "Chuck's Class";
    }
  });

  const savedLessons = readJsonSafe<Lesson[]>(LESSONS_FILE, []);
  if (savedLessons && savedLessons.length > 0) {
    memoryLessons = savedLessons;
  } else {
    memoryLessons = initialLessons;
    writeJsonSafe(LESSONS_FILE, memoryLessons);
  }

  memoryReports = readJsonSafe<any[]>(REPORTS_FILE, []);
}

// -------------------------------------------------------------
// Teachers & Auth Operations
// -------------------------------------------------------------

export async function findTeacher(identifier: string): Promise<TeacherRecord | null> {
  const norm = identifier.trim().toLowerCase();

  if (isPostgresActive && pool) {
    try {
      const res = await pool.query(
        'SELECT * FROM teachers WHERE LOWER(email) = $1 OR LOWER(name) = $1 LIMIT 1',
        [norm]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        const isChuck = row.email.toLowerCase() === 'chuckacr1501@gmail.com';
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          password: row.password,
          isAdmin: isChuck ? true : !!row.is_admin,
        };
      }
      return null;
    } catch (e) {
      console.error('[DB] Error querying teacher:', e);
    }
  }

  // Fallback
  const found = memoryTeachers[norm] ||
    Object.values(memoryTeachers).find((t) => t.email.toLowerCase() === norm || t.name.toLowerCase() === norm) ||
    null;
  if (found && found.email.toLowerCase() === 'chuckacr1501@gmail.com') {
    found.isAdmin = true;
  }
  return found;
}

export async function getTeacherById(id: string): Promise<TeacherRecord | null> {
  if (isPostgresActive && pool) {
    try {
      const res = await pool.query('SELECT * FROM teachers WHERE id = $1 LIMIT 1', [id]);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        const isChuck = row.email.toLowerCase() === 'chuckacr1501@gmail.com';
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          password: row.password,
          isAdmin: isChuck ? true : !!row.is_admin,
        };
      }
      return null;
    } catch (e) {
      console.error('[DB] Error querying teacher by id:', e);
    }
  }

  const found = Object.values(memoryTeachers).find((t) => t.id === id) || null;
  if (found && found.email.toLowerCase() === 'chuckacr1501@gmail.com') {
    found.isAdmin = true;
  }
  return found;
}

export async function addTeacher(newTeacher: TeacherRecord): Promise<TeacherRecord> {
  const isChuck = newTeacher.email.toLowerCase() === 'chuckacr1501@gmail.com';
  const teacherToAdd: TeacherRecord = {
    ...newTeacher,
    isAdmin: isChuck ? true : newTeacher.isAdmin,
  };

  if (isPostgresActive && pool) {
    try {
      await pool.query(
        `INSERT INTO teachers (id, name, email, password, is_admin)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, name = EXCLUDED.name, is_admin = EXCLUDED.is_admin`,
        [teacherToAdd.id, teacherToAdd.name, teacherToAdd.email, teacherToAdd.password, teacherToAdd.isAdmin]
      );
      return teacherToAdd;
    } catch (e) {
      console.error('[DB] Error inserting teacher into PostgreSQL:', e);
    }
  }

  // Fallback
  memoryTeachers[teacherToAdd.email.toLowerCase()] = teacherToAdd;
  memoryTeachers[teacherToAdd.name.toLowerCase()] = teacherToAdd;
  memoryTeachers[teacherToAdd.id] = teacherToAdd;
  writeJsonSafe(TEACHERS_FILE, memoryTeachers);
  return teacherToAdd;
}

export async function updateTeacher(id: string, updates: { name?: string; email?: string; password?: string; isAdmin?: boolean }): Promise<TeacherRecord | null> {
  const existing = await getTeacherById(id);
  if (!existing) return null;

  const isChuck = (updates.email || existing.email).toLowerCase() === 'chuckacr1501@gmail.com' || existing.id === 'teacher-chuck';
  const updated: TeacherRecord = {
    id: existing.id,
    name: updates.name ? updates.name.trim() : existing.name,
    email: updates.email ? updates.email.trim() : existing.email,
    password: updates.password ? updates.password.trim() : existing.password,
    isAdmin: isChuck ? true : updates.isAdmin !== undefined ? updates.isAdmin : existing.isAdmin,
  };

  if (isPostgresActive && pool) {
    try {
      await pool.query(
        `UPDATE teachers
         SET name = $1, email = $2, password = $3, is_admin = $4
         WHERE id = $5`,
        [updated.name, updated.email, updated.password, updated.isAdmin, id]
      );
      return updated;
    } catch (e) {
      console.error('[DB] Error updating teacher in PostgreSQL:', e);
    }
  }

  // Fallback memory / JSON
  delete memoryTeachers[existing.email.toLowerCase()];
  delete memoryTeachers[existing.name.toLowerCase()];
  memoryTeachers[updated.email.toLowerCase()] = updated;
  memoryTeachers[updated.name.toLowerCase()] = updated;
  memoryTeachers[updated.id] = updated;
  writeJsonSafe(TEACHERS_FILE, memoryTeachers);
  return updated;
}

export async function deleteTeacher(id: string): Promise<boolean> {
  if (isPostgresActive && pool) {
    try {
      await pool.query('DELETE FROM teachers WHERE id = $1', [id]);
      return true;
    } catch (e) {
      console.error('[DB] Error deleting teacher in PostgreSQL:', e);
    }
  }

  const existing = Object.values(memoryTeachers).find((t) => t.id === id);
  if (existing) {
    delete memoryTeachers[existing.email.toLowerCase()];
    delete memoryTeachers[existing.name.toLowerCase()];
    delete memoryTeachers[existing.id];
    writeJsonSafe(TEACHERS_FILE, memoryTeachers);
  }
  return true;
}

export async function getAllTeachers(): Promise<{ id: string; name: string; email: string; isAdmin: boolean; password?: string }[]> {
  if (isPostgresActive && pool) {
    try {
      const res = await pool.query('SELECT id, name, email, password, is_admin FROM teachers ORDER BY created_at ASC');
      return res.rows.map((r) => {
        const isChuck = r.email.toLowerCase() === 'chuckacr1501@gmail.com';
        return {
          id: r.id,
          name: r.name,
          email: r.email,
          password: r.password,
          isAdmin: isChuck ? true : !!r.is_admin,
        };
      });
    } catch (e) {
      console.error('[DB] Error fetching teachers:', e);
    }
  }

  // Fallback
  const list = Object.values(memoryTeachers);
  const seen = new Set<string>();
  return list.filter((t) => {
    const key = t.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((t) => {
    const isChuck = t.email.toLowerCase() === 'chuckacr1501@gmail.com';
    return {
      id: t.id,
      name: t.name,
      email: t.email,
      password: t.password,
      isAdmin: isChuck ? true : t.isAdmin,
    };
  });
}

// -------------------------------------------------------------
// Lessons Operations
// -------------------------------------------------------------

function rowToLesson(row: any): Lesson {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    level: row.level,
    mediaType: row.media_type,
    mediaUrl: row.media_url,
    duration: Number(row.duration) || 180,
    trimStart: Number(row.trim_start) || 0,
    trimEnd: Number(row.trim_end) || Number(row.duration) || 180,
    preventSkipping: !!row.prevent_skipping,
    thumbnailUrl: row.thumbnail_url || undefined,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    isPublished: row.is_published === null || row.is_published === undefined ? true : Boolean(row.is_published),
    captions: typeof row.captions === 'string' ? JSON.parse(row.captions) : (row.captions || []),
    questions: typeof row.questions === 'string' ? JSON.parse(row.questions) : (row.questions || []),
    difficultWords: typeof row.difficult_words === 'string' ? JSON.parse(row.difficult_words) : (row.difficult_words || []),
    createdAt: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  };
}

export async function getAllLessons(includeUnpublished: boolean): Promise<Lesson[]> {
  if (isPostgresActive && pool) {
    try {
      const query = includeUnpublished
        ? 'SELECT * FROM lessons ORDER BY created_at DESC'
        : 'SELECT * FROM lessons WHERE is_published IS NOT FALSE ORDER BY created_at DESC';
      const res = await pool.query(query);
      return res.rows.map(rowToLesson);
    } catch (e) {
      console.error('[DB] Error fetching lessons from PostgreSQL:', e);
    }
  }

  // Fallback
  return includeUnpublished
    ? memoryLessons
    : memoryLessons.filter((l) => l.isPublished !== false);
}

export async function getLessonById(id: string): Promise<Lesson | null> {
  if (isPostgresActive && pool) {
    try {
      const res = await pool.query('SELECT * FROM lessons WHERE id = $1 LIMIT 1', [id]);
      if (res.rows.length > 0) {
        return rowToLesson(res.rows[0]);
      }
      return null;
    } catch (e) {
      console.error('[DB] Error getting lesson by id:', e);
    }
  }

  return memoryLessons.find((l) => l.id === id) || null;
}

export async function saveLesson(lesson: Lesson): Promise<Lesson> {
  if (isPostgresActive && pool) {
    try {
      await pool.query(`
        INSERT INTO lessons (
          id, title, description, level, media_type, media_url, duration, trim_start, trim_end,
          prevent_skipping, thumbnail_url, teacher_id, teacher_name, is_published,
          captions, questions, difficult_words, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          level = EXCLUDED.level,
          media_type = EXCLUDED.media_type,
          media_url = EXCLUDED.media_url,
          duration = EXCLUDED.duration,
          trim_start = EXCLUDED.trim_start,
          trim_end = EXCLUDED.trim_end,
          prevent_skipping = EXCLUDED.prevent_skipping,
          thumbnail_url = EXCLUDED.thumbnail_url,
          teacher_id = EXCLUDED.teacher_id,
          teacher_name = EXCLUDED.teacher_name,
          is_published = EXCLUDED.is_published,
          captions = EXCLUDED.captions,
          questions = EXCLUDED.questions,
          difficult_words = EXCLUDED.difficult_words,
          updated_at = CURRENT_TIMESTAMP;
      `, [
        lesson.id,
        lesson.title,
        lesson.description || '',
        lesson.level,
        lesson.mediaType,
        lesson.mediaUrl,
        lesson.duration,
        lesson.trimStart || 0,
        lesson.trimEnd || lesson.duration,
        lesson.preventSkipping || false,
        lesson.thumbnailUrl || null,
        lesson.teacherId || 'teacher-chuck',
        lesson.teacherName || 'Chuck',
        lesson.isPublished !== false,
        JSON.stringify(lesson.captions || []),
        JSON.stringify(lesson.questions || []),
        JSON.stringify(lesson.difficultWords || []),
      ]);
      return lesson;
    } catch (e) {
      console.error('[DB] Error saving lesson to PostgreSQL:', e);
    }
  }

  // Fallback
  const idx = memoryLessons.findIndex((l) => l.id === lesson.id);
  if (idx >= 0) {
    memoryLessons[idx] = lesson;
  } else {
    memoryLessons.unshift(lesson);
  }
  writeJsonSafe(LESSONS_FILE, memoryLessons);
  return lesson;
}

export async function deleteLesson(id: string): Promise<boolean> {
  if (isPostgresActive && pool) {
    try {
      await pool.query('DELETE FROM lessons WHERE id = $1', [id]);
      return true;
    } catch (e) {
      console.error('[DB] Error deleting lesson from PostgreSQL:', e);
    }
  }

  // Fallback
  memoryLessons = memoryLessons.filter((l) => l.id !== id);
  writeJsonSafe(LESSONS_FILE, memoryLessons);
  return true;
}

export async function setLessonPublishStatus(id: string, isPublished: boolean): Promise<boolean> {
  if (isPostgresActive && pool) {
    try {
      await pool.query('UPDATE lessons SET is_published = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [isPublished, id]);
      return true;
    } catch (e) {
      console.error('[DB] Error updating publish status:', e);
    }
  }

  // Fallback
  const l = memoryLessons.find((item) => item.id === id);
  if (l) {
    l.isPublished = isPublished;
    writeJsonSafe(LESSONS_FILE, memoryLessons);
    return true;
  }
  return false;
}

// -------------------------------------------------------------
// Session Reports Operations
// -------------------------------------------------------------

export async function getAllReports(role: string, studentId?: string): Promise<any[]> {
  if (isPostgresActive && pool) {
    try {
      const res = await pool.query('SELECT data FROM session_reports ORDER BY created_at DESC');
      let reports = res.rows.map((r) => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
      if (role === 'student' && studentId) {
        reports = reports.filter((rep: any) =>
          Array.isArray(rep.students) && rep.students.some((s: any) => s.id === studentId)
        );
      }
      return reports;
    } catch (e) {
      console.error('[DB] Error querying session reports:', e);
    }
  }

  // Fallback
  if (role === 'student' && studentId) {
    return memoryReports.filter((r) =>
      Array.isArray(r.students) && r.students.some((s: any) => s.id === studentId)
    );
  }
  return memoryReports;
}

export async function saveSessionReport(report: any): Promise<void> {
  if (isPostgresActive && pool) {
    try {
      await pool.query(`
        INSERT INTO session_reports (session_id, lesson_id, lesson_title, teacher_id, teacher_name, mode, pin, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (session_id) DO UPDATE SET data = EXCLUDED.data;
      `, [
        report.sessionId,
        report.lessonId || null,
        report.lessonTitle || '',
        report.teacherId || '',
        report.teacherName || '',
        report.mode || 'live',
        report.pin || '',
        JSON.stringify(report),
      ]);
      return;
    } catch (e) {
      console.error('[DB] Error saving session report to PostgreSQL:', e);
    }
  }

  // Fallback
  const existingIdx = memoryReports.findIndex((r) => r.sessionId === report.sessionId);
  if (existingIdx >= 0) {
    memoryReports[existingIdx] = report;
  } else {
    memoryReports.unshift(report);
  }
  writeJsonSafe(REPORTS_FILE, memoryReports);
}

export async function deleteSessionReport(sessionId: string): Promise<boolean> {
  if (isPostgresActive && pool) {
    try {
      await pool.query('DELETE FROM session_reports WHERE session_id = $1', [sessionId]);
      return true;
    } catch (e) {
      console.error('[DB] Error deleting session report from PostgreSQL:', e);
    }
  }

  // Fallback
  memoryReports = memoryReports.filter((r) => r.sessionId !== sessionId);
  writeJsonSafe(REPORTS_FILE, memoryReports);
  return true;
}

// -------------------------------------------------------------
// Student Accounts & Private Lessons Operations
// -------------------------------------------------------------

export async function findStudent(identifier: string): Promise<StudentRecord | null> {
  const norm = identifier.trim().toLowerCase();
  if (isPostgresActive && pool) {
    try {
      const res = await pool.query(
        'SELECT * FROM students WHERE LOWER(email) = $1 OR LOWER(name) = $1 LIMIT 1',
        [norm]
      );
      if (res.rows.length > 0) {
        const r = res.rows[0];
        return {
          id: r.id,
          name: r.name,
          email: r.email,
          password: r.password,
          createdAt: r.created_at,
          teacherId: r.teacher_id || 'teacher-chuck',
          teacherName: r.teacher_name || 'Chuck',
          className: r.class_name || (r.teacher_name ? `${r.teacher_name}'s Class` : "Chuck's Class"),
        };
      }
      return null;
    } catch (e) {
      console.error('[DB] Error finding student in PostgreSQL:', e);
    }
  }

  // Fallback
  return memoryStudents[norm] ||
    Object.values(memoryStudents).find((s) => s.email.toLowerCase() === norm || s.name.toLowerCase() === norm) ||
    null;
}

export async function getStudentById(id: string): Promise<StudentRecord | null> {
  if (isPostgresActive && pool) {
    try {
      const res = await pool.query('SELECT * FROM students WHERE id = $1 LIMIT 1', [id]);
      if (res.rows.length > 0) {
        const r = res.rows[0];
        return {
          id: r.id,
          name: r.name,
          email: r.email,
          password: r.password,
          createdAt: r.created_at,
          teacherId: r.teacher_id || 'teacher-chuck',
          teacherName: r.teacher_name || 'Chuck',
          className: r.class_name || (r.teacher_name ? `${r.teacher_name}'s Class` : "Chuck's Class"),
        };
      }
      return null;
    } catch (e) {
      console.error('[DB] Error finding student by id:', e);
    }
  }

  return Object.values(memoryStudents).find((s) => s.id === id) || null;
}

export async function addStudent(student: StudentRecord): Promise<StudentRecord> {
  const teacherId = student.teacherId || 'teacher-chuck';
  const teacherName = student.teacherName || 'Chuck';
  const className = student.className || `${teacherName}'s Class`;

  const record: StudentRecord = {
    ...student,
    teacherId,
    teacherName,
    className,
  };

  if (isPostgresActive && pool) {
    try {
      await pool.query(
        `INSERT INTO students (id, name, email, password, teacher_id, teacher_name, class_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET
           password = EXCLUDED.password,
           name = EXCLUDED.name,
           teacher_id = EXCLUDED.teacher_id,
           teacher_name = EXCLUDED.teacher_name,
           class_name = EXCLUDED.class_name`,
        [record.id, record.name, record.email, record.password, record.teacherId, record.teacherName, record.className]
      );
      return record;
    } catch (e) {
      console.error('[DB] Error adding student to PostgreSQL:', e);
    }
  }

  // Fallback
  memoryStudents[record.email.toLowerCase()] = record;
  memoryStudents[record.name.toLowerCase()] = record;
  memoryStudents[record.id] = record;
  writeJsonSafe(STUDENTS_FILE, memoryStudents);
  return record;
}

export async function updateStudent(id: string, updates: { name?: string; email?: string; password?: string; teacherId?: string; teacherName?: string; className?: string }): Promise<StudentRecord | null> {
  const existing = await getStudentById(id);
  if (!existing) return null;

  const updated: StudentRecord = {
    id: existing.id,
    name: updates.name ? updates.name.trim() : existing.name,
    email: updates.email ? updates.email.trim() : existing.email,
    password: updates.password ? updates.password.trim() : existing.password,
    createdAt: existing.createdAt,
    teacherId: updates.teacherId !== undefined ? updates.teacherId : existing.teacherId,
    teacherName: updates.teacherName !== undefined ? updates.teacherName : existing.teacherName,
    className: updates.className !== undefined ? updates.className : existing.className,
  };

  if (isPostgresActive && pool) {
    try {
      await pool.query(
        `UPDATE students
         SET name = $1, email = $2, password = $3, teacher_id = $4, teacher_name = $5, class_name = $6
         WHERE id = $7`,
        [updated.name, updated.email, updated.password, updated.teacherId, updated.teacherName, updated.className, id]
      );
      return updated;
    } catch (e) {
      console.error('[DB] Error updating student in PostgreSQL:', e);
    }
  }

  // Fallback memory / JSON
  delete memoryStudents[existing.email.toLowerCase()];
  delete memoryStudents[existing.name.toLowerCase()];
  memoryStudents[updated.email.toLowerCase()] = updated;
  memoryStudents[updated.name.toLowerCase()] = updated;
  memoryStudents[updated.id] = updated;
  writeJsonSafe(STUDENTS_FILE, memoryStudents);
  return updated;
}

export async function getAllStudents(filterTeacherId?: string): Promise<StudentRecord[]> {
  if (isPostgresActive && pool) {
    try {
      const query = filterTeacherId
        ? 'SELECT id, name, email, password, created_at, teacher_id, teacher_name, class_name FROM students WHERE teacher_id = $1 ORDER BY created_at DESC'
        : 'SELECT id, name, email, password, created_at, teacher_id, teacher_name, class_name FROM students ORDER BY created_at DESC';
      const params = filterTeacherId ? [filterTeacherId] : [];
      const res = await pool.query(query, params);
      return res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        password: r.password,
        createdAt: r.created_at,
        teacherId: r.teacher_id || 'teacher-chuck',
        teacherName: r.teacher_name || 'Chuck',
        className: r.class_name || (r.teacher_name ? `${r.teacher_name}'s Class` : "Chuck's Class"),
      }));
    } catch (e) {
      console.error('[DB] Error fetching all students from PostgreSQL:', e);
    }
  }

  // Fallback memory / JSON
  const list = Object.values(memoryStudents);
  const seen = new Set<string>();
  const unique = list.filter((s) => {
    const key = s.id || s.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    password: s.password,
    createdAt: s.createdAt || new Date().toISOString(),
    teacherId: s.teacherId || 'teacher-chuck',
    teacherName: s.teacherName || 'Chuck',
    className: s.className || (s.teacherName ? `${s.teacherName}'s Class` : "Chuck's Class"),
  }));

  if (filterTeacherId) {
    return unique.filter((s) => s.teacherId === filterTeacherId);
  }
  return unique;
}

export async function deleteStudent(studentId: string): Promise<boolean> {
  if (isPostgresActive && pool) {
    try {
      await pool.query('DELETE FROM student_lessons WHERE student_id = $1', [studentId]);
      await pool.query('DELETE FROM students WHERE id = $1', [studentId]);
      return true;
    } catch (e) {
      console.error('[DB] Error deleting student from PostgreSQL:', e);
    }
  }

  // Fallback memory / JSON
  delete memoryStudentLessons[studentId];
  for (const k of Object.keys(memoryStudents)) {
    if (memoryStudents[k].id === studentId) {
      delete memoryStudents[k];
    }
  }
  writeJsonSafe(STUDENTS_FILE, memoryStudents);
  writeJsonSafe(STUDENT_LESSONS_FILE, memoryStudentLessons);
  return true;
}

export async function getStudentLessons(studentId: string): Promise<Lesson[]> {
  if (isPostgresActive && pool) {
    try {
      const res = await pool.query(
        'SELECT lesson_data FROM student_lessons WHERE student_id = $1 ORDER BY updated_at DESC',
        [studentId]
      );
      return res.rows.map((r) => typeof r.lesson_data === 'string' ? JSON.parse(r.lesson_data) : r.lesson_data);
    } catch (e) {
      console.error('[DB] Error getting student private lessons from PostgreSQL:', e);
    }
  }

  // Fallback
  return memoryStudentLessons[studentId] || [];
}

export async function saveStudentLesson(studentId: string, lesson: Lesson): Promise<Lesson> {
  const markedLesson: Lesson = {
    ...lesson,
    isLocalStudentOnly: true,
  };

  if (isPostgresActive && pool) {
    try {
      await pool.query(
        `INSERT INTO student_lessons (id, student_id, lesson_data, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET lesson_data = EXCLUDED.lesson_data, updated_at = CURRENT_TIMESTAMP`,
        [markedLesson.id, studentId, JSON.stringify(markedLesson)]
      );
      return markedLesson;
    } catch (e) {
      console.error('[DB] Error saving student private lesson to PostgreSQL:', e);
    }
  }

  // Fallback
  const list = memoryStudentLessons[studentId] || [];
  const idx = list.findIndex((l) => l.id === markedLesson.id);
  if (idx >= 0) {
    list[idx] = markedLesson;
  } else {
    list.unshift(markedLesson);
  }
  memoryStudentLessons[studentId] = list;
  writeJsonSafe(STUDENT_LESSONS_FILE, memoryStudentLessons);
  return markedLesson;
}

export async function deleteStudentLesson(studentId: string, lessonId: string): Promise<boolean> {
  if (isPostgresActive && pool) {
    try {
      await pool.query(
        'DELETE FROM student_lessons WHERE id = $1 AND student_id = $2',
        [lessonId, studentId]
      );
      return true;
    } catch (e) {
      console.error('[DB] Error deleting student private lesson from PostgreSQL:', e);
    }
  }

  // Fallback
  if (memoryStudentLessons[studentId]) {
    memoryStudentLessons[studentId] = memoryStudentLessons[studentId].filter((l) => l.id !== lessonId);
    writeJsonSafe(STUDENT_LESSONS_FILE, memoryStudentLessons);
  }
  return true;
}

