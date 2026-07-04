// アプリ全体で使うデータの形。ここが「契約（invariants）」。
// 将来データ層を localStorage から API/DB に替えても、この型は変えない方針。

// アイディアは「完了」しない。タスクじゃないので、成長メタファーで表す。
export type Stage = 'seed' | 'sprout' | 'tree';

export const STAGES: { value: Stage; label: string; emoji: string }[] = [
  { value: 'seed', label: 'ひらめき', emoji: '🌱' },
  { value: 'sprout', label: '温め中', emoji: '🌿' },
  { value: 'tree', label: '育ってきた', emoji: '🌳' },
];

// ワクワク度。優先度ではなく「ときめき」。
export type Excitement = 1 | 2 | 3;

// 1つのアイディア。馬鹿げてるほどよい。
export interface Idea {
  id: string;
  title: string; // 一言タイトル
  body: string; // 妄想の中身（Markdown OK）
  tags: string[]; // 自由タグ（「AI」「社会」など）
  excitement: Excitement; // ⚡1〜3
  stage: Stage;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number; // ゴミ箱に入れた時刻。未設定＝通常表示
}
