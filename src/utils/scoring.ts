import type { Question } from '../types';

export const POINTS_PER_PART = 10;

export function getQuestionPartsCount(question: Partial<Question> | null | undefined): number {
  if (!question || question.type === 'open_ended') {
    return 0;
  }

  if (
    question.type === 'multiple_choice' &&
    (question.allowMultipleAnswers ||
      (Array.isArray(question.correctAnswers) && question.correctAnswers.length > 1))
  ) {
    const rawCorrect =
      Array.isArray(question.correctAnswers) && question.correctAnswers.length > 0
        ? question.correctAnswers
        : question.correctAnswer
        ? [question.correctAnswer]
        : [];
    const uniqueCount = new Set(
      rawCorrect.map((v) => String(v).trim()).filter(Boolean)
    ).size;
    return Math.max(1, uniqueCount);
  }

  if (question.type === 'matching') {
    const pairCount = Array.isArray(question.matchingPairs) ? question.matchingPairs.length : 0;
    return Math.max(1, pairCount);
  }

  if (question.type === 'drag_and_drop') {
    const categories = Array.isArray(question.categories) ? question.categories : [];
    const totalItems = categories.reduce(
      (sum, cat) => sum + (Array.isArray(cat.items) ? cat.items.length : 0),
      0
    );
    return Math.max(1, totalItems);
  }

  // Single-part questions: multiple_choice (single), true_false, close_ended
  return 1;
}

export function getQuestionMaxPoints(question: Partial<Question> | null | undefined): number {
  if (!question || question.type === 'open_ended') {
    return 0;
  }
  return getQuestionPartsCount(question) * POINTS_PER_PART;
}

export function calculateTotalMaxPoints(
  questions: Array<Partial<Question>> | null | undefined
): number {
  if (!Array.isArray(questions)) return 0;
  return questions.reduce((sum, q) => sum + getQuestionMaxPoints(q), 0);
}

export function normalizeQuestionPoints<T extends Partial<Question>>(question: T): T {
  return {
    ...question,
    points: getQuestionMaxPoints(question),
  };
}

export interface EvaluatedQuestionResult {
  isCorrect: boolean;
  pointsEarned: number;
  maxPoints: number;
}

export function evaluateQuestionAnswer(
  question: Question,
  rawAnswer: any
): EvaluatedQuestionResult {
  const maxPoints = getQuestionMaxPoints(question);

  if (question.type === 'open_ended') {
    return {
      isCorrect: true,
      pointsEarned: 0,
      maxPoints: 0,
    };
  }

  if (question.type === 'multiple_choice') {
    if (
      question.allowMultipleAnswers ||
      (Array.isArray(question.correctAnswers) && question.correctAnswers.length > 1)
    ) {
      const expectedRaw =
        Array.isArray(question.correctAnswers) && question.correctAnswers.length > 0
          ? question.correctAnswers
          : [question.correctAnswer || 'a'];
      const correctSet = new Set(expectedRaw.map((v) => String(v).trim().toLowerCase()).filter(Boolean));
      const chosenRaw = Array.isArray(rawAnswer) ? rawAnswer : rawAnswer ? [rawAnswer] : [];
      const chosenUnique = Array.from(
        new Set(chosenRaw.map((v) => String(v).trim().toLowerCase()).filter(Boolean))
      );

      const correctSelected = chosenUnique.filter((id) => correctSet.has(id)).length;
      const wrongSelected = chosenUnique.filter((id) => !correctSet.has(id)).length;
      const isCorrect =
        correctSet.size > 0 && correctSelected === correctSet.size && wrongSelected === 0;
      const pointsEarned = Math.min(
        maxPoints,
        Math.max(0, (correctSelected - wrongSelected) * POINTS_PER_PART)
      );

      return { isCorrect, pointsEarned, maxPoints };
    }

    const correct = (question.correctAnswer || 'a').trim().toLowerCase();
    const isCorrect = String(rawAnswer ?? '').trim().toLowerCase() === correct;
    return {
      isCorrect,
      pointsEarned: isCorrect ? POINTS_PER_PART : 0,
      maxPoints,
    };
  }

  if (question.type === 'true_false') {
    const correct = (question.correctAnswer || 'true').trim().toLowerCase();
    const isCorrect = String(rawAnswer ?? '').trim().toLowerCase() === correct;
    return {
      isCorrect,
      pointsEarned: isCorrect ? POINTS_PER_PART : 0,
      maxPoints,
    };
  }

  if (question.type === 'close_ended') {
    const expected = (question.correctAnswer || '').trim().toLowerCase();
    const actual = String(rawAnswer ?? '').trim().toLowerCase();
    const isCorrect = expected.length > 0 && actual === expected;
    return {
      isCorrect,
      pointsEarned: isCorrect ? POINTS_PER_PART : 0,
      maxPoints,
    };
  }

  if (question.type === 'matching') {
    const pairs = Array.isArray(question.matchingPairs) ? question.matchingPairs : [];
    const userPairs = (rawAnswer && typeof rawAnswer === 'object' ? rawAnswer : {}) as Record<
      string,
      string
    >;
    const correctCount = pairs.filter((p) => userPairs[p.left] === p.right).length;
    const isCorrect = pairs.length > 0 && correctCount === pairs.length;
    const pointsEarned = pairs.length > 0 ? Math.min(maxPoints, correctCount * POINTS_PER_PART) : 0;
    return { isCorrect, pointsEarned, maxPoints };
  }

  if (question.type === 'drag_and_drop') {
    const categories = Array.isArray(question.categories) ? question.categories : [];
    const userPlacements = (rawAnswer && typeof rawAnswer === 'object'
      ? rawAnswer
      : {}) as Record<string, string[]>;
    let totalItems = 0;
    let correctCount = 0;

    categories.forEach((cat) => {
      const expectedItems = Array.isArray(cat.items) ? cat.items : [];
      totalItems += expectedItems.length;
      const placedInCat = Array.isArray(userPlacements[cat.id]) ? userPlacements[cat.id] : [];
      expectedItems.forEach((expItem) => {
        if (
          placedInCat.some((it) => it.trim().toLowerCase() === expItem.trim().toLowerCase())
        ) {
          correctCount++;
        }
      });
    });

    const isCorrect = totalItems > 0 && correctCount === totalItems;
    const pointsEarned =
      totalItems > 0 ? Math.min(maxPoints, correctCount * POINTS_PER_PART) : 0;
    return { isCorrect, pointsEarned, maxPoints };
  }

  return { isCorrect: false, pointsEarned: 0, maxPoints };
}
