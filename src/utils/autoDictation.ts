import {
  AutoDictationReport,
  AutoDictationQuestionResult,
  CaptionSegment,
  Lesson,
  LessonSubmission,
  Question,
} from '../types';

const getReportsKey = (userId?: string) =>
  `allears_autodictation_reports_${(userId || 'student-guest').trim() || 'student-guest'}`;

export const AUTO_DICTATION_REPORTS_EVENT = 'allears-autodictation-reports-updated';

/**
 * Generates a student-local Auto-Dictation lesson from transcript lines.
 * Never persisted to the server database.
 */
export function generateAutoDictationLesson(
  sourceLesson: Lesson,
  rawMinWords: number,
  rawMaxWords: number,
  rawQuestionCount: number
): { lesson: Lesson; generatedCount: number; actualMin: number; actualMax: number } {
  const minWords = Math.max(1, Math.min(5, Math.floor(rawMinWords || 1)));
  const maxWords = Math.max(minWords, Math.min(5, Math.floor(rawMaxWords || minWords)));
  const desiredCount = Math.max(1, Math.min(10, Math.floor(rawQuestionCount || 5)));

  const sortedCaptions = [...(sourceLesson.captions || [])]
    .filter((c) => typeof c.text === 'string' && c.text.trim().length > 0)
    .sort((a, b) => a.start - b.start);

  const tokenize = (text: string) =>
    text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);

  // Prefer sentences with enough context words around the blank
  let candidateCaptions = sortedCaptions.filter((c) => {
    const words = tokenize(c.text);
    return words.length >= minWords + 1;
  });

  if (candidateCaptions.length === 0) {
    candidateCaptions = sortedCaptions.filter((c) => tokenize(c.text).length >= minWords);
  }
  if (candidateCaptions.length === 0) {
    candidateCaptions = sortedCaptions;
  }

  const targetCount = Math.min(desiredCount, candidateCaptions.length);
  const pickedCaptions: CaptionSegment[] = [];

  if (targetCount > 0 && candidateCaptions.length > 0) {
    if (targetCount === candidateCaptions.length) {
      pickedCaptions.push(...candidateCaptions);
    } else {
      // Spread selections evenly across buckets across the whole video, picking randomly within each bucket
      const bucketSize = candidateCaptions.length / targetCount;
      const usedIndices = new Set<number>();
      for (let i = 0; i < targetCount; i++) {
        const startIdx = Math.floor(i * bucketSize);
        const endIdx = Math.max(startIdx + 1, Math.floor((i + 1) * bucketSize));
        const pool: number[] = [];
        for (let idx = startIdx; idx < Math.min(endIdx, candidateCaptions.length); idx++) {
          if (!usedIndices.has(idx)) pool.push(idx);
        }
        const chosenIdx =
          pool.length > 0
            ? pool[Math.floor(Math.random() * pool.length)]
            : candidateCaptions.findIndex((_, idx) => !usedIndices.has(idx));
        if (chosenIdx >= 0) {
          usedIndices.add(chosenIdx);
          pickedCaptions.push(candidateCaptions[chosenIdx]);
        }
      }
      pickedCaptions.sort((a, b) => a.start - b.start);
    }
  }

  const questions: Question[] = pickedCaptions.map((cap, idx) => {
    const words = tokenize(cap.text);
    const maxAllowedSpan =
      words.length > minWords
        ? Math.min(maxWords, Math.max(minWords, words.length - 1))
        : Math.max(1, Math.min(maxWords, words.length));
    const minAllowedSpan = Math.min(minWords, maxAllowedSpan);
    const spanLength =
      minAllowedSpan + Math.floor(Math.random() * (maxAllowedSpan - minAllowedSpan + 1));

    const maxStartIdx = Math.max(0, words.length - spanLength);
    const startIdx = Math.floor(Math.random() * (maxStartIdx + 1));
    const endIdx = startIdx + spanLength;

    const blankSlice = words.slice(startIdx, endIdx);
    const firstWordRaw = blankSlice[0] || '';
    const lastWordRaw = blankSlice[blankSlice.length - 1] || '';

    const leadingPunctMatch = firstWordRaw.match(/^([^a-zA-Z0-9']+)(.*)$/);
    const leadingPunct = leadingPunctMatch ? leadingPunctMatch[1] : '';

    const trailingPunctMatch = lastWordRaw.match(/^(.*?)([.,!?;:"'’”)\]]+)$/);
    const trailingPunct = trailingPunctMatch ? trailingPunctMatch[2] : '';

    const cleanedTargetWords = [...blankSlice];
    if (leadingPunctMatch && leadingPunctMatch[2]) {
      cleanedTargetWords[0] = leadingPunctMatch[2];
    }
    if (cleanedTargetWords.length > 0) {
      const lastPos = cleanedTargetWords.length - 1;
      const lastCleanMatch = cleanedTargetWords[lastPos].match(/^(.*?)([.,!?;:"'’”)\]]+)$/);
      if (lastCleanMatch && lastCleanMatch[1]) {
        cleanedTargetWords[lastPos] = lastCleanMatch[1];
      }
    }

    const correctAnswer = cleanedTargetWords.join(' ').trim() || blankSlice.join(' ');
    const blankPlaceholder = `${leadingPunct}_________` + (trailingPunct ? `${trailingPunct}` : '');
    const promptSentence = [
      ...words.slice(0, startIdx),
      blankPlaceholder,
      ...words.slice(endIdx),
    ].join(' ');

    return {
      id: `autodict-q-${Date.now()}-${idx}`,
      timestamp: cap.start,
      type: 'close_ended',
      prompt: promptSentence,
      correctAnswer,
      tip: `Listen closely around this segment (${spanLength} ${
        spanLength === 1 ? 'word' : 'words'
      } missing).`,
      tipTimestamps: [cap.start],
      points: 10,
    };
  });

  const generatedLesson: Lesson = {
    ...sourceLesson,
    id: `autodict-${sourceLesson.id}-${Date.now()}`,
    title: `${sourceLesson.title} (Auto-Dictation)`,
    preventSkipping: false,
    isLocalStudentOnly: true,
    questions,
  };

  return {
    lesson: generatedLesson,
    generatedCount: questions.length,
    actualMin: minWords,
    actualMax: maxWords,
  };
}

export function buildAutoDictationReport(
  sourceLessonId: string,
  sourceLessonTitle: string,
  dictationLesson: Lesson,
  submission: LessonSubmission,
  minWordsPerBlank: number,
  maxWordsPerBlank: number
): AutoDictationReport {
  const results: AutoDictationQuestionResult[] = dictationLesson.questions.map((q) => {
    const ans = submission.answers[q.id];
    return {
      questionId: q.id,
      timestamp: typeof q.timestamp === 'number' ? q.timestamp : 0,
      prompt: q.prompt,
      correctAnswer: q.correctAnswer || '',
      studentAnswer: ans ? String(ans.answer ?? '') : '',
      isCorrect: Boolean(ans?.isCorrect),
      pointsEarned: ans?.pointsEarned || 0,
      maxPoints: q.points || 10,
    };
  });

  const answeredCount = results.filter((r) => r.studentAnswer.trim().length > 0).length;
  const correctCount = results.filter((r) => r.isCorrect).length;

  return {
    id: `dict-report-${Date.now()}`,
    lessonId: sourceLessonId,
    lessonTitle: sourceLessonTitle,
    studentId: submission.studentId,
    createdAt: Date.now(),
    minWordsPerBlank,
    maxWordsPerBlank,
    totalQuestions: dictationLesson.questions.length,
    answeredCount,
    correctCount,
    totalScore: submission.totalScore,
    maxScore: submission.maxScore,
    percentage: submission.percentage,
    results,
  };
}

export function getAutoDictationReports(userId?: string): AutoDictationReport[] {
  try {
    const raw = localStorage.getItem(getReportsKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAutoDictationReport(
  userId: string | undefined,
  report: AutoDictationReport
): AutoDictationReport[] {
  const current = getAutoDictationReports(userId);
  const next = [report, ...current].slice(0, 50);
  try {
    localStorage.setItem(getReportsKey(userId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(AUTO_DICTATION_REPORTS_EVENT, { detail: { userId } }));
  } catch (e) {
    console.warn('Could not save auto-dictation report locally:', e);
  }
  return next;
}

export function deleteAutoDictationReport(
  userId: string | undefined,
  reportId: string
): AutoDictationReport[] {
  const current = getAutoDictationReports(userId);
  const next = current.filter((r) => r.id !== reportId);
  try {
    localStorage.setItem(getReportsKey(userId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(AUTO_DICTATION_REPORTS_EVENT, { detail: { userId } }));
  } catch (e) {
    console.warn('Could not delete local auto-dictation report:', e);
  }
  return next;
}
