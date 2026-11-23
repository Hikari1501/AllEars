import pg from 'pg';
import {
  createPgPoolConfig,
  ensureSchema,
  getAllTeachers,
  getAllStudents,
  getAllLessons,
  getAllReports,
  getStudentLessons,
  getDatabaseStatus,
} from './db.ts';

const { Pool } = pg;

export interface TableMigrationCount {
  table: string;
  source: number;
  target: number;
  ok: boolean;
}

export interface MigrationResult {
  targetHost: string;
  targetPort: string;
  counts: TableMigrationCount[];
}

export async function tableExists(pool: pg.Pool, tableName: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return Boolean(res.rows[0]?.exists);
}

export async function getTableColumns(pool: pg.Pool, tableName: string): Promise<Set<string>> {
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return new Set(res.rows.map((r) => String(r.column_name)));
}

export async function getRowCount(pool: pg.Pool, tableName: string): Promise<number> {
  const exists = await tableExists(pool, tableName);
  if (!exists) return 0;
  const res = await pool.query(`SELECT COUNT(*)::int AS count FROM ${tableName}`);
  return Number(res.rows[0]?.count || 0);
}

export function makePoolFromUrl(url: string, max = 5): pg.Pool {
  const cfg = createPgPoolConfig(url);
  const p = new Pool({
    connectionString: cfg.connectionString,
    ssl: cfg.ssl,
    max,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
    keepAlive: true,
  });
  p.on('error', (err) => {
    console.error(`[Migrate] Pool error (${cfg.host}:${cfg.port}):`, err.message);
  });
  return p;
}

export function validateTargetUrl(rawUrl: string, currentSourceUrl?: string): { valid: true; normalizedUrl: string } | { valid: false; error: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'Target Supabase connection URL is required.' };
  }
  if (!/^postgres(ql)?:\/\//i.test(trimmed)) {
    return {
      valid: false,
      error: 'Connection string must start with postgresql:// or postgres://',
    };
  }
  if (trimmed.includes('[YOUR-PASSWORD]')) {
    return {
      valid: false,
      error: 'Please replace [YOUR-PASSWORD] with your actual Supabase database password.',
    };
  }
  if (currentSourceUrl && trimmed === currentSourceUrl.trim()) {
    return {
      valid: false,
      error: 'Target URL is identical to the currently connected DATABASE_URL.',
    };
  }
  return { valid: true, normalizedUrl: trimmed };
}

/**
 * Copies all 5 application tables from sourcePool to targetUrl inside a single transaction
 * and verifies row counts across every table.
 */
