import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';

export interface MatchingPairItem {
  left: string;
  right: string;
}

interface MatchingPairsCanvasProps {
  questionId: string;
  pairs: MatchingPairItem[];
  currentSelections: Record<string, string>; // left -> right
  onPairMatch: (left: string, right: string) => void;
  disabled?: boolean;
  isFeedbackVisible?: boolean;
}

const PAIR_PALETTE = [
  { name: 'blue', stroke: '#2563EB', bg: 'bg-blue-50/90', border: 'border-blue-400', text: 'text-blue-950', ring: 'ring-blue-400/40' },
  { name: 'emerald', stroke: '#059669', bg: 'bg-emerald-50/90', border: 'border-emerald-400', text: 'text-emerald-950', ring: 'ring-emerald-400/40' },
  { name: 'amber', stroke: '#D97706', bg: 'bg-amber-50/90', border: 'border-amber-400', text: 'text-amber-950', ring: 'ring-amber-400/40' },
  { name: 'purple', stroke: '#7C3AED', bg: 'bg-purple-50/90', border: 'border-purple-400', text: 'text-purple-950', ring: 'ring-purple-400/40' },
  { name: 'rose', stroke: '#E11D48', bg: 'bg-rose-50/90', border: 'border-rose-400', text: 'text-rose-950', ring: 'ring-rose-400/40' },
  { name: 'cyan', stroke: '#0891B2', bg: 'bg-cyan-50/90', border: 'border-cyan-400', text: 'text-cyan-950', ring: 'ring-cyan-400/40' },
  { name: 'indigo', stroke: '#4F46E5', bg: 'bg-indigo-50/90', border: 'border-indigo-400', text: 'text-indigo-950', ring: 'ring-indigo-400/40' },
];

