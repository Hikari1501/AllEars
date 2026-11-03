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
  | 'close_ended'
  | 'open_ended';

export type CEFRLevel = 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface MatchingPair {
  left: string;
  right: string;
}

export interface Question {
  id: string;
  timestamp: number; // in seconds
  type: QuestionType;
  prompt: string;
  options?: QuestionOption[];
  correctAnswer?: string; // single option ID or exact close-ended text
  correctAnswers?: string[]; // for multi-select multiple choice
  allowMultipleAnswers?: boolean; // toggle for multiple correct options
  matchingPairs?: MatchingPair[];
  explanation: string;
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
  cefrLevel: 'B1' | 'B2' | 'C1' | 'C2';
  partOfSpeech: PartOfSpeech;
  definition: string;
  example: string;
  cambridgeSlug: string;
  imageUrl?: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
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
  activeVocabWord?: VocabEntry | null;
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

