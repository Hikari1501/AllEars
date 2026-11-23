import { SavedVocabItem, VocabEntry } from '../types';

const getStorageKey = (userId?: string) =>
  `allears_personal_vocab_${(userId || 'student-guest').trim() || 'student-guest'}`;

export const PERSONAL_VOCAB_EVENT = 'allears-personal-vocab-updated';

export function getSavedVocabList(userId?: string): SavedVocabItem[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isVocabSaved(userId: string | undefined, word: string): boolean {
  const target = (word || '').trim().toLowerCase();
  if (!target) return false;
  return getSavedVocabList(userId).some((item) => item.word.trim().toLowerCase() === target);
}

export function toggleSaveVocabWord(
  userId: string | undefined,
  vocab: VocabEntry,
  lessonMeta?: { id?: string; title?: string }
): { saved: boolean; list: SavedVocabItem[] } {
  const current = getSavedVocabList(userId);
  const key = vocab.word.trim().toLowerCase();
  const exists = current.some((item) => item.word.trim().toLowerCase() === key);

  let next: SavedVocabItem[];
  let saved: boolean;
  if (exists) {
    next = current.filter((item) => item.word.trim().toLowerCase() !== key);
    saved = false;
  } else {
    const entry: SavedVocabItem = {
      ...vocab,
      savedAt: Date.now(),
      lessonId: lessonMeta?.id,
      lessonTitle: lessonMeta?.title,
    };
    next = [entry, ...current];
    saved = true;
  }

  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(PERSONAL_VOCAB_EVENT, { detail: { userId } }));
  } catch (e) {
    console.warn('Could not save personal vocabulary list:', e);
  }

  return { saved, list: next };
}

export function removeSavedVocabWord(userId: string | undefined, word: string): SavedVocabItem[] {
  const current = getSavedVocabList(userId);
  const key = word.trim().toLowerCase();
  const next = current.filter((item) => item.word.trim().toLowerCase() !== key);
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(PERSONAL_VOCAB_EVENT, { detail: { userId } }));
  } catch (e) {
    console.warn('Could not update personal vocabulary list:', e);
  }
  return next;
}
