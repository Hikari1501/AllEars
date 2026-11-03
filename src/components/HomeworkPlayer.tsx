import React, { useState } from 'react';
import { Lesson, Question, StudentAnswer, LessonSubmission } from '../types';
import { UnifiedPlayer } from './UnifiedPlayer';
import { InteractiveCaptions } from './InteractiveCaptions';
import { QuestionModal } from './QuestionModal';
import { CheckCircle2, Award, ArrowLeft, RotateCcw, FileText } from 'lucide-react';

interface HomeworkPlayerProps {
  lesson: Lesson;
  studentId: string;
  studentName: string;
  onFinish: (submission: LessonSubmission) => void;
  onBack: () => void;
}

export const HomeworkPlayer: React.FC<HomeworkPlayerProps> = ({
  lesson,
  studentId,
  studentName,
  onFinish,
  onBack,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [pauseTrigger, setPauseTrigger] = useState(0);
  const [seekTriggerTime, setSeekTriggerTime] = useState<number | undefined>(undefined);
  const [showCaptions, setShowCaptions] = useState(true);

  const answeredQuestionIds = new Set(Object.keys(answers));

  const effectiveEnd =
    lesson.trimEnd && lesson.trimEnd > (lesson.trimStart || 0)
      ? lesson.trimEnd
      : lesson.duration;

  const handleRewind = (seconds: number) => {
    const target = Math.max(lesson.trimStart || 0, currentTime - seconds);
    setSeekTriggerTime(target);
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
    // Check if finished (within 1.5 seconds of trimmed duration)
    if (
      time >= effectiveEnd - 1.5 &&
      answeredQuestionIds.size === lesson.questions.length &&
      !isCompleted
    ) {
      handleCompleteLesson();
    }
  };

  const handleQuestionTrigger = (question: Question) => {
    setActiveQuestion(question);
  };

  const handleAnswerSubmit = (ans: StudentAnswer) => {
    setAnswers((prev) => ({
      ...prev,
      [ans.questionId]: ans,
    }));
  };

  const handleCompleteLesson = () => {
    let totalScore = 0;
    const maxScore = lesson.questions.reduce((sum, q) => sum + q.points, 0);

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

  const totalPointsEarned = Object.values(answers).reduce(
    (sum, a) => sum + (a.pointsEarned || 0),
    0
  );
  const maxPossiblePoints = lesson.questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            title="Back to Lessons"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              Self-Paced Homework Assignment
            </div>
            <h2 className="text-lg font-bold text-slate-900">{lesson.title}</h2>
          </div>
        </div>

        {/* Progress & Score Tracker */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
              Questions Answered
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
        </div>
      </div>

      {/* Main Player & Interactive Subtitles */}
      <div className="space-y-4">
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
          onWordClick={() => setPauseTrigger(Date.now())}
          answeredQuestionIds={answeredQuestionIds}
          onTimeUpdate={handleTimeUpdate}
          onQuestionTrigger={handleQuestionTrigger}
        />

        <InteractiveCaptions
          captions={lesson.captions}
          difficultWords={lesson.difficultWords}
          currentTime={currentTime}
          onSeek={(t) => setCurrentTime(t)}
          canSeek={!lesson.preventSkipping}
          onWordClick={() => setPauseTrigger(Date.now())}
        />
      </div>

      {/* Manual Finish Button if all answered */}
      {answeredQuestionIds.size === lesson.questions.length && !isCompleted && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="text-sm font-bold text-emerald-950">
                All listening checkpoints completed!
              </div>
              <div className="text-xs text-emerald-800">
                You have answered all {lesson.questions.length} questions. You can now submit your assignment.
              </div>
            </div>
          </div>
          <button
            onClick={handleCompleteLesson}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs tracking-wide transition-colors shadow-xs cursor-pointer"
          >
            Submit Homework & View Report
          </button>
        </div>
      )}

      {/* Interactive Question Overlay */}
      {activeQuestion && (
        <QuestionModal
          question={activeQuestion}
          onSubmit={handleAnswerSubmit}
          onContinue={() => setActiveQuestion(null)}
          isFeedbackRevealed={true}
          isLiveMode={false}
          onRewind={handleRewind}
        />
      )}
    </div>
  );
};
