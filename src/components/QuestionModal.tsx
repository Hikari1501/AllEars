import React, { useState, useEffect } from 'react';
import { Question, StudentAnswer } from '../types';
import { MatchingPairsCanvas } from './MatchingPairsCanvas';
import { playSuccessChime } from '../utils/soundEffects';
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

    let correct = false;
    let earned = 0;
    let finalAnswer: any = null;

    if (question.type === 'multiple_choice') {
      if (isMultiSelect) {
        finalAnswer = Array.from(selectedOptions);
        const expected = question.correctAnswers || [question.correctAnswer || 'a'];
        // Check if sets match strictly (no points if wrong option selected or any missed)
        const matchesAll =
          expected.length === selectedOptions.size &&
          expected.every((id) => selectedOptions.has(id));
        correct = matchesAll;
        earned = correct ? question.points : 0;
      } else {
        finalAnswer = selectedOption;
        correct = selectedOption === question.correctAnswer;
        earned = correct ? question.points : 0;
      }
    } else if (question.type === 'true_false') {
      finalAnswer = selectedOption;
      correct = selectedOption === question.correctAnswer;
      earned = correct ? question.points : 0;
    } else if (question.type === 'close_ended') {
      finalAnswer = textInput.trim();
      const expected = (question.correctAnswer || '').trim().toLowerCase();
      correct = finalAnswer.toLowerCase() === expected;
      earned = correct ? question.points : 0;
    } else if (question.type === 'matching') {
      finalAnswer = matchingSelections;
      if (question.matchingPairs) {
        let matchCount = 0;
        question.matchingPairs.forEach((pair) => {
          if (matchingSelections[pair.left] === pair.right) {
            matchCount++;
          }
        });
        correct = matchCount === question.matchingPairs.length;
        // Award points for each line matched right
        earned = Math.round((matchCount / question.matchingPairs.length) * question.points);
      }
    } else if (question.type === 'open_ended') {
      finalAnswer = textInput.trim();
      setIsGradingAi(true);
      try {
        const response = await fetch('/api/ai/grade-open-ended', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionPrompt: question.prompt,
            studentAnswer: finalAnswer,
          }),
        });
        const data = await response.json();
        if (data.success && data.result) {
          earned = 0; // Open-ended questions do not award points
          correct = data.result.isPassing;
          setAiFeedback(data.result.feedback);
        } else {
          earned = 0;
          correct = true;
          setAiFeedback('Thoughtful response! You captured the essential listening cues.');
        }
      } catch (err) {
        earned = 0;
        correct = true;
        setAiFeedback('Good job expressing your thoughts clearly based on the audio.');
      } finally {
        setIsGradingAi(false);
      }
    }

    // Play a short sound on students' device whenever they get all correct answers for a question
    if (correct && question.type !== 'open_ended') {
      playSuccessChime();
    }

    setIsAnswerCorrect(correct);
    setPointsEarned(earned);
    setHasSubmitted(true);

    const submission: StudentAnswer = {
      questionId: question.id,
      answer: finalAnswer,
      isCorrect: correct,
      pointsEarned: earned,
      aiFeedback: aiFeedback || undefined,
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
    return false;
  };

  const canShowFeedback = hasSubmitted && isFeedbackRevealed;

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

  const getFormattedCorrectAnswer = () => {
    if (question.type === 'multiple_choice' && question.options) {
      const expectedList = question.correctAnswers || (question.correctAnswer ? [question.correctAnswer] : []);
      const matched = question.options.filter(
        (o) => expectedList.includes(o.id) || expectedList.includes(o.text)
      );
      if (matched.length > 0) {
        return matched.map((m) => `Option ${m.id.toUpperCase()}: "${m.text}"`).join(' and ');
      }
      return `Option ${(question.correctAnswer || 'A').toUpperCase()}`;
    }
    if (question.type === 'true_false') {
      return String(question.correctAnswer || 'true').toUpperCase();
    }
    if (question.type === 'close_ended') {
      return `"${question.correctAnswer || ''}"`;
    }
    if (question.type === 'matching' && question.matchingPairs) {
      return question.matchingPairs.map((p) => `${p.left} ➔ ${p.right}`).join(' | ');
    }
    return question.correctAnswer || 'Model response';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Formative Checkpoint · {question.points} Points
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

                if (canShowFeedback) {
                  if (isCorrect) {
                    stateClass = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-medium';
                  } else if (isSelected && !isCorrect) {
                    stateClass = 'border-rose-400 bg-rose-50 text-rose-950';
                  } else {
                    stateClass = 'opacity-50 border-slate-200 text-slate-500';
                  }
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
                    {canShowFeedback && isCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    {canShowFeedback && isSelected && !isCorrect && (
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
              {canShowFeedback && (
                <div className={`p-3 rounded-lg text-sm border ${isAnswerCorrect ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'}`}>
                  <div className="font-semibold mb-0.5">
                    {isAnswerCorrect ? 'Exact Match!' : 'Not quite right'}
                  </div>
                  <div>Expected answer: <span className="font-mono font-bold">{question.correctAnswer}</span></div>
                </div>
              )}
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

              {canShowFeedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs space-y-1.5 text-emerald-950">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Correct Matching Pairs:</span>
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

              {isGradingAi && (
                <div className="flex items-center gap-2 text-xs text-amber-700 animate-pulse bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Evaluating your listening comprehension and language with AI feedback...</span>
                </div>
              )}

              {canShowFeedback && aiFeedback && (
                <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-sm space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-900 text-xs uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Teacher / AI Formative Feedback</span>
                  </div>
                  <p className="text-slate-800 leading-relaxed">{aiFeedback}</p>
                </div>
              )}
            </div>
          )}

          {/* Feedback & Explanation section once feedback is active */}
          {canShowFeedback && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              {/* Prominent Correct Answer Card */}
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs space-y-1">
                <div className="font-bold text-emerald-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Correct Answer:</span>
                </div>
                <div className="text-sm font-bold text-emerald-950 leading-relaxed">
                  {getFormattedCorrectAnswer()}
                </div>
              </div>

              {question.explanation && (
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Teacher Explanation
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{question.explanation}</p>
                </div>
              )}
            </div>
          )}

          {/* Live mode submitted waiting state */}
          {hasSubmitted && !isFeedbackRevealed && isLiveMode && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center space-y-1">
              <div className="text-sm font-semibold text-amber-950">Response Submitted!</div>
              <p className="text-xs text-amber-800">
                Your teacher will review responses and reveal class feedback shortly.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {canShowFeedback && (
              <span className="text-sm font-bold font-mono">
                Score: {pointsEarned} / {question.points} pts
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
