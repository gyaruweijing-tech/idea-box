'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Idea, Excitement, Stage, STAGES } from '@/lib/types';
import { loadIdeas, saveIdeas, migrate, newId, now } from '@/lib/storage';
import { seedIdeas } from '@/lib/seed';

// ============================================================
//  Idea Box — 妄想の宝箱
//  タスクじゃない。いつかやるかもしれないアイディアを放り込む。
// ============================================================

const CARD_COLORS = 5; // globals.css の .c0〜.c4 と対応

function stageInfo(stage: Stage) {
  return STAGES.find((s) => s.value === stage) ?? STAGES[0];
}

function bolts(n: Excitement): string {
  return '⚡'.repeat(n);
}

function fmtDate(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// id からカード色を安定して決める（並べ替えても色が変わらない）
function colorIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % CARD_COLORS;
}

export default function Page() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 表示状態
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  // 編集モーダル（null = 閉、'new' = 新規、それ以外 = 対象 id）
  const [editingId, setEditingId] = useState<string | null>(null);
  // 発掘モーダルに出ているアイディアの id
  const [digId, setDigId] = useState<string | null>(null);

  const quickRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Escape でモーダルを閉じる
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setEditingId(null);
        setDigId(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- 読み込み・保存 ----------

  useEffect(() => {
    const stored = loadIdeas();
    setIdeas(stored ?? seedIdeas());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveIdeas(ideas);
  }, [ideas, loaded]);

  // ---------- 更新ヘルパ ----------

  function patchIdea(id: string, patch: Partial<Idea>) {
    setIdeas((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: now() } : i))
    );
  }

  function addIdea(title: string): string {
    const t = now();
    const idea: Idea = {
      id: newId(),
      title,
      body: '',
      tags: [],
      excitement: 2,
      stage: 'seed',
      createdAt: t,
      updatedAt: t,
    };
    setIdeas((prev) => [idea, ...prev]);
    return idea.id;
  }

  function quickAdd() {
    const title = quickRef.current?.value.trim();
    if (!title) return;
    quickRef.current!.value = '';
    addIdea(title);
  }

  // ---------- 発掘 ----------

  function dig() {
    const alive = ideas.filter((i) => !i.deletedAt);
    if (alive.length === 0) return;
    // いま表示中のものは避ける（2件以上あるとき）
    const pool =
      alive.length > 1 ? alive.filter((i) => i.id !== digId) : alive;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setDigId(pick.id);
  }

  // ---------- 書き出し / 読み込み ----------

  function exportJson() {
    const blob = new Blob([JSON.stringify(ideas, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `idea-box-${fmtDate(now()).replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data)) throw new Error();
        const imported = data
          .map(migrate)
          .filter((x): x is Idea => x !== null);
        setIdeas((prev) => {
          const known = new Set(prev.map((i) => i.id));
          return [...imported.filter((i) => !known.has(i.id)), ...prev];
        });
      } catch {
        alert('読み込めませんでした。Idea Box の書き出しファイルを選んでください。');
      }
    };
    reader.readAsText(file);
  }

  // ---------- 表示リスト ----------

  const allTags = useMemo(() => {
    const set = new Set<string>();
    ideas.filter((i) => !i.deletedAt).forEach((i) => i.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [ideas]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ideas
      .filter((i) => (showTrash ? !!i.deletedAt : !i.deletedAt))
      .filter((i) => !tagFilter || i.tags.includes(tagFilter))
      .filter(
        (i) =>
          !q ||
          i.title.toLowerCase().includes(q) ||
          i.body.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [ideas, query, tagFilter, showTrash]);

  const editing = ideas.find((i) => i.id === editingId) ?? null;
  const digging = ideas.find((i) => i.id === digId) ?? null;
  const trashCount = ideas.filter((i) => i.deletedAt).length;

  if (!loaded) return null;

  return (
    <main className="container">
      <header className="header">
        <h1>💡 Idea Box</h1>
        <span className="tagline">
          タスクじゃない。いつかやるかもしれない妄想の宝箱。
        </span>
      </header>

      {/* クイック追加 */}
      <div className="quick-add">
        <input
          ref={quickRef}
          type="text"
          placeholder="思いついた瞬間に放り込む（例：月面カフェの内装を考える）"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) quickAdd();
          }}
        />
        <button className="btn primary" onClick={quickAdd}>
          ＋ 放り込む
        </button>
      </div>

      {/* ツールバー */}
      <div className="toolbar">
        <button className="btn dig" onClick={dig}>
          ✨ 発掘する
        </button>
        <button className="btn ghost" onClick={exportJson}>
          書き出し
        </button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>
          読み込み
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importJson(f);
            e.target.value = '';
          }}
        />
        <button
          className={`btn ghost`}
          onClick={() => setShowTrash((v) => !v)}
        >
          {showTrash ? '← 一覧に戻る' : `🗑 ゴミ箱 (${trashCount})`}
        </button>
      </div>

      {/* フィルタ */}
      <div className="filters">
        <input
          type="search"
          placeholder="🔍 検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {allTags.map((t) => (
          <button
            key={t}
            className={`chip ${tagFilter === t ? 'on' : ''}`}
            onClick={() => setTagFilter(tagFilter === t ? null : t)}
          >
            #{t}
          </button>
        ))}
      </div>

      {/* カード一覧 */}
      {visible.length === 0 ? (
        <div className="empty">
          {showTrash
            ? 'ゴミ箱は空です。'
            : 'まだ何もありません。上の入力欄から、どんな馬鹿げたことでも放り込んでみてください 🌱'}
        </div>
      ) : (
        <div className="grid">
          {visible.map((i) => {
            const st = stageInfo(i.stage);
            return (
              <button
                key={i.id}
                className={`card c${colorIndex(i.id)}`}
                onClick={() => setEditingId(i.id)}
              >
                <p className="card-title">{i.title}</p>
                {i.body && <div className="card-body">{i.body}</div>}
                <div className="card-meta">
                  <span title={st.label}>
                    {st.emoji} {st.label}
                  </span>
                  <span>{bolts(i.excitement)}</span>
                  {i.tags.map((t) => (
                    <span key={t} className="tag">
                      #{t}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 編集モーダル */}
      {editing && (
        <EditModal
          idea={editing}
          inTrash={!!editing.deletedAt}
          onPatch={(patch) => patchIdea(editing.id, patch)}
          onTrash={() => {
            patchIdea(editing.id, { deletedAt: now() });
            setEditingId(null);
          }}
          onRestore={() => {
            setIdeas((prev) =>
              prev.map((i) =>
                i.id === editing.id ? { ...i, deletedAt: undefined } : i
              )
            );
            setEditingId(null);
          }}
          onDeleteForever={() => {
            if (!confirm('完全に削除します。元に戻せません。よろしいですか？'))
              return;
            setIdeas((prev) => prev.filter((i) => i.id !== editing.id));
            setEditingId(null);
          }}
          onClose={() => setEditingId(null)}
        />
      )}

      {/* 発掘モーダル */}
      {digging && (
        <div className="overlay" onClick={() => setDigId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>✨ 発掘しました</h2>
            <div className={`dig-card c${colorIndex(digging.id)} card`}>
              <p className="card-title">{digging.title}</p>
              {digging.body && (
                <div className="md">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {digging.body}
                  </ReactMarkdown>
                </div>
              )}
              <div className="card-meta">
                <span>
                  {stageInfo(digging.stage).emoji} {stageInfo(digging.stage).label}
                </span>
                <span>{bolts(digging.excitement)}</span>
                {digging.tags.map((t) => (
                  <span key={t} className="tag">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
            <p className="muted">
              {fmtDate(digging.createdAt)} に埋めたアイディアです。育てますか？
            </p>
            <div className="modal-actions">
              <button className="btn dig" onClick={dig}>
                ✨ もう一回掘る
              </button>
              <div className="right">
                <button
                  className="btn primary"
                  onClick={() => {
                    setEditingId(digging.id);
                    setDigId(null);
                  }}
                >
                  開いて育てる
                </button>
                <button className="btn ghost" onClick={() => setDigId(null)}>
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ============================================================
//  編集モーダル
// ============================================================

function EditModal({
  idea,
  inTrash,
  onPatch,
  onTrash,
  onRestore,
  onDeleteForever,
  onClose,
}: {
  idea: Idea;
  inTrash: boolean;
  onPatch: (patch: Partial<Idea>) => void;
  onTrash: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
  onClose: () => void;
}) {
  const [tagsText, setTagsText] = useState(idea.tags.join(', '));

  function commitTags(text: string) {
    setTagsText(text);
    const tags = text
      .split(/[,、\s]+/)
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);
    onPatch({ tags: Array.from(new Set(tags)) });
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div>
          <label className="field-label">タイトル</label>
          <input
            type="text"
            value={idea.title}
            onChange={(e) => onPatch({ title: e.target.value })}
          />
        </div>

        <div>
          <label className="field-label">妄想の中身（Markdown OK・自動保存）</label>
          <textarea
            value={idea.body}
            placeholder="なんで面白いと思ったのか、どうなったら最高か、自由に。"
            onChange={(e) => onPatch({ body: e.target.value })}
          />
        </div>

        <div>
          <label className="field-label">タグ（カンマ・スペース区切り）</label>
          <input
            type="text"
            value={tagsText}
            placeholder="AI, 発明, 社会"
            onChange={(e) => commitTags(e.target.value)}
          />
        </div>

        <div>
          <label className="field-label">育ち具合</label>
          <div className="seg">
            {STAGES.map((s) => (
              <button
                key={s.value}
                className={`chip ${idea.stage === s.value ? 'on' : ''}`}
                onClick={() => onPatch({ stage: s.value })}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label">ワクワク度</label>
          <div className="seg">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                className={`chip ${idea.excitement === n ? 'on' : ''}`}
                onClick={() => onPatch({ excitement: n })}
              >
                {'⚡'.repeat(n)}
              </button>
            ))}
          </div>
        </div>

        <p className="muted">
          {fmtDate(idea.createdAt)} 生まれ ／ 最終更新 {fmtDate(idea.updatedAt)}
        </p>

        <div className="modal-actions">
          {inTrash ? (
            <>
              <button className="btn" onClick={onRestore}>
                ↩ 元に戻す
              </button>
              <div className="right">
                <button className="btn danger" onClick={onDeleteForever}>
                  完全に削除
                </button>
                <button className="btn ghost" onClick={onClose}>
                  閉じる
                </button>
              </div>
            </>
          ) : (
            <>
              <button className="btn danger" onClick={onTrash}>
                🗑 ゴミ箱へ
              </button>
              <div className="right">
                <button className="btn primary" onClick={onClose}>
                  閉じる（保存済み）
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
