import { Idea } from './types';

// ============================================================
//  データ層（今は localStorage 実装）
//  ★改良ポイント：将来 Vercel + DB にするときは、この関数の
//    "中身だけ" を API 呼び出しに差し替えればよい。呼び出し側
//    (app/page.tsx) はこのインターフェースにだけ依存している。
// ============================================================

const KEY = 'ideabox.ideas.v1'; // ★キーは変えない（既存データを失わないため）

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function now(): number {
  return Date.now();
}

// 保存データの形が壊れていても落ちないように、1件ずつ正規化する。
export function migrate(raw: any): Idea | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = typeof raw.updatedAt === 'number' ? raw.updatedAt : now();
  const created = typeof raw.createdAt === 'number' ? raw.createdAt : t;
  const excitement = [1, 2, 3].includes(raw.excitement) ? raw.excitement : 2;
  const stage = ['seed', 'sprout', 'tree'].includes(raw.stage)
    ? raw.stage
    : 'seed';
  return {
    id: String(raw.id ?? newId()),
    title: String(raw.title ?? '(無題のひらめき)'),
    body: String(raw.body ?? ''),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    excitement,
    stage,
    createdAt: created,
    updatedAt: t,
    ...(typeof raw.deletedAt === 'number' ? { deletedAt: raw.deletedAt } : {}),
  };
}

export function loadIdeas(): Idea[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return null;
    return data.map(migrate).filter((x): x is Idea => x !== null);
  } catch {
    return null;
  }
}

export function saveIdeas(ideas: Idea[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ideas));
  } catch {
    // 容量オーバー等。今は握りつぶす（アイディアは短文中心なのでまず起きない）
  }
}