export const MatchingPairsCanvas: React.FC<MatchingPairsCanvasProps> = ({
  questionId,
  pairs,
  currentSelections,
  onPairMatch,
  disabled = false,
  isFeedbackVisible = false,
}) => {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftDotRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const rightDotRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const [connectionLines, setConnectionLines] = useState<
    { id: string; x1: number; y1: number; x2: number; y2: number; color: string; isCorrect?: boolean }[]
  >([]);

  // Deterministically shuffle the right options based on questionId and pairs content
  // so students have to read and match rather than matching row-by-row
  const shuffledRightItems = useMemo(() => {
    const rawRight = pairs.map((p) => p.right);
    let hash = 0;
    const seed = `${questionId}-${pairs.length}`;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }

    const result = [...rawRight];
    for (let i = result.length - 1; i > 0; i--) {
      hash = (hash * 9301 + 49297) % 233280;
      const j = Math.floor((Math.abs(hash) / 233280) * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    // Ensure it's not accidentally in the identical row-by-row order when there are multiple items
    if (result.length > 1 && result.every((val, idx) => val === rawRight[idx])) {
      result.push(result.shift()!);
    }

    return result;
  }, [questionId, pairs]);

  // Recalculate SVG line coordinates connecting dots between matched pairs
  const updateLines = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: typeof connectionLines = [];

    pairs.forEach((p, pIdx) => {
      const matchedRight = currentSelections[p.left];
      if (!matchedRight) return;

      const leftDot = leftDotRefs.current[p.left];
      const rightDot = rightDotRefs.current[matchedRight];

      if (leftDot && rightDot) {
        const leftRect = leftDot.getBoundingClientRect();
        const rightRect = rightDot.getBoundingClientRect();

        const x1 = leftRect.left + leftRect.width / 2 - containerRect.left;
        const y1 = leftRect.top + leftRect.height / 2 - containerRect.top;
        const x2 = rightRect.left + rightRect.width / 2 - containerRect.left;
        const y2 = rightRect.top + rightRect.height / 2 - containerRect.top;

        const palette = PAIR_PALETTE[pIdx % PAIR_PALETTE.length];
        const isCorrect = isFeedbackVisible ? matchedRight === p.right : undefined;
        const strokeColor = isFeedbackVisible
          ? isCorrect
            ? '#059669' // emerald-600
            : '#E11D48' // rose-600
          : palette.stroke;

        newLines.push({
          id: `${p.left}-${matchedRight}`,
          x1,
          y1,
          x2,
          y2,
          color: strokeColor,
          isCorrect,
        });
      }
    });

    setConnectionLines(newLines);
  };

  useLayoutEffect(() => {
    updateLines();
    const timer = setTimeout(updateLines, 50);
    return () => clearTimeout(timer);
  }, [currentSelections, pairs, shuffledRightItems, isFeedbackVisible]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      updateLines();
    });
    observer.observe(containerRef.current);
    window.addEventListener('resize', updateLines);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateLines);
    };
  }, [currentSelections]);

  const handleLeftClick = (leftText: string) => {
    if (disabled) return;
    if (selectedLeft === leftText) {
      setSelectedLeft(null);
    } else {
      setSelectedLeft(leftText);
    }
  };

  const handleRightClick = (rightText: string) => {
    if (disabled) return;
    if (selectedLeft) {
      onPairMatch(selectedLeft, rightText);
      setSelectedLeft(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-1">
        <span>
          {selectedLeft ? (
            <span className="text-amber-800 font-bold animate-pulse">
              ➔ Click a match on the right for "{selectedLeft}"
            </span>
          ) : (
            'Click an item on the left, then click its match on the right:'
          )}
        </span>
        {Object.keys(currentSelections).length > 0 && !disabled && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-400 font-mono">
              {Object.keys(currentSelections).length}/{pairs.length} connected
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedLeft(null);
                Object.keys(currentSelections).forEach((leftKey) => {
                  onPairMatch(leftKey, '');
                });
              }}
              className="text-[10px] text-slate-500 hover:text-rose-600 font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset all lines"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Matching Grid with SVG Connection Overlay */}
      <div ref={containerRef} className="relative p-2 sm:p-3 bg-slate-50/70 border border-slate-200 rounded-2xl select-none">
        {/* SVG Curved Connection Lines Layer */}
        <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-10">
          <defs>
            <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.25" />
            </filter>
          </defs>
          {connectionLines.map((line) => {
            const dx = Math.max(30, Math.abs(line.x2 - line.x1) * 0.45);
            const pathD = `M ${line.x1} ${line.y1} C ${line.x1 + dx} ${line.y1}, ${line.x2 - dx} ${line.y2}, ${line.x2} ${line.y2}`;

            return (
              <g key={line.id} filter="url(#line-glow)">
                <path
                  d={pathD}
                  stroke={line.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  fill="none"
                  className="transition-all duration-200"
                />
                <circle cx={line.x1} cy={line.y1} r={4.5} fill={line.color} stroke="#ffffff" strokeWidth={1.5} />
                <circle cx={line.x2} cy={line.y2} r={4.5} fill={line.color} stroke="#ffffff" strokeWidth={1.5} />
              </g>
            );
          })}
        </svg>

        {/* Columns Grid */}
        <div className="grid grid-cols-2 gap-6 sm:gap-10 relative z-20">
          {/* Left Column: Items */}
          <div className="space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1">
              Terms & Prompts
            </div>
            {pairs.map((p, pIdx) => {
              const pairedRight = currentSelections[p.left];
              const isSelected = selectedLeft === p.left;
              const palette = PAIR_PALETTE[pIdx % PAIR_PALETTE.length];
              const isCorrect = isFeedbackVisible && pairedRight ? pairedRight === p.right : undefined;

              return (
                <div
                  key={p.left}
                  onClick={() => handleLeftClick(p.left)}
                  className={`w-full min-h-[46px] p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-all ${
                    disabled ? 'cursor-default' : 'cursor-pointer hover:shadow-xs'
                  } ${
                    isSelected
                      ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-400 text-amber-950 shadow-xs'
                      : pairedRight
                      ? isFeedbackVisible
                        ? isCorrect
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                          : 'bg-rose-50 border-rose-400 text-rose-950'
                        : `${palette.bg} ${palette.border} ${palette.text} shadow-2xs`
                      : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <span className="leading-snug break-words flex-1 text-left">{p.left}</span>

                  {/* Connector Anchor Dot */}
                  <span
                    ref={(el) => {
                      leftDotRefs.current[p.left] = el;
                    }}
                    className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-transform ${
                      isSelected
                        ? 'bg-amber-500 border-white scale-125 shadow-xs'
                        : pairedRight
                        ? isFeedbackVisible
                          ? isCorrect
                            ? 'bg-emerald-600 border-white'
                            : 'bg-rose-600 border-white'
                          : 'bg-slate-900 border-white'
                        : 'bg-slate-200 border-white'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Right Column: Shuffled Target Matches */}
          <div className="space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1">
              Definitions & Matches
            </div>
            {shuffledRightItems.map((rightText) => {
              // Find which left item connects to this rightText
              const linkedLeft = Object.keys(currentSelections).find(
                (k) => currentSelections[k] === rightText
              );
              const linkedPairIdx = linkedLeft ? pairs.findIndex((p) => p.left === linkedLeft) : -1;
              const palette = linkedPairIdx >= 0 ? PAIR_PALETTE[linkedPairIdx % PAIR_PALETTE.length] : null;
              const isCorrect = isFeedbackVisible && linkedLeft
                ? pairs.find((p) => p.left === linkedLeft)?.right === rightText
                : undefined;

              return (
                <div
                  key={rightText}
                  onClick={() => handleRightClick(rightText)}
                  className={`w-full min-h-[46px] p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                    disabled
                      ? 'cursor-default'
                      : selectedLeft
                      ? 'cursor-pointer hover:border-amber-400 hover:bg-amber-50/50'
                      : 'cursor-pointer hover:border-slate-300'
                  } ${
                    linkedLeft
                      ? isFeedbackVisible
                        ? isCorrect
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                          : 'bg-rose-50 border-rose-400 text-rose-950'
                        : palette
                        ? `${palette.bg} ${palette.border} ${palette.text} shadow-2xs`
                        : 'bg-slate-100 border-slate-300 text-slate-900'
                      : selectedLeft
                      ? 'bg-white border-amber-200/90 text-slate-800'
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  {/* Connector Anchor Dot */}
                  <span
                    ref={(el) => {
                      rightDotRefs.current[rightText] = el;
                    }}
                    className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-transform ${
                      linkedLeft
                        ? isFeedbackVisible
                          ? isCorrect
                            ? 'bg-emerald-600 border-white'
                            : 'bg-rose-600 border-white'
                          : 'bg-slate-900 border-white'
                        : 'bg-slate-200 border-white'
                    }`}
                  />

                  <span className="leading-snug break-words flex-1 text-left">{rightText}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
