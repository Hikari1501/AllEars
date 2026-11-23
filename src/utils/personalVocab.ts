import { SavedVocabItem, VocabEntry } from '../types';

const getStorageKey = (userId?: string) =>
  `allears_personal_vocab_${(userId || 'student-guest').trim() || 'student-guest'}`;

export const PERSONAL_VOCAB_EVENT = 'allears-personal-vocab-updated';

const shouldUseServer = (userId?: string): userId is string => {
  const clean = (userId || '').trim();
  return Boolean(clean && clean !== 'student-guest' && !clean.startsWith('stu-'));
};

const writeCacheAndNotify = (userId: string | undefined, items: SavedVocabItem[]) => {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(PERSONAL_VOCAB_EVENT, { detail: { userId } }));
  } catch (e) {
    console.warn('Could not update personal vocabulary cache:', e);
  }
};

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

export async function fetchSavedVocabFromServer(userId?: string): Promise<SavedVocabItem[]> {
  const cached = getSavedVocabList(userId);
  if (!shouldUseServer(userId)) {
    return cached;
  }

  try {
    const hasSyncedKey = `allears_vocab_db_synced_${userId}`;
    const alreadySynced = sessionStorage.getItem(hasSyncedKey) === '1';

    let res: Response;
    if (!alreadySynced && cached.length > 0) {
      res = await fetch(`/api/student-vocab/${encodeURIComponent(userId)}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cached }),
      });
    } else {
      res = await fetch(`/api/student-vocab/${encodeURIComponent(userId)}`);
    }

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        sessionStorage.setItem(hasSyncedKey, '1');
        writeCacheAndNotify(userId, data.items);
        return data.items;
      }
    }
  } catch (e) {
    console.warn('Could not sync saved vocabulary with database:', e);
  }

  return cached;
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
  let newEntry: SavedVocabItem | null = null;

  if (exists) {
    next = current.filter((item) => item.word.trim().toLowerCase() !== key);
    saved = false;
  } else {
    newEntry = {
      ...vocab,
      savedAt: Date.now(),
      lessonId: lessonMeta?.id,
      lessonTitle: lessonMeta?.title,
    };
    next = [newEntry, ...current];
    saved = true;
  }

  writeCacheAndNotify(userId, next);

  if (shouldUseServer(userId)) {
    const syncRequest = exists
      ? fetch(`/api/student-vocab/${encodeURIComponent(userId)}/${encodeURIComponent(vocab.word.trim())}`, {
          method: 'DELETE',
        })
      : fetch(`/api/student-vocab/${encodeURIComponent(userId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: newEntry }),
        });

    syncRequest
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.items)) {
          writeCacheAndNotify(userId, data.items);
        }
      })
      .catch((e) => {
        console.warn('Could not persist vocabulary change to database:', e);
      });
  }

  return { saved, list: next };
}

export function removeSavedVocabWord(userId: string | undefined, word: string): SavedVocabItem[] {
  const current = getSavedVocabList(userId);
  const key = word.trim().toLowerCase();
  const next = current.filter((item) => item.word.trim().toLowerCase() !== key);
  writeCacheAndNotify(userId, next);

  if (shouldUseServer(userId) && word.trim()) {
    fetch(`/api/student-vocab/${encodeURIComponent(userId)}/${encodeURIComponent(word.trim())}`, {
      method: 'DELETE',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.items)) {
          writeCacheAndNotify(userId, data.items);
        }
      })
      .catch((e) => {
        console.warn('Could not delete vocabulary word from database:', e);
      });
  }

  return next;
}
