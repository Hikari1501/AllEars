import React, { useState, useEffect } from 'react';
import { Lesson, Question, StudentAnswer, LessonSubmission, VocabEntry } from '../types';
import { UnifiedPlayer } from './UnifiedPlayer';
import { InteractiveCaptions } from './InteractiveCaptions';
import { StudentQuestionsPanel } from './StudentQuestionsPanel';
import { VocabPopover } from './VocabPopover';
import { PersonalVocabModal } from './PersonalVocabModal';
import {
  getSavedVocabList,
  toggleSaveVocabWord,
  PERSONAL_VOCAB_EVENT,
} from '../utils/personalVocab';
import { calculateTotalMaxPoints } from '../utils/scoring';
import {
  CheckCircle2,
  Award,
  ArrowLeft,
  Check,
  PauseCircle,
  BookOpen,
  Bookmark,
  Volume2,
} from 'lucide-react';

interface HomeworkPlayerProps {
  lesson: Lesson;
  studentId: string;
  studentName: string;
  userId?: string;
  isAutoDictation?: boolean;
  onFinish: (submission: LessonSubmission) => void;
  onBack: () => void;
}

export const HomeworkPlayer: React.FC<HomeworkPlayerProps> = ({
  lesson,
  studentId,
  studentName,
  userId,
  isAutoDictation = false,
  onFinish,
  onBack,
}) => {
  const effectiveUserId = userId || studentId;
  const [currentTime, setCurrentTime] = useState(lesson.trimStart || 0);
  const [maxWatchedTime, setMaxWatchedTime] = useState(lesson.trimStart || 0);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [pauseTrigger, setPauseTrigger] = useState(0);
  const [seekTriggerTime, setSeekTriggerTime] = useState<
    number | { time: number; nonce: number; allowJump?: boolean; autoPlay?: boolean } | undefined
  >(undefined);
  const [showCaptions, setShowCaptions] = useState(true);
  const [autoPauseAtQuestions, setAutoPauseAtQuestions] = useState(true);
  const [detectedDuration, setDetectedDuration] = useState<number>(0);

  useEffect(() => {
    setMaxWatchedTime(lesson.trimStart || 0);
  }, [lesson.id, lesson.trimStart]);

  // Video caption vocab popup & personal saved vocabulary list
  const [activeVideoVocab, setActiveVideoVocab] = useState<VocabEntry | null>(null);
  const [isPersonalVocabOpen, setIsPersonalVocabOpen] = useState(false);
  const [savedWordKeys, setSavedWordKeys] = useState<Set<string>>(() => {
    return new Set(getSavedVocabList(effectiveUserId).map((w) => w.word.trim().toLowerCase()));
  });

  useEffect(() => {
    const syncSaved = () => {
      setSavedWordKeys(
        new Set(getSavedVocabList(effectiveUserId).map((w) => w.word.trim().toLowerCase()))
      );
    };
    syncSaved();
    window.addEventListener(PERSONAL_VOCAB_EVENT, syncSaved);
    return () => window.removeEventListener(PERSONAL_VOCAB_EVENT, syncSaved);
  }, [effectiveUserId]);

  const answeredQuestionIds = new Set(Object.keys(answers));

  const effectiveEnd =
    lesson.trimEnd && lesson.trimEnd > (lesson.trimStart || 0)
      ? lesson.trimEnd
      : detectedDuration || lesson.duration || 0;

  const handleRewind = (seconds: number) => {
    const target = Math.max(lesson.trimStart || 0, currentTime - seconds);
    setSeekTriggerTime({ time: target, nonce: Date.now() });
  };

  const handleSeek = (seconds: number) => {
    if (lesson.preventSkipping && seconds > maxWatchedTime + 1) {
      return;
    }
    setSeekTriggerTime({ time: seconds, nonce: Date.now() });
  };

  const handleTipSeek = (seconds: number) => {
    if (lesson.preventSkipping && seconds > maxWatchedTime + 1) {
      return;
    }
    setSeekTriggerTime({ time: seconds, nonce: Date.now(), allowJump: false, autoPlay: true });
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
    setMaxWatchedTime((prev) => (time > prev ? time : prev));
    // Check if finished (within 1.5 seconds of effective duration)
    if (
      effectiveEnd > 0 &&
      time >= effectiveEnd - 1.5 &&
      lesson.questions.length > 0 &&
      answeredQuestionIds.size === lesson.questions.length &&
      !isCompleted
    ) {
      handleCompleteLesson();
    }
  };

  const handleQuestionTrigger = (question: Question) => {
    setActiveQuestionId(question.id);
  };

  const handleAnswerSubmit = (ans: StudentAnswer) => {
    setAnswers((prev) => ({
      ...prev,
      [ans.questionId]: ans,
    }));
  };

  const handleCompleteLesson = () => {
    let totalScore = 0;
    const maxScore = calculateTotalMaxPoints(lesson.questions);

    Object.values(answers).forEach((ans) => {
      totalScore += ans.pointsEarned || 0;
    });

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 100;

    const submission: LessonSubmission = {
      id: `sub-${Date.now()}`,
      lessonId: lesson.id,
      studentId,
      studentName,
      totalScore,
      maxScore,
      percentage,
      answers,
      completedAt: new Date().toLocaleString(),
    };

    setIsCompleted(true);
    onFinish(submission);
  };

  const handleToggleSaveVocab = (vocab: VocabEntry) => {
    const res = toggleSaveVocabWord(effectiveUserId, vocab, {
      id: lesson.id,
      title: lesson.title,
    });
    setSavedWordKeys(new Set(res.list.map((w) => w.word.trim().toLowerCase())));
  };

  const speakWord = (word: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const totalPointsEarned = Object.values(answers).reduce(
    (sum, a) => sum + (a.pointsEarned || 0),
    0
  );
  const maxPossiblePoints = calculateTotalMaxPoints(lesson.questions);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Back to Lessons"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              {isAutoDictation
                ? 'Auto-Dictation Practice · Device Only'
                : 'Self-Paced Listening Homework'}
            </div>
            <h2 className="text-lg font-bold text-slate-900">{lesson.title}</h2>
          </div>
        </div>

        {/* Progress, Auto-Pause Toggle & Score Tracker */}
        <div className="flex items-center flex-wrap gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => {
              setAutoPauseAtQuestions((prev) => {
                const next = !prev;
                if (!next) setActiveQuestionId(null);
                return next;
              });
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              autoPauseAtQuestions
                ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title={
              autoPauseAtQuestions
                ? 'Video auto-pauses at each question timestamp & highlights it (Click to turn OFF)'
                : 'Video plays continuously without pausing at question timestamps (Click to turn ON)'
            }
          >
            <PauseCircle
              className={`w-3.5 h-3.5 ${autoPauseAtQuestions ? 'text-amber-600' : 'text-slate-400'}`}
            />
            <span>Auto-Pause at Questions: {autoPauseAtQuestions ? 'ON' : 'OFF'}</span>
          </button>

          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
              Questions Completed
            </div>
            <div className="text-sm font-bold text-slate-800 font-mono">
              {answeredQuestionIds.size} / {lesson.questions.length}
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 text-slate-950 rounded-xl font-mono font-bold text-sm shadow-xs">
            <Award className="w-4 h-4" />
            <span>
              {totalPointsEarned} / {maxPossiblePoints} pts
            </span>
          </div>

          {answeredQuestionIds.size === lesson.questions.length && (
            <button
              onClick={handleCompleteLesson}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs tracking-wide transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isAutoDictation ? 'Finish & View Report' : 'Submit & Finish'}</span>
            </button>
          )}
        </div>
      </div>

      {/* TWO COLUMN SIDE-BY-SIDE LAYOUT: Left = Video, Captions & Glossed Words, Right = Questions Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Player, Interactive Captions & Glossed Words */}
        <div className="lg:col-span-7 space-y-4">
          <UnifiedPlayer
            mediaType={lesson.mediaType}
            mediaUrl={lesson.mediaUrl}
            duration={lesson.duration}
            trimStart={lesson.trimStart}
            trimEnd={lesson.trimEnd}
            questions={lesson.questions}
            preventSkipping={lesson.preventSkipping}
            isStudent={true}
            pauseTrigger={pauseTrigger}
            seekTriggerTime={seekTriggerTime}
            captions={lesson.captions}
            difficultWords={lesson.difficultWords}
            showCaptions={showCaptions}
            onToggleCaptions={() => setShowCaptions(!showCaptions)}
            onWordClick={(vocab) => {
              setPauseTrigger(Date.now());
              setActiveVideoVocab(vocab);
            }}
            answeredQuestionIds={answeredQuestionIds}
            autoPauseAtCheckpoints={autoPauseAtQuestions}
            onTimeUpdate={handleTimeUpdate}
            onQuestionTrigger={handleQuestionTrigger}
            onDurationDetected={setDetectedDuration}
          />

          <InteractiveCaptions
            captions={lesson.captions}
            difficultWords={lesson.difficultWords}
            currentTime={currentTime}
            onSeek={(t) => {
              if (!lesson.preventSkipping) handleSeek(t);
            }}
            canSeek={!lesson.preventSkipping}
            onWordClick={() => setPauseTrigger(Date.now())}
            isCollapsed={!showCaptions}
            onExpand={() => setShowCaptions(true)}
            userId={effectiveUserId}
            lessonId={lesson.id}
            lessonTitle={lesson.title}
          />

          {/* Glossed Words & Personal Saved Vocabulary Panel */}
          {(lesson.difficultWords.length > 0 || savedWordKeys.size > 0) && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Glossed Words ({lesson.difficultWords.length})
                  </h3>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    · Save words to review later
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPersonalVocabOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                  <span>My Vocabulary ({savedWordKeys.size})</span>
                </button>
              </div>

              {lesson.difficultWords.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">
                  No glossed words added to this lesson. Open &quot;My Vocabulary&quot; to review saved words from other lessons.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {lesson.difficultWords.map((vocab) => {
                    const isSaved = savedWordKeys.has(vocab.word.trim().toLowerCase());
                    return (
                      <div
                        key={vocab.word}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-amber-50/40 hover:border-amber-200 transition-colors flex items-start justify-between gap-2.5"
                      >
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => {
                            setPauseTrigger(Date.now());
                            setActiveVideoVocab(vocab);
                          }}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900">
                              {vocab.word}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              {vocab.cefrLevel}
                            </span>
                            {vocab.phonetic && (
                              <span className="text-[11px] font-mono text-slate-400">
                                {vocab.phonetic}
                              </span>
                            )}
                          </div>
                          {vocab.vietnameseTranslation && vocab.vietnameseTranslation.trim() && (
                            <div className="text-[11px] font-semibold text-emerald-800 mt-0.5 truncate">
                              {vocab.vietnameseTranslation}
                            </div>
                          )}
                          {vocab.definition && vocab.definition.trim() && (
                            <div className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                              {vocab.definition}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => speakWord(vocab.word)}
                            className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Pronounce word"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleSaveVocab(vocab)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isSaved
                                ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200'
                                : 'bg-white border-slate-200 text-slate-400 hover:text-amber-600 hover:border-amber-200'
                            }`}
                            title={isSaved ? 'Saved to My Vocabulary (click to remove)' : 'Save to My Vocabulary'}
                          >
                            <Bookmark
                              className={`w-3.5 h-3.5 ${isSaved ? 'fill-amber-500 text-amber-600' : ''}`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Persistent Questions Panel */}
        <div className="lg:col-span-5 lg:sticky lg:top-20">
          <StudentQuestionsPanel
            questions={lesson.questions}
            currentActiveQuestionId={autoPauseAtQuestions ? activeQuestionId : null}
            answers={answers}
            onAnswerSubmit={handleAnswerSubmit}
            onRewind={handleRewind}
            onSeek={(t) => {
              if (!lesson.preventSkipping || t <= maxWatchedTime + 1) handleSeek(t);
            }}
            onTipSeek={handleTipSeek}
            onContinueWatching={() => setActiveQuestionId(null)}
            isLiveMode={false}
            allowRewind={true}
            preventSkipping={lesson.preventSkipping}
            maxWatchedTime={maxWatchedTime}
            backgroundInfoText={lesson.backgroundInfoText}
            backgroundInfoImageUrl={lesson.backgroundInfoImageUrl}
          />
        </div>
      </div>

      {/* Completion Banner if all answered */}
      {answeredQuestionIds.size === lesson.questions.length && !isCompleted && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between flex-wrap gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="text-sm font-bold text-emerald-950">
                All listening checkpoints completed!
              </div>
              <div className="text-xs text-emerald-800">
                {isAutoDictation
                  ? `You scored ${totalPointsEarned} out of ${maxPossiblePoints} points. Finish now to view your private dictation report.`
                  : `You scored ${totalPointsEarned} out of ${maxPossiblePoints} points. Submit now to generate your homework score report.`}
              </div>
            </div>
          </div>
          <button
            onClick={handleCompleteLesson}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs tracking-wide transition-colors shadow-xs cursor-pointer"
          >
            {isAutoDictation
              ? 'Finish & View Dictation Report'
              : 'Submit Homework & View Report'}
          </button>
        </div>
      )}

      {/* Vocabulary Popup when clicking glossed word inside Video Captions or Glossed Words list */}
      {activeVideoVocab && (
        <VocabPopover
          vocab={activeVideoVocab}
          onClose={() => setActiveVideoVocab(null)}
          isSaved={savedWordKeys.has(activeVideoVocab.word.trim().toLowerCase())}
          onToggleSave={() => handleToggleSaveVocab(activeVideoVocab)}
        />
      )}

      {/* Personal Saved Vocabulary Review Modal */}
      <PersonalVocabModal
        isOpen={isPersonalVocabOpen}
        onClose={() => setIsPersonalVocabOpen(false)}
        userId={effectiveUserId}
      />
    </div>
  );
};
