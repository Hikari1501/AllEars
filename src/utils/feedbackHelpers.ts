import { Question, StudentAnswer } from '../types';

export type DiffTokenStatus = 'correct' | 'incorrect' | 'misplaced' | 'missing';

export interface DiffWordToken {
  text: string;
  status: DiffTokenStatus;
}

export type FeedbackStatusLevel = 'correct' | 'almost' | 'keep_going' | 'needs_review';

export interface CloseEndedFeedbackAnalysis {
  tokens: DiffWordToken[];
  isExactMatch: boolean;
  correctInPlaceCount: number;
  misplacedCount: number;
  incorrectCount: number;
  missingCount: number;
  expectedWordCount: number;
  statusLevel: FeedbackStatusLevel;
  statusLabel: string;
}

const normalizeWordToken = (raw: string): string => {
  return raw
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, '')
    .toLowerCase();
};

const tokenizeDisplayWords = (text: string): { display: string; norm: string }[] => {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => ({
      display: w,
      norm: normalizeWordToken(w) || w.toLowerCase(),
    }));
};

export function analyzeCloseEndedFeedback(
  studentAnswer: string,
  expectedAnswer: string
): CloseEndedFeedbackAnalysis {
  const expectedWords = tokenizeDisplayWords(expectedAnswer);
  const studentWords = tokenizeDisplayWords(studentAnswer);

  const normalizedStudentFull = studentWords.map((w) => w.norm).join(' ');
  const normalizedExpectedFull = expectedWords.map((w) => w.norm).join(' ');
  const isExactMatch =
    studentAnswer.trim().toLowerCase() === expectedAnswer.trim().toLowerCase() ||
    (normalizedExpectedFull.length > 0 && normalizedStudentFull === normalizedExpectedFull);

  if (expectedWords.length === 0) {
    return {
      tokens: studentWords.map((w) => ({ text: w.display, status: 'correct' })),
      isExactMatch,
      correctInPlaceCount: studentWords.length,
      misplacedCount: 0,
      incorrectCount: 0,
      missingCount: 0,
      expectedWordCount: 0,
      statusLevel: isExactMatch ? 'correct' : 'needs_review',
      statusLabel: isExactMatch ? 'Correct Answer!' : 'Needs Review',
    };
  }

  const m = expectedWords.length;
  const n = studentWords.length;

  // LCS DP table to find longest in-order alignment between expected and student words
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (expectedWords[i].norm === studentWords[j].norm) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const matchedPairs: Array<{ expIdx: number; stuIdx: number }> = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (expectedWords[i].norm === studentWords[j].norm) {
      matchedPairs.push({ expIdx: i, stuIdx: j });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  const matchedExpIndices = new Set(matchedPairs.map((p) => p.expIdx));

  // Count unmatched expected words so we only mark "misplaced" (blue) up to available occurrences
  const remainingExpectedCounts = new Map<string, number>();
  for (let ei = 0; ei < m; ei++) {
    if (!matchedExpIndices.has(ei)) {
      const norm = expectedWords[ei].norm;
      remainingExpectedCounts.set(norm, (remainingExpectedCounts.get(norm) || 0) + 1);
    }
  }

  const tokens: DiffWordToken[] = [];
  let correctInPlaceCount = 0;
  let misplacedCount = 0;
  let incorrectCount = 0;
  let missingCount = 0;

  const processGap = (expStart: number, expEnd: number, stuStart: number, stuEnd: number) => {
    const expGapCount = Math.max(0, expEnd - expStart);
    let redInGap = 0;

    for (let si = stuStart; si < stuEnd; si++) {
      const stuWord = studentWords[si];
      const remCount = remainingExpectedCounts.get(stuWord.norm) || 0;
      if (remCount > 0) {
        remainingExpectedCounts.set(stuWord.norm, remCount - 1);
        tokens.push({ text: stuWord.display, status: 'misplaced' });
        misplacedCount++;
      } else {
        tokens.push({ text: stuWord.display, status: 'incorrect' });
        incorrectCount++;
        redInGap++;
      }
    }

    // Add missing markers (*) for omitted expected words not accounted for by substitutions
    const missingInGap = Math.max(0, expGapCount - redInGap);
    for (let k = 0; k < missingInGap; k++) {
      tokens.push({ text: '*', status: 'missing' });
      missingCount++;
    }
  };

  let prevExp = 0;
  let prevStu = 0;
  for (const pair of matchedPairs) {
    processGap(prevExp, pair.expIdx, prevStu, pair.stuIdx);
    tokens.push({ text: studentWords[pair.stuIdx].display, status: 'correct' });
    correctInPlaceCount++;
    prevExp = pair.expIdx + 1;
    prevStu = pair.stuIdx + 1;
  }
  processGap(prevExp, m, prevStu, n);

  const rightWordsTotal = correctInPlaceCount + misplacedCount;
  let statusLevel: FeedbackStatusLevel = 'needs_review';
  let statusLabel = 'Needs Review';

  if (isExactMatch || (correctInPlaceCount === m && incorrectCount === 0 && missingCount === 0)) {
    statusLevel = 'correct';
    statusLabel = 'Correct Answer!';
  } else if (rightWordsTotal === 0) {
    statusLevel = 'needs_review';
    statusLabel = 'Needs Review';
  } else if (correctInPlaceCount > m / 2 || (rightWordsTotal > m / 2 && correctInPlaceCount >= 1)) {
    statusLevel = 'almost';
    statusLabel = 'Almost there!';
  } else {
    statusLevel = 'keep_going';
    statusLabel = 'Keep going!';
  }

  return {
    tokens,
    isExactMatch,
    correctInPlaceCount,
    misplacedCount,
    incorrectCount,
    missingCount,
    expectedWordCount: m,
    statusLevel,
    statusLabel,
  };
}

export function getPartialStatusFromCounts(
  correctCount: number,
  totalCount: number,
  hasExtraWrong = false
): { statusLevel: FeedbackStatusLevel; statusLabel: string } {
  if (totalCount > 0 && correctCount === totalCount && !hasExtraWrong) {
    return { statusLevel: 'correct', statusLabel: 'Correct Answer!' };
  }
  if (correctCount <= 0) {
    return { statusLevel: 'needs_review', statusLabel: 'Needs Review' };
  }
  if (totalCount > 0 && correctCount > totalCount / 2) {
    return { statusLevel: 'almost', statusLabel: 'Almost there!' };
  }
  return { statusLevel: 'keep_going', statusLabel: 'Keep going!' };
}

export function getQuestionFeedbackStatus(
  question: Question,
  answer?: StudentAnswer | { answer: any; isCorrect?: boolean }
): {
  statusLevel: FeedbackStatusLevel;
  statusLabel: string;
  closeEndedAnalysis?: CloseEndedFeedbackAnalysis;
} {
  if (!answer) {
    return { statusLevel: 'needs_review', statusLabel: 'Needs Review' };
  }

  if (question.type === 'open_ended') {
    return { statusLevel: 'correct', statusLabel: 'Submitted' };
  }

  if (question.type === 'close_ended') {
    const analysis = analyzeCloseEndedFeedback(
      String(answer.answer ?? ''),
      String(question.correctAnswer ?? '')
    );
    if (answer.isCorrect) {
      return {
        statusLevel: 'correct',
        statusLabel: 'Correct Answer!',
        closeEndedAnalysis: analysis,
      };
    }
    return {
      statusLevel: analysis.statusLevel,
      statusLabel: analysis.statusLabel,
      closeEndedAnalysis: analysis,
    };
  }

  if (answer.isCorrect) {
    return { statusLevel: 'correct', statusLabel: 'Correct Answer!' };
  }

  if (question.type === 'multiple_choice' && question.allowMultipleAnswers) {
    const expectedList = question.correctAnswers || (question.correctAnswer ? [question.correctAnswer] : []);
    const chosenList: string[] = Array.isArray(answer.answer)
      ? answer.answer
      : answer.answer
      ? [String(answer.answer)]
      : [];
    const correctSelected = chosenList.filter((id) => expectedList.includes(id)).length;
    const wrongSelected = chosenList.filter((id) => !expectedList.includes(id)).length;
    return getPartialStatusFromCounts(correctSelected, expectedList.length, wrongSelected > 0);
  }

  if (question.type === 'matching' && question.matchingPairs) {
    const pairs = question.matchingPairs;
    const userPairs = (answer.answer as Record<string, string>) || {};
    const correctCount = pairs.filter((p) => userPairs[p.left] === p.right).length;
    return getPartialStatusFromCounts(correctCount, pairs.length);
  }

  if (question.type === 'drag_and_drop' && question.categories) {
    const categories = question.categories;
    const userPlacements = (answer.answer as Record<string, string[]>) || {};
    let totalItems = 0;
    let correctCount = 0;
    categories.forEach((cat) => {
      const expectedItems = cat.items || [];
      totalItems += expectedItems.length;
      const placedInCat = userPlacements[cat.id] || [];
      expectedItems.forEach((expItem) => {
        if (placedInCat.some((it) => it.trim().toLowerCase() === expItem.trim().toLowerCase())) {
          correctCount++;
        }
      });
    });
    return getPartialStatusFromCounts(correctCount, totalItems);
  }

  return { statusLevel: 'needs_review', statusLabel: 'Needs Review' };
}
