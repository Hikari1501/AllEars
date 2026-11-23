export type UserRole = 'teacher' | 'student';

export interface UserAccount {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  avatar?: string;
  isAdmin?: boolean;
  password?: string;
}

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'matching'
  | 'drag_and_drop'
  | 'close_ended'
  | 'open_ended';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface MatchingPair {
  left: string;
  right: string;
}

export interface DragDropCategory {
  id: string;
  name: string;
  items: string[];
}

export interface Question {
  id: string;
  timestamp?: number | null; // in seconds; null/undefined for general whole-video questions
  type: QuestionType;
  prompt: string;
  options?: QuestionOption[];
  correctAnswer?: string; // single option ID or exact close-ended text
  correctAnswers?: string[]; // for multi-select multiple choice
  allowMultipleAnswers?: boolean; // toggle for multiple correct options
  matchingPairs?: MatchingPair[];
  categories?: DragDropCategory[]; // For drag_and_drop questions: categories and their correct items
  imageUrl?: string; // Optional image URL attached to the question
  tip?: string; // Optional teacher tip/hint for students
  tipTimestamps?: number[]; // Optional timestamps (seconds) pointing to where needed information lies
  explanation?: string; // Legacy fallback explanation
  explanationCorrect?: string; // Optional explanation shown when student answers correctly
  explanationIncorrect?: string; // Optional explanation shown when student answers incorrectly
  points: number;
}

export interface CaptionSegment {
  id: string;
  start: number; // in seconds
  end: number; // in seconds
  text: string;
  speaker?: string;
}

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'idiom'
  | 'phrasal verb'
  | 'pronoun'
  | 'preposition'
  | 'conjunction'
  | 'determiner'
  | 'interjection';

export interface VocabEntry {
  word: string;
  phonetic: string;
  cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  partOfSpeech: PartOfSpeech;
  definition: string;
  example: string;
  cambridgeSlug: string;
  imageUrl?: string;
  inflections?: string[];
  vietnameseTranslation?: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  backgroundInfoText?: string;
  backgroundInfoImageUrl?: string;
  level: CEFRLevel;
  mediaType: 'youtube' | 'video' | 'audio';
  mediaUrl: string;
  duration: number; // in seconds
  trimStart?: number; // optional start trim timestamp
  trimEnd?: number; // optional end trim timestamp
  preventSkipping: boolean;
  thumbnailUrl?: string;
  teacherId: string;
  teacherName: string;
  captions: CaptionSegment[];
  questions: Question[];
  difficultWords: VocabEntry[];
  isPublished?: boolean;
  isLocalStudentOnly?: boolean; // For private student self-study lessons on this device only
  createdAt: string;
}

export interface StudentAnswer {
  questionId: string;
  answer: any;
  isCorrect?: boolean;
  pointsEarned: number;
  aiFeedback?: string;
  submittedAt: number;
}

export interface LessonSubmission {
  id: string;
  lessonId: string;
  studentId: string;
  studentName: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  answers: Record<string, StudentAnswer>;
  completedAt: string;
}

export interface LiveStudentData {
  id: string;
  name: string;
  isBot?: boolean;
  score: number;
  answers: Record<string, { answer: any; isCorrect: boolean; points: number; submittedAt: number }>;
  joinedAt: number;
}

export interface AnonymousStudentResponse {
  questionId: string;
  questionPrompt: string;
  questionType?: string;
  answerText: string;
  isCorrect?: boolean;
  explanation?: string;
}

export interface LiveSessionState {
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
  activeVocabWord?: VocabEntry | null;
  activeStudentResponse?: AnonymousStudentResponse | null;
  allowEditAnswer?: boolean;
  allowStudentCaptions?: boolean;
  autoPauseAtCheckpoints?: boolean;
  isCompleted: boolean;
  students: Record<string, LiveStudentData>;
  lastUpdated: number;
  createdAt?: number;
}

export interface SessionQuestionStat {
  questionId: string;
  prompt: string;
  type: QuestionType;
  totalAnswered: number;
  correctCount: number;
  accuracy: number;
}

export interface SessionReportStudent {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
  answers: Record<string, any>;
  isBot?: boolean;
  joinedAt?: number;
  completedAt?: string;
}

export interface SessionReport {
  sessionId: string;
  pin?: string;
  lessonId: string;
  lessonTitle: string;
  teacherId: string;
  teacherName: string;
  mode: 'live' | 'homework';
  createdAt: number;
  endedAt: number;
  totalStudents: number;
  averageScore: number;
  students: SessionReportStudent[];
  questionStats?: Record<string, SessionQuestionStat>;
}

export interface SavedVocabItem extends VocabEntry {
  savedAt: number;
  lessonId?: string;
  lessonTitle?: string;
}

export interface AutoDictationQuestionResult {
  questionId: string;
  timestamp: number;
  prompt: string;
  correctAnswer: string;
  studentAnswer: string;
  isCorrect: boolean;
  pointsEarned: number;
  maxPoints: number;
}

export interface AutoDictationReport {
  id: string;
  lessonId: string;
  lessonTitle: string;
  studentId: string;
  createdAt: number;
  minWordsPerBlank: number;
  maxWordsPerBlank: number;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  results: AutoDictationQuestionResult[];
}
