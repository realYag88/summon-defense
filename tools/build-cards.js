// 怪談じゃんけん(DotRoguelikeCardBattle)の index.html からカードと手アイコンを抜き出して
// data/cards.js を作る。カードを増やすときは PAIRS に [進化前, 進化後] を足して実行する。
//
//   node tools/build-cards.js ../DotRoguelikeCardBattle/index.html
//
const fs = require("fs");
const path = require("path");
const SRC = process.argv[2];
if (!SRC) { console.error("usage: node tools/build-cards.js <DotRoguelikeCardBattle/index.html>"); process.exit(1); }
const OUT = path.join(__dirname, "..", "data", "cards.js");
const t = fs.readFileSync(SRC, "utf8");
const POOL = JSON.parse(t.match(/const POOL=(\[.*?\]);/s)[1]);
const ICON = eval("(" + t.match(/const ICON=(\{.*?\});/s)[1] + ")");

// 旧コスト(0〜3)を 1〜8 に変換：旧コスト×2 + (同じ旧コストの中でパワーが平均より上なら2、それ以外は1)
// 旧コスト3は7、極レアだけ8
const mean = {};
for (const c of [0, 1, 2]) {
  const ps = POOL.filter(x => x.c === c).map(x => x.p);
  mean[c] = ps.reduce((a, b) => a + b, 0) / ps.length;
}
const newCost = x => x.c === 3 ? (x.q === "極" ? 8 : 7) : x.c * 2 + (x.p > mean[x.c] ? 2 : 1);

// 確定進化のペア。1組目は各種族の基本、2組目で各種族のカードを増やしている
const PAIRS = [
  // 1組目
  ["スライミー", "メガスライミー"],
  ["新米ウォリアー", "新米バトラー"],
  ["ウィッチ", "熟練の魔導士"],
  ["バナモンガー", "バナモンキ"],
  ["コホエル", "ギガホエル"],
  ["天門の守護者", "天門の大守護者"],
  ["プチウィンド", "ウィンドミラー"],
  ["グール", "墓荒らしのグール"],
  ["マイマイ", "長老マイマイ"],
  ["ゴブリンソード", "ゴブリンブラザーズ"],
  // 2組目
  ["ボックストン", "ギガゴーレム"],
  ["剣士ウィスカ", "剣聖ジュガルズ"],
  ["キメラタートル", "キメラタートルシニア"],
  ["ベナゴン", "メベナゴン"],
  ["子クラーケン", "クラーケンシニア"],
  ["エンゼ", "エンジェルソルジャー"],
  ["ドラゴンジュニア", "神龍"],
  ["スカルソード", "スカルパラディン"],
  ["エルフの弓使い", "エルフスナイパー"],
  ["ゴブリンメイジ", "ゴブリンシャーマン"],
];

const CARDS = [];
for (const [a, b] of PAIRS) {
  for (const n of [a, b]) {
    const x = POOL.find(c => c.n === n);
    if (!x) throw new Error("カードが見つかりません: " + n);
    CARDS.push({ n: x.n, r: x.r, h: x.h, p: x.p, c: newCost(x), e: x.e, q: x.q, w: x.w, ht: x.ht, img: x.img, base: n === a });
  }
}
CARDS.forEach((c, i) => { c.id = i; c.evo = c.base ? i + 1 : null; });

const js = "// tools/build-cards.js で生成。手で編集しないこと\n" +
  "window.CARDS=" + JSON.stringify(CARDS) + ";\n" +
  "window.ICON=" + JSON.stringify(ICON) + ";\n";
fs.writeFileSync(OUT, js);
console.log(CARDS.map(c => `${c.base ? "  " : "→ "}${c.n} ${c.r} ${c.h} P${c.p} C${c.c} ${c.e}`).join("\n"));
console.log(`${CARDS.length}枚 → ${path.relative(process.cwd(), OUT)} (${(js.length / 1024).toFixed(0)}KB)`);
