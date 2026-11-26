import React, { useState, useEffect } from 'react';
import { Question, StudentAnswer } from '../types';
import { MatchingPairsCanvas } from './MatchingPairsCanvas';
import { DragAndDropCanvas } from './DragAndDropCanvas';
import { playSuccessChime, playWrongAnswerSound } from '../utils/soundEffects';
import { getQuestionFeedbackStatus } from '../utils/feedbackHelpers';
import { evaluateQuestionAnswer, getQuestionMaxPoints } from '../utils/scoring';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Check,
  Square,
  CheckSquare,
  RotateCcw,
  Headphones,
  Minimize2,
  Maximize2,
  Lightbulb,
  ChevronDown,
  Clock,
  KeyRound,
} from 'lucide-react';

interface QuestionModalProps {
  question: Question;
  onSubmit: (answer: StudentAnswer) => void;
  onContinue: () => void;
  isFeedbackRevealed?: boolean;
  isLiveMode?: boolean;
  onRewind?: (seconds: number) => void;
}

export const QuestionModal: React.FC<QuestionModalProps> = ({
  question,
  onSubmit,
  onContinue,
  isFeedbackRevealed = true,
  isLiveMode = false,
  onRewind,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  // Single selection
  const [selectedOption, setSelectedOption] = useState<string>('');
  // Multi-selection for multiple choice with multiple correct answers
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());

  const [textInput, setTextInput] = useState<string>('');
  // For matching type
  const [matchingSelections, setMatchingSelections] = useState<Record<string, string>>({});
  const [selectedLeftItem, setSelectedLeftItem] = useState<string | null>(null);
  // For drag and drop type
  const [dragDropPlacements, setDragDropPlacements] = useState<Record<string, string[]>>({});
  const [showTip, setShowTip] = useState<boolean>(false);

  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [isGradingAi, setIsGradingAi] = useState<boolean>(false);
  const [aiFeedback, setAiFeedback] = useState<string>('');
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean>(false);
  const [pointsEarned, setPointsEarned] = useState<number>(0);

  const isMultiSelect =
    question.type === 'multiple_choice' &&
    (question.allowMultipleAnswers ||
      (question.correctAnswers && question.correctAnswers.length > 1));

  // Reset when question changes
  useEffect(() => {
    setSelectedOption('');
    setSelectedOptions(new Set());
    setTextInput('');
    setMatchingSelections({});
    setSelectedLeftItem(null);
    setDragDropPlacements({});
    setShowTip(false);
    setHasSubmitted(false);
    setIsGradingAi(false);
    setAiFeedback('');
    setIsAnswerCorrect(false);
    setPointsEarned(0);
  }, [question.id]);

  const handleOptionToggle = (optionId: string) => {
    if (hasSubmitted) return;

    if (isMultiSelect) {
      setSelectedOptions((prev) => {
        const next = new Set(prev);
        if (next.has(optionId)) next.delete(optionId);
        else next.add(optionId);
        return next;
      });
    } else {
      setSelectedOption(optionId);
    }
  };

  const handleMatchLeftClick = (left: string) => {
    if (hasSubmitted) return;
    setSelectedLeftItem(left);
  };

  const handleMatchRightClick = (right: string) => {
    if (hasSubmitted || !selectedLeftItem) return;
    setMatchingSelections((prev) => ({
      ...prev,
      [selectedLeftItem]: right,
    }));
    setSelectedLeftItem(null);
  };

  const handleSubmit = async () => {
    if (hasSubmitted) return;

    let finalAnswer: any = null;
    if (question.type === 'multiple_choice') {
      finalAnswer = isMultiSelect ? Array.from(selectedOptions) : selectedOption;
    } else if (question.type === 'true_false') {
      finalAnswer = selectedOption;
    } else if (question.type === 'close_ended' || question.type === 'open_ended') {
      finalAnswer = textInput.trim();
    } else if (question.type === 'matching') {
      finalAnswer = matchingSelections;
    } else if (question.type === 'drag_and_drop') {
      finalAnswer = dragDropPlacements;
    }

    const { isCorrect: correct, pointsEarned: earned } = evaluateQuestionAnswer(
      question,
      finalAnswer
    );

    // Play sound on students' device: chime for all correct, gentle cue for wrong answer
    if (correct && question.type !== 'open_ended') {
      playSuccessChime();
    } else if (!correct && question.type !== 'open_ended') {
      playWrongAnswerSound();
    }

    // Automatically open Question Tip (if available) on wrong answer
    const hasTipContent = Boolean(
      question.tip?.trim() || (question.tipTimestamps && question.tipTimestamps.length > 0)
    );
    if (!correct && question.type !== 'open_ended' && hasTipContent) {
      setShowTip(true);
    }

    setIsAnswerCorrect(correct);
    setPointsEarned(earned);
    setHasSubmitted(true);

    const submission: StudentAnswer = {
      questionId: question.id,
      answer: finalAnswer,
      isCorrect: correct,
      pointsEarned: earned,
      submittedAt: Date.now(),
    };

    onSubmit(submission);
  };

  const isFormValid = () => {
    if (question.type === 'multiple_choice') {
      return isMultiSelect ? selectedOptions.size > 0 : !!selectedOption;
    }
    if (question.type === 'true_false') {
      return !!selectedOption;
    }
    if (question.type === 'close_ended' || question.type === 'open_ended') {
      return textInput.trim().length > 0;
    }
    if (question.type === 'matching' && question.matchingPairs) {
      return Object.keys(matchingSelections).length === question.matchingPairs.length;
    }
    if (question.type === 'drag_and_drop') {
      const placedCount = Object.values(dragDropPlacements).reduce(
        (sum, arr) => sum + (arr ? arr.length : 0),
        0
      );
      return placedCount > 0;
    }
    return false;
  };

  const canShowFeedback = hasSubmitted;
  const canShowKey = isLiveMode ? Boolean(isFeedbackRevealed) : hasSubmitted;

  // Floating minimized pill for students in homework mode to listen and scrub freely
  if (isMinimized && !isLiveMode) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-in slide-in-from-bottom-3 duration-200 pointer-events-auto">
        <div className="bg-slate-950/95 backdrop-blur-md text-white border-2 border-amber-500/70 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400 flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5" />
                <span>Audio Checkpoint In Progress</span>
              </div>
              <p className="text-xs text-slate-200 font-medium truncate mt-0.5">{question.prompt}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onRewind && onRewind(5)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Rewind audio 5 seconds"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>-5s</span>
            </button>
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Answer Question</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const formatTipTimestamp = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {question.type === 'open_ended'
                ? 'Formative Checkpoint · Ungraded Reflection'
                : `Formative Checkpoint · ${getQuestionMaxPoints(question)} Points`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 font-mono hidden sm:block">
              {question.type === 'multiple_choice' &&
                (isMultiSelect ? 'Multiple Choice (Select all correct)' : 'Multiple Choice (Single)')}
              {question.type === 'true_false' && 'True / False'}
              {question.type === 'matching' && 'Matching Pairs'}
              {question.type === 'close_ended' && 'Fill in the Blank'}
              {question.type === 'open_ended' && 'Open Reflection'}
            </div>
            {!isLiveMode && (
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                title="Minimize question to view video"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Homework Audio Rewind Bar - allows student to re-listen without modal blocking */}
          {!isLiveMode && !hasSubmitted && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-medium">
                <Headphones className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Can't answer yet? Rewind the audio to listen again:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onRewind && onRewind(5)}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  title="Rewind audio 5 seconds and play"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Rewind 5s</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRewind && onRewind(10)}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  title="Rewind audio 10 seconds and play"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Rewind 10s</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  title="Minimize to watch/scrub video"
                >
                  <Minimize2 className="w-3 h-3" />
                  <span>Watch Video</span>
                </button>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-snug">
              {question.prompt}
            </h3>
            {isMultiSelect && !hasSubmitted && (
              <span className="text-xs text-amber-700 font-semibold mt-1 inline-block">
                * You can select more than one option.
              </span>
            )}
          </div>

          {/* Attached Question Image (Only shown if image URL exists) */}
          {question.imageUrl && (
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center p-1.5 shadow-2xs">
              <img
                src={question.imageUrl}
                alt="Question Illustration"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
                className="max-h-56 max-w-full object-contain rounded-lg"
              />
            </div>
          )}

          {/* Question Tip (Only shown if tip text or timestamps exist; collapsed by default, auto-opens on wrong answer) */}
          {(question.tip?.trim() || (question.tipTimestamps && question.tipTimestamps.length > 0)) && (
            <div>
              <button
                type="button"
                onClick={() => setShowTip((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                  showTip
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-amber-50 hover:bg-amber-100/80 text-amber-800 border-amber-200'
                }`}
                title={showTip ? 'Hide Question Tip' : 'View Question Tip'}
                aria-label={showTip ? 'Hide Question Tip' : 'View Question Tip'}
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-600 fill-amber-400" />
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    showTip ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showTip && (
                <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs leading-relaxed shadow-2xs animate-in fade-in duration-150">
                  <div className="space-y-2">
                    {question.tip && question.tip.trim().length > 0 && (
                      <p className="whitespace-pre-line">{question.tip}</p>
                    )}
                    {question.tipTimestamps && question.tipTimestamps.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {question.tipTimestamps.map((ts, tsIdx) => (
                          <span
                            key={`${question.id}-modal-tip-ts-${tsIdx}-${ts}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/80 text-amber-900 border border-amber-300 font-mono text-[11px] font-bold"
                          >
                            <Clock className="w-2.5 h-2.5 text-amber-700" />
                            <span>{formatTipTimestamp(ts)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Type: Multiple Choice or True/False */}
          {(question.type === 'multiple_choice' || question.type === 'true_false') && question.options && (
            <div className="space-y-2.5">
              {question.options.map((option) => {
                const isSelected = isMultiSelect
                  ? selectedOptions.has(option.id)
                  : selectedOption === option.id;

                const expectedList = question.correctAnswers || [question.correctAnswer || ''];
                const isCorrect = expectedList.includes(option.id);

                let stateClass = 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800';
                if (isSelected) {
                  stateClass = 'border-amber-500 bg-amber-50/50 text-amber-950 font-medium shadow-xs';
                }

                if (canShowKey) {
                  if (isCorrect) {
                    stateClass = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-medium';
                  } else if (isSelected && !isCorrect) {
                    stateClass = 'border-rose-400 bg-rose-50 text-rose-950';
                  } else {
                    stateClass = 'opacity-50 border-slate-200 text-slate-500';
                  }
                } else if (canShowFeedback && isMultiSelect && isSelected) {
                  stateClass = isCorrect
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-medium'
                    : 'border-rose-400 bg-rose-50 text-rose-950';
                } else if (canShowFeedback && isSelected && !isAnswerCorrect) {
                  stateClass = 'border-rose-400 bg-rose-50 text-rose-950';
                }

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={hasSubmitted}
                    onClick={() => handleOptionToggle(option.id)}
                    className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-start gap-3 cursor-pointer ${stateClass}`}
                  >
                    <span className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold uppercase mt-0.5 border border-slate-300">
                      {isMultiSelect ? (
                        isSelected ? <CheckSquare className="w-4 h-4 text-amber-600" /> : <Square className="w-4 h-4 text-slate-400" />
                      ) : (
                        option.id
                      )}
                    </span>
                    <span className="text-sm leading-relaxed flex-1">{option.text}</span>
                    {(canShowKey || (canShowFeedback && isMultiSelect && isSelected)) && isCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    {(canShowKey || (canShowFeedback && !isAnswerCorrect)) && isSelected && !isCorrect && (
                      <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Type: Close-Ended (Short answer) */}
          {question.type === 'close_ended' && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-600">
                Type the exact word or phrase you heard in the audio:
              </label>
              <input
                type="text"
                disabled={hasSubmitted}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full p-3 text-base border-2 border-slate-300 rounded-xl focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
          )}

          {/* Type: Matching Pairs */}
          {question.type === 'matching' && question.matchingPairs && (
            <div className="space-y-4">
              <MatchingPairsCanvas
                questionId={question.id}
                pairs={question.matchingPairs}
                currentSelections={matchingSelections}
                onPairMatch={(left, right) =>
                  setMatchingSelections((prev) => {
                    const next = { ...prev };
                    if (!right) {
                      delete next[left];
                    } else {
                      Object.keys(next).forEach((k) => {
                        if (next[k] === right) delete next[k];
                      });
                      next[left] = right;
                    }
                    return next;
                  })
                }
                disabled={hasSubmitted}
                isFeedbackVisible={canShowFeedback}
              />
            </div>
          )}

          {/* Type: Drag and Drop (Categorization) */}
          {question.type === 'drag_and_drop' && question.categories && (
            <div className="space-y-4">
              <DragAndDropCanvas
                questionId={question.id}
                categories={question.categories}
                currentPlacements={dragDropPlacements}
                onPlacementsChange={(placements) => setDragDropPlacements(placements)}
                onSubmit={() => handleSubmit()}
                disabled={hasSubmitted}
                isAnswered={hasSubmitted}
                isFeedbackVisible={canShowFeedback}
                canShowKey={canShowKey}
                pointsEarned={pointsEarned}
                totalPoints={getQuestionMaxPoints(question)}
              />
            </div>
          )}

          {/* Type: Open-Ended */}
          {question.type === 'open_ended' && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-600">
                Write a thoughtful response in English based on what you heard:
              </label>
              <textarea
                disabled={hasSubmitted}
                rows={4}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Explain in your own words..."
                className="w-full p-3 text-sm border-2 border-slate-300 rounded-xl focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 leading-relaxed"
              />
            </div>
          )}

          {/* Directional Explanation & Answer Status once submitted */}
          {canShowFeedback && (() => {
            const currentAnswerPayload =
              question.type === 'multiple_choice'
                ? isMultiSelect
                  ? Array.from(selectedOptions)
                  : selectedOption
                : question.type === 'true_false'
                ? selectedOption
                : question.type === 'matching'
                ? matchingSelections
                : question.type === 'drag_and_drop'
                ? dragDropPlacements
                : textInput.trim();

            const feedbackStatus = getQuestionFeedbackStatus(question, {
              answer: currentAnswerPayload,
              isCorrect: isAnswerCorrect,
            });
            const closeEndedAnalysis = feedbackStatus.closeEndedAnalysis;

            const hasSpecificExp =
              question.explanationCorrect !== undefined ||
              question.explanationIncorrect !== undefined;
            const directionalExplanation = isAnswerCorrect
              ? (question.explanationCorrect || (!hasSpecificExp ? question.explanation : ''))
              : (question.explanationIncorrect || (!hasSpecificExp ? question.explanation : ''));

            const bannerStyle =
              feedbackStatus.statusLevel === 'correct'
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                : feedbackStatus.statusLevel === 'almost'
                ? 'bg-sky-50/90 border-sky-300 text-sky-950'
                : 'bg-amber-50/90 border-amber-300 text-amber-950';

            return (
              <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${bannerStyle}`}>
                <div className="flex items-center justify-between gap-2 font-bold">
                  <div className="flex items-center gap-1.5 text-sm">
                    {feedbackStatus.statusLevel === 'correct' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                        <span className="text-emerald-900 font-extrabold">
                          {feedbackStatus.statusLabel}
                        </span>
                      </>
                    ) : feedbackStatus.statusLevel === 'almost' ? (
                      <>
                        <Sparkles className="w-4 h-4 text-sky-600 stroke-[2.5]" />
                        <span className="text-sky-900 font-extrabold">
                          {feedbackStatus.statusLabel}
                        </span>
                      </>
                    ) : feedbackStatus.statusLevel === 'keep_going' ? (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-600 stroke-[2.5]" />
                        <span className="text-amber-900 font-extrabold">
                          {feedbackStatus.statusLabel}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-rose-600 stroke-[2.5]" />
                        <span className="text-rose-900 font-extrabold">
                          {feedbackStatus.statusLabel}
                        </span>
                      </>
                    )}
                  </div>
                  {question.type !== 'open_ended' && (
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-800">
                      +{pointsEarned} / {getQuestionMaxPoints(question)} pts
                    </span>
                  )}
                </div>

                {question.type === 'close_ended' &&
                  closeEndedAnalysis &&
                  !isAnswerCorrect &&
                  closeEndedAnalysis.tokens.length > 0 && (
                    <div className="pt-2 border-t border-black/5 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Word-by-Word Check
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-white/90 border border-slate-200/80">
                        {closeEndedAnalysis.tokens.map((tok, tIdx) => (
                          <span
                            key={`modal-diff-${tIdx}`}
                            className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold border ${
                              tok.status === 'correct'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : tok.status === 'misplaced'
                                ? 'bg-sky-100 text-sky-900 border-sky-300'
                                : tok.status === 'missing'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-rose-100 text-rose-900 border-rose-300'
                            }`}
                          >
                            {tok.text}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-slate-600 font-medium">
                        <span>Green: Correct</span>
                        <span>· Red: Incorrect</span>
                        <span>· Blue: Wrong location</span>
                        <span>· *: Missing word</span>
                      </div>
                    </div>
                  )}

                {directionalExplanation && directionalExplanation.trim() && (
                  <div className="pt-2 border-t border-black/5 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Teacher Explanation
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                      {directionalExplanation}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Key Box displayed below the Correct / Needs Review box */}
          {canShowKey && question.type === 'close_ended' && (
            <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-400 text-xs text-emerald-950 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Key: <strong className="font-mono text-sm underline decoration-emerald-500 font-bold">{question.correctAnswer}</strong>
                </span>
              </div>
              {!isAnswerCorrect && (
                <span className="text-[11px] text-rose-800 font-mono bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                  You typed: "{textInput.trim()}"
                </span>
              )}
            </div>
          )}

          {canShowKey && question.type === 'matching' && question.matchingPairs && (
            <div className="p-3 bg-emerald-50 border-2 border-emerald-400 rounded-xl text-xs space-y-1.5 text-emerald-950">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                <span>Key (Matching Pairs):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {question.matchingPairs.map((p) => (
                  <div key={p.left} className="p-2 rounded bg-white border border-emerald-200">
                    <span className="font-bold text-slate-900">{p.left}</span>
                    <span className="text-emerald-700 mx-1.5">➔</span>
                    <span className="text-slate-700">{p.right}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canShowKey && question.type === 'drag_and_drop' && question.categories && (
            <div className="p-3 bg-emerald-50 border-2 border-emerald-400 rounded-xl text-xs space-y-2 text-emerald-950">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                <span>Key (Category Breakdown):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {question.categories.map((cat) => (
                  <div key={cat.id} className="p-2 bg-white rounded border border-emerald-200">
                    <div className="font-bold text-emerald-950 text-[11px] mb-1">{cat.name}</div>
                    <div className="flex flex-wrap gap-1">
                      {cat.items.map((it, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-semibold"
                        >
                          {it}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {canShowFeedback && (
              <span className="text-sm font-bold font-mono">
                {question.type === 'open_ended'
                  ? 'Reflection submitted (Ungraded)'
                  : `Score: ${pointsEarned} / ${getQuestionMaxPoints(question)} pts`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!hasSubmitted ? (
              <button
                type="button"
                disabled={!isFormValid() || isGradingAi}
                onClick={handleSubmit}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs tracking-wide bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
              >
                Submit Response
              </button>
            ) : (
              <button
                type="button"
                onClick={onContinue}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs tracking-wide bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm cursor-pointer"
              >
                <span>Continue Listening</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