export async function migratePostgresToTarget(
  sourcePool: pg.Pool,
  targetUrl: string,
  options: { verifyOnly?: boolean } = {}
): Promise<MigrationResult> {
  const tgtInfo = createPgPoolConfig(targetUrl);
  const targetPool = makePoolFromUrl(targetUrl, 5);
  const tables = ['teachers', 'students', 'lessons', 'student_lessons', 'session_reports'];

  try {
    await sourcePool.query('SELECT 1');
    await targetPool.query('SELECT 1');

    if (!options.verifyOnly) {
      await ensureSchema(targetPool);

      const srcTeachersExist = await tableExists(sourcePool, 'teachers');
      const srcStudentsExist = await tableExists(sourcePool, 'students');
      const srcLessonsExist = await tableExists(sourcePool, 'lessons');
      const srcStudentLessonsExist = await tableExists(sourcePool, 'student_lessons');
      const srcReportsExist = await tableExists(sourcePool, 'session_reports');

      const teacherRows = srcTeachersExist
        ? (
            await sourcePool.query(
              'SELECT id, name, email, password, is_admin, created_at FROM teachers ORDER BY created_at ASC'
            )
          ).rows
        : [];

      const studentRows = srcStudentsExist
        ? (
            await sourcePool.query(
              'SELECT id, name, email, password, teacher_id, teacher_name, class_name, created_at FROM students ORDER BY created_at ASC'
            )
          ).rows
        : [];

      let lessonRows: any[] = [];
      if (srcLessonsExist) {
        const lessonCols = await getTableColumns(sourcePool, 'lessons');
        const hasBgText = lessonCols.has('background_info_text');
        const hasBgImg = lessonCols.has('background_info_image_url');
        lessonRows = (
          await sourcePool.query(`
            SELECT
              id,
              title,
              COALESCE(description, '') AS description,
              ${hasBgText ? "COALESCE(background_info_text, '')" : "''"} AS background_info_text,
              ${hasBgImg ? 'background_info_image_url' : 'NULL'} AS background_info_image_url,
              level,
              media_type,
              media_url,
              duration,
              trim_start,
              trim_end,
              prevent_skipping,
              thumbnail_url,
              teacher_id,
              teacher_name,
              is_published,
              captions,
              questions,
              difficult_words,
              created_at,
              updated_at
            FROM lessons
            ORDER BY created_at ASC
          `)
        ).rows;
      }

      const studentLessonRows = srcStudentLessonsExist
        ? (
            await sourcePool.query(
              'SELECT id, student_id, lesson_data, created_at, updated_at FROM student_lessons ORDER BY created_at ASC'
            )
          ).rows
        : [];

      const reportRows = srcReportsExist
        ? (
            await sourcePool.query(
              'SELECT session_id, lesson_id, lesson_title, teacher_id, teacher_name, mode, pin, data, created_at FROM session_reports ORDER BY created_at ASC'
            )
          ).rows
        : [];

      const client = await targetPool.connect();
      try {
        await client.query('BEGIN');

        for (const t of teacherRows) {
          await client.query(
            'DELETE FROM teachers WHERE LOWER(email) = LOWER($1) AND id <> $2',
            [t.email, t.id]
          );
          await client.query(
            `INSERT INTO teachers (id, name, email, password, is_admin, created_at)
             VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_TIMESTAMP))
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               email = EXCLUDED.email,
               password = EXCLUDED.password,
               is_admin = EXCLUDED.is_admin,
               created_at = EXCLUDED.created_at`,
            [t.id, t.name, t.email, t.password, Boolean(t.is_admin), t.created_at]
          );
        }

        for (const s of studentRows) {
          await client.query(
            'DELETE FROM students WHERE LOWER(email) = LOWER($1) AND id <> $2',
            [s.email, s.id]
          );
          await client.query(
            `INSERT INTO students (id, name, email, password, teacher_id, teacher_name, class_name, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_TIMESTAMP))
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               email = EXCLUDED.email,
               password = EXCLUDED.password,
               teacher_id = EXCLUDED.teacher_id,
               teacher_name = EXCLUDED.teacher_name,
               class_name = EXCLUDED.class_name,
               created_at = EXCLUDED.created_at`,
            [
              s.id,
              s.name,
              s.email,
              s.password,
              s.teacher_id,
              s.teacher_name,
              s.class_name,
              s.created_at,
            ]
          );
        }

        for (const l of lessonRows) {
          await client.query(
            `INSERT INTO lessons (
               id, title, description, background_info_text, background_info_image_url,
               level, media_type, media_url, duration, trim_start, trim_end,
               prevent_skipping, thumbnail_url, teacher_id, teacher_name, is_published,
               captions, questions, difficult_words, created_at, updated_at
             ) VALUES (
               $1, $2, $3, $4, $5,
               $6, $7, $8, $9, $10, $11,
               $12, $13, $14, $15, $16,
               $17, $18, $19, COALESCE($20, CURRENT_TIMESTAMP), COALESCE($21, CURRENT_TIMESTAMP)
             )
             ON CONFLICT (id) DO UPDATE SET
               title = EXCLUDED.title,
               description = EXCLUDED.description,
               background_info_text = EXCLUDED.background_info_text,
               background_info_image_url = EXCLUDED.background_info_image_url,
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
               created_at = EXCLUDED.created_at,
               updated_at = EXCLUDED.updated_at`,
            [
              l.id,
              l.title,
              l.description || '',
              l.background_info_text || '',
              l.background_info_image_url || null,
              l.level,
              l.media_type,
              l.media_url,
              l.duration ?? 0,
              l.trim_start ?? null,
              l.trim_end ?? null,
              Boolean(l.prevent_skipping),
              l.thumbnail_url || null,
              l.teacher_id || 'teacher-chuck',
              l.teacher_name || 'Chuck',
              l.is_published !== false,
              typeof l.captions === 'string' ? l.captions : JSON.stringify(l.captions || []),
              typeof l.questions === 'string' ? l.questions : JSON.stringify(l.questions || []),
              typeof l.difficult_words === 'string'
                ? l.difficult_words
                : JSON.stringify(l.difficult_words || []),
              l.created_at,
              l.updated_at,
            ]
          );
        }

        for (const sl of studentLessonRows) {
          await client.query(
            `INSERT INTO student_lessons (id, student_id, lesson_data, created_at, updated_at)
             VALUES ($1, $2, $3, COALESCE($4, CURRENT_TIMESTAMP), COALESCE($5, CURRENT_TIMESTAMP))
             ON CONFLICT (id) DO UPDATE SET
               student_id = EXCLUDED.student_id,
               lesson_data = EXCLUDED.lesson_data,
               created_at = EXCLUDED.created_at,
               updated_at = EXCLUDED.updated_at`,
            [
              sl.id,
              sl.student_id,
              typeof sl.lesson_data === 'string' ? sl.lesson_data : JSON.stringify(sl.lesson_data || {}),
              sl.created_at,
              sl.updated_at,
            ]
          );
        }

        for (const r of reportRows) {
          await client.query(
            `INSERT INTO session_reports (
               session_id, lesson_id, lesson_title, teacher_id, teacher_name, mode, pin, data, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_TIMESTAMP))
             ON CONFLICT (session_id) DO UPDATE SET
               lesson_id = EXCLUDED.lesson_id,
               lesson_title = EXCLUDED.lesson_title,
               teacher_id = EXCLUDED.teacher_id,
               teacher_name = EXCLUDED.teacher_name,
               mode = EXCLUDED.mode,
               pin = EXCLUDED.pin,
               data = EXCLUDED.data,
               created_at = EXCLUDED.created_at`,
            [
              r.session_id,
              r.lesson_id || null,
              r.lesson_title || '',
              r.teacher_id || '',
              r.teacher_name || '',
              r.mode || 'live',
              r.pin || '',
              typeof r.data === 'string' ? r.data : JSON.stringify(r.data || {}),
              r.created_at,
            ]
          );
        }

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    }

    const counts: TableMigrationCount[] = [];
    for (const table of tables) {
      const source = await getRowCount(sourcePool, table);
      const target = await getRowCount(targetPool, table);
      counts.push({
        table,
        source,
        target,
        ok: target >= source,
      });
    }

    return {
      targetHost: tgtInfo.host,
      targetPort: tgtInfo.port,
      counts,
    };
  } finally {
    await targetPool.end().catch(() => {});
  }
}

/**
 * Exports a complete JSON snapshot of all database tables for downloadable admin backups.
 */
export async function exportDatabaseSnapshot() {
  const [teachers, students, lessons, sessionReports] = await Promise.all([
    getAllTeachers(),
    getAllStudents(),
    getAllLessons(true),
    getAllReports('teacher'),
  ]);

  const studentLessons: Record<string, any[]> = {};
  for (const s of students) {
    const sl = await getStudentLessons(s.id);
    if (sl.length > 0) {
      studentLessons[s.id] = sl;
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    database: getDatabaseStatus(),
    counts: {
      teachers: teachers.length,
      students: students.length,
      lessons: lessons.length,
      studentLessons: Object.values(studentLessons).reduce((sum, arr) => sum + arr.length, 0),
      sessionReports: sessionReports.length,
    },
    data: {
      teachers,
      students,
      lessons,
      studentLessons,
      sessionReports,
    },
  };
}
