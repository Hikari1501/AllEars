import React, { useState, useMemo } from 'react';
import { DragDropCategory } from '../types';
import {
  GripVertical,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Layers,
  Check,
  X,
  HelpCircle,
} from 'lucide-react';

interface DragAndDropCanvasProps {
  questionId: string;
  categories: DragDropCategory[];
  currentPlacements: Record<string, string[]>; // categoryId -> array of item strings
  onPlacementsChange: (placements: Record<string, string[]>) => void;
  onSubmit: (placements: Record<string, string[]>) => void;
  disabled?: boolean;
  isAnswered: boolean;
  isFeedbackVisible: boolean;
  pointsEarned?: number;
  totalPoints?: number;
}

export const DragAndDropCanvas: React.FC<DragAndDropCanvasProps> = ({
  questionId,
  categories,
  currentPlacements,
  onPlacementsChange,
  onSubmit,
  disabled = false,
  isAnswered,
  isFeedbackVisible,
  pointsEarned = 0,
  totalPoints = 10,
}) => {
  // Currently dragged item text
  const [draggedItem, setDraggedItem] = useState<{ text: string; fromCatId: string | null } | null>(null);
  // Category currently hovered over during drag
  const [hoveredCatId, setHoveredCatId] = useState<string | null>(null);
  // Currently selected item for click-to-move accessibility
  const [selectedItem, setSelectedItem] = useState<{ text: string; fromCatId: string | null } | null>(null);

  // Collect all unique items and shuffle them in a fixed randomized order per questionId
  const allItems = useMemo(() => {
    const list: string[] = [];
    categories.forEach((cat) => {
      (cat.items || []).forEach((item) => {
        if (item.trim() && !list.includes(item.trim())) {
          list.push(item.trim());
        }
      });
    });

    // Deterministic pseudo-random shuffle based on questionId so it stays stable across re-renders
    const seed = questionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const shuffled = [...list];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (seed * (i + 1) * 31) % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [questionId, categories]);

  // Set of all items currently placed in any category
  const placedItemsSet = useMemo(() => {
    const set = new Set<string>();
    Object.values(currentPlacements).forEach((items) => {
      items.forEach((it) => set.add(it.trim().toLowerCase()));
    });
    return set;
  }, [currentPlacements]);

  // Items remaining in the available tray
  const unassignedItems = useMemo(() => {
    return allItems.filter((item) => !placedItemsSet.has(item.toLowerCase()));
  }, [allItems, placedItemsSet]);

  const totalItemCount = allItems.length;
  const placedItemCount = placedItemsSet.size;

  // Move an item to a target category (or back to unassigned tray if targetCatId is null)
  const moveItem = (itemText: string, targetCatId: string | null) => {
    if (disabled) return;

    const cleanText = itemText.trim();
    const updated: Record<string, string[]> = {};

    // Remove from any current category
    categories.forEach((cat) => {
      const existing = currentPlacements[cat.id] || [];
      updated[cat.id] = existing.filter(
        (it) => it.trim().toLowerCase() !== cleanText.toLowerCase()
      );
    });

    // Add to target category if specified
    if (targetCatId) {
      if (!updated[targetCatId]) updated[targetCatId] = [];
      if (!updated[targetCatId].some((it) => it.trim().toLowerCase() === cleanText.toLowerCase())) {
        updated[targetCatId].push(cleanText);
      }
    }

    onPlacementsChange(updated);
    setSelectedItem(null);
    setDraggedItem(null);
    setHoveredCatId(null);
  };

  const handleReset = () => {
    if (disabled) return;
    const cleared: Record<string, string[]> = {};
    categories.forEach((cat) => {
      cleared[cat.id] = [];
    });
    onPlacementsChange(cleared);
    setSelectedItem(null);
  };

  // Drag event handlers
  const handleDragStart = (e: React.DragEvent, text: string, fromCatId: string | null) => {
    if (disabled) return;
    setDraggedItem({ text, fromCatId });
    e.dataTransfer.setData('text/plain', text);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, catId: string) => {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (hoveredCatId !== catId) {
      setHoveredCatId(catId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, catId: string) => {
    if (hoveredCatId === catId) {
      setHoveredCatId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, catId: string) => {
    if (disabled) return;
    e.preventDefault();
    const text = e.dataTransfer.getData('text/plain') || draggedItem?.text;
    if (text) {
      moveItem(text, catId);
    }
    setHoveredCatId(null);
    setDraggedItem(null);
  };

  const handleDropTray = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    const text = e.dataTransfer.getData('text/plain') || draggedItem?.text;
    if (text) {
      moveItem(text, null);
    }
    setHoveredCatId(null);
    setDraggedItem(null);
  };

  // Map to find the correct expected category for each item
  const itemToExpectedCategoryMap = useMemo(() => {
    const map = new Map<string, DragDropCategory>();
    categories.forEach((cat) => {
      (cat.items || []).forEach((it) => {
        map.set(it.trim().toLowerCase(), cat);
      });
    });
    return map;
  }, [categories]);

  return (
    <div className="space-y-4">
      {/* 1. UNASSIGNED ITEMS TRAY (Outside the table in randomized order) */}
      <div
        onDragOver={(e) => {
          if (!disabled) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={handleDropTray}
        className={`p-3.5 rounded-xl border-2 transition-all ${
          unassignedItems.length > 0
            ? 'bg-amber-50/60 border-amber-200 shadow-2xs'
            : 'bg-slate-50 border-dashed border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            <span>Available Items Tray ({unassignedItems.length} unassigned)</span>
          </div>
          {!disabled && placedItemCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              title="Return all items to available tray"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All</span>
            </button>
          )}
        </div>

        {unassignedItems.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {unassignedItems.map((itemText) => {
              const isSelected = selectedItem?.text === itemText;
              return (
                <div
                  key={itemText}
                  draggable={!disabled}
                  onDragStart={(e) => handleDragStart(e, itemText, null)}
                  onClick={() => {
                    if (disabled) return;
                    setSelectedItem(isSelected ? null : { text: itemText, fromCatId: null });
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none transition-all cursor-grab active:cursor-grabbing border ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-400 shadow-sm scale-105'
                      : 'bg-white hover:bg-amber-100 text-slate-800 border-amber-200 hover:border-amber-300 shadow-2xs'
                  }`}
                  title="Drag this item into a category below, or click to select then click a category"
                >
                  <GripVertical className="w-3.5 h-3.5 text-amber-600 shrink-0 opacity-70" />
                  <span>{itemText}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-2 text-xs text-slate-500 flex items-center justify-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>All items have been categorized into the table below!</span>
          </div>
        )}

        {selectedItem && (
          <div className="mt-2.5 p-2 bg-amber-100/80 border border-amber-300 rounded-lg text-[11px] text-amber-950 font-medium flex items-center justify-between gap-2 animate-in fade-in duration-150">
            <span>
              Selected: <strong className="font-bold">"{selectedItem.text}"</strong>. Now click on any category below to place it!
            </span>
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* 2. CATEGORIES TABLE & DROP ZONES */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <span>Categories Table (Drop Zones)</span>
          <span className="font-mono text-slate-600">
            {placedItemCount} of {totalItemCount} Items Placed
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {categories.map((cat) => {
            const placedList = currentPlacements[cat.id] || [];
            const isHovered = hoveredCatId === cat.id;

            return (
              <div
                key={cat.id}
                onDragOver={(e) => handleDragOver(e, cat.id)}
                onDragLeave={(e) => handleDragLeave(e, cat.id)}
                onDrop={(e) => handleDrop(e, cat.id)}
                onClick={() => {
                  if (selectedItem) {
                    moveItem(selectedItem.text, cat.id);
                  }
                }}
                className={`rounded-xl border-2 flex flex-col min-h-[140px] transition-all overflow-hidden ${
                  isHovered
                    ? 'border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-400/40 shadow-md'
                    : selectedItem
                    ? 'border-dashed border-indigo-300 bg-white hover:bg-indigo-50/40 cursor-pointer'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {/* Category Header */}
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 text-xs truncate" title={cat.name}>
                    {cat.name}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                    {placedList.length} items
                  </span>
                </div>

                {/* Drop Zone Area */}
                <div className="p-2.5 flex-1 flex flex-col justify-between space-y-2">
                  <div className="flex flex-wrap gap-1.5 items-start content-start min-h-[50px]">
                    {placedList.map((itemText) => {
                      const expectedCat = itemToExpectedCategoryMap.get(itemText.trim().toLowerCase());
                      const isItemCorrect = expectedCat?.id === cat.id;

                      let chipStyle = 'bg-indigo-50/90 text-indigo-950 border-indigo-200 hover:border-indigo-300';
                      if (isFeedbackVisible) {
                        if (isItemCorrect) {
                          chipStyle = 'bg-emerald-50 text-emerald-950 border-emerald-400 font-semibold ring-1 ring-emerald-300';
                        } else {
                          chipStyle = 'bg-rose-50 text-rose-950 border-rose-400 font-medium';
                        }
                      }

                      return (
                        <div
                          key={itemText}
                          draggable={!disabled}
                          onDragStart={(e) => handleDragStart(e, itemText, cat.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (disabled) return;
                            setSelectedItem(
                              selectedItem?.text === itemText
                                ? null
                                : { text: itemText, fromCatId: cat.id }
                            );
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border select-none transition-all shadow-2xs ${chipStyle} ${
                            disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                          }`}
                        >
                          <GripVertical className="w-3 h-3 opacity-50 shrink-0" />
                          <span>{itemText}</span>

                          {/* Correct/Incorrect indicator on feedback */}
                          {isFeedbackVisible ? (
                            isItemCorrect ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3] shrink-0" />
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 font-bold">
                                <X className="w-3.5 h-3.5 text-rose-600 stroke-[3] shrink-0" />
                                {expectedCat && (
                                  <span className="font-normal opacity-80">➔ {expectedCat.name}</span>
                                )}
                              </span>
                            )
                          ) : (
                            !disabled && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveItem(itemText, null);
                                }}
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                                title="Remove and return to tray"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )
                          )}
                        </div>
                      );
                    })}

                    {placedList.length === 0 && (
                      <div className="w-full py-4 text-center text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                        Drop items here
                      </div>
                    )}
                  </div>

                  {/* Drop hint when item is selected */}
                  {selectedItem && (
                    <div className="text-[10px] text-indigo-600 font-semibold text-center py-1 bg-indigo-50/50 rounded border border-indigo-100">
                      Click to place "{selectedItem.text}" here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. SUBMIT ACTION & FEEDBACK REPORT */}
      {!isFeedbackVisible && (!isAnswered || !disabled) && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500">
            {placedItemCount < totalItemCount ? (
              <span>
                Place remaining <strong className="text-amber-800">{totalItemCount - placedItemCount} items</strong> or submit now.
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                Ready to submit categorization!
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={disabled || placedItemCount === 0}
            onClick={() => onSubmit(currentPlacements)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs disabled:cursor-not-allowed"
          >
            {isAnswered ? 'Update Categorization' : 'Submit Categorization'}
          </button>
        </div>
      )}

      {/* 4. FEEDBACK SUMMARY CARD */}
      {isFeedbackVisible && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-400 text-xs text-emerald-950 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="font-bold flex items-center gap-1.5 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Categorization Results</span>
            </div>
            <div className="px-2.5 py-0.5 rounded-full font-bold font-mono text-emerald-900 bg-emerald-100 border border-emerald-300">
              Score: +{pointsEarned} / {totalPoints} pts
            </div>
          </div>

          <div className="text-[11px] text-slate-700 leading-relaxed">
            Points are awarded for each item placed into its correct category. Review the highlighted boxes above for expected placements.
          </div>
        </div>
      )}
    </div>
  );
};
