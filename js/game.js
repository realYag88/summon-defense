"use strict";
// カードと手アイコンは data/cards.js(tools/build-cards.js で生成)から読む
const CARDS=window.CARDS,ICON=window.ICON;
const TABLE_W=1000,TABLE_H=2106,CANDLES=[[.737,.085],[.895,.415]]; // 机の絵の中のろうそくの位置(割合)

// ---- 調整値 ----
const T={
  gaugeRate:.4,      // ゲージ/秒
  enemySpd:.4,       // マス/秒(道が短くなったぶん遅く)
  hpBase:8,hpPow:4,hpGrow:.22,   // 敵HP = (hpBase+パワー*hpPow)*(1+hpGrow*(ウェーブ-1))
  count0:6,countPer:1.5,           // 敵の数 = count0 + ウェーブ*countPer(切り捨て)
  dura0:6,duraCost:3,              // 耐久 = dura0 + コスト*duraCost (攻撃1回で消耗1×種族係数)
  waveWear:.3,
  // ↑ waveWear: ウェーブが終わるたびに、場のキャラの耐久が最大値のこの割合だけ減る
  evoDura:1.5,                     // 合体で進化したキャラの耐久倍率
  xp0:8,xpPer:4,                   // 次のレベルまでの経験値 = xp0 + 今のレベル*xpPer
  eliteFrom:6,eliteRate:.15,eliteHp:2.5, // このウェーブから強い個体(光る敵)が混ざる
};
// 召喚士のスキル(スキルにも手がある)
const SKILL={
  "石":{n:"落石",cd:[9,7.5,6],dmg:[16,24,34],r:[.9,.95,1],desc:lv=>`狙った場所の敵1体に${SKILL["石"].dmg[lv-1]}ダメージ`},
  "鋏":{n:"かまいたち",cd:[12,10,8],dmg:[8,11,15],len:[2.6,3.6,4.6],desc:lv=>`道に沿って${SKILL["鋏"].len[lv-1]}マス、触れた敵すべてに${SKILL["鋏"].dmg[lv-1]}ダメージ`},
  "紙":{n:"お札",cd:[16,14,12],dmg:[3,5,7],r:[1.2,1.4,1.6],stun:[2.5,3,3.5],desc:lv=>`半径${SKILL["紙"].r[lv-1]}マスの敵を${SKILL["紙"].stun[lv-1]}秒止めて${SKILL["紙"].dmg[lv-1]}ダメージ`},
};
const PERK={
  gauge:{g:"速",t:"ゲージ加速",d:"ゲージの溜まる速さ+15%"},
  hand:{g:"手",t:"手札拡張",d:"手札の上限+1。1枚引く"},
  dura:{g:"耐",t:"頑丈",d:"これから召喚するキャラの耐久+20%"},
  life:{g:"命",t:"結界修復",d:"拠点ライフ+5"},
  tribe:{g:"",t:"",d:""},
};
const RUN_TRIBES=5;               // 1回のプレイで使う種族の数
const COLS=6,ROWS=9,MAXG=10,HANDMAX=6,HANDMIN=3,WAVES=8,LIFE0=20;
// S字の道(マス中心の座標で折れ点を並べる)
// 地図1(村はずれ)：上の石畳から入り、池と墓地を避けて下へ抜ける
const PATH=[[2.5,.08],[2.5,2.5],[1.5,2.5],[1.5,3.5],[4.5,3.5],[4.5,4.5],[2.5,4.5],[2.5,9.25]];
const TRIBE={
  "人間族":{role:"支援",desc:"上下左右の味方の攻撃力+1。射程1.6",iv:1.0,wear:1,range:1.6,shot:"slash",spd:1.0},
  "魔導族":{role:"範囲",desc:"着弾点のまわりにもダメージ。攻撃は遅め。射程2.0",iv:1.7,wear:1,range:2.0,shot:"orb",spd:.9},
  "獣族":{role:"連射",desc:"攻撃が速いが射程が短い(隣接のみ)",iv:.5,wear:.5,range:1.5,shot:"claw",spd:1.3},
  "海洋族":{role:"減速",desc:"当たった敵を遅くする。射程1.8",iv:1.1,wear:1,range:1.8,shot:"bubble",spd:1.0},
  "物質族":{role:"壁",desc:"道の上にも置けて敵を足止めする。耐久が高い",iv:1.3,wear:.5,range:1.3,shot:"pellet",spd:.7,hpMul:2.2,road:true},
  "天界族":{role:"回復",desc:"2秒ごとに周りの味方の耐久を回復する。射程1.6",iv:1.2,wear:1,range:1.6,shot:"holy",spd:1.0,heal:true},
  "ドラゴン族":{role:"貫通",desc:"ブレスが道に沿って後ろの敵にも届く。射程1.8",iv:1.5,wear:1,range:1.8,shot:"breath",spd:.85},
  "不死族":{role:"墓地",desc:"墓地のカード3枚ごとに攻撃力+1(最大+5)。射程1.6",iv:1.1,wear:1,range:1.6,shot:"bone",spd:.8},
  "植物族":{role:"毒",desc:"当たった敵に3秒間の毒。射程1.7",iv:1.0,wear:1,range:1.7,shot:"thorn",spd:.9},
  "ゴブリン族":{role:"数",desc:"場の他のゴブリン1体につき攻撃力+1。射程1.5",iv:.9,wear:1,range:1.5,shot:"axe",spd:1.15},
};
const EFF={"なし":"なし","追加2点":"攻撃のたびに+2ダメージ","ライフ+3":"召喚時 拠点ライフ+3","1枚引く":"召喚時 1枚引く","2枚引く":"召喚時 2枚引く",
  "鼓舞":"支援の効果が2倍(+2)","墓地から1枚":"召喚時 墓地からランダムに1枚を手札へ","山札から同族1枚":"召喚時 山札から同じ種族を1枚手札へ","墓地のパワー+2":"墓地にカードがある間 攻撃力+2","コストを1減らす":"次に出すカードのコスト-1","消耗が遅い":"攻撃による消耗が半分","破棄時 ライフ+2":"墓地に行くとき 拠点ライフ+2"};
const BEATS={"石":"鋏","鋏":"紙","紙":"石"};
const mult=(a,b)=>BEATS[a]===b?2:BEATS[b]===a?.5:1;

const $=s=>document.querySelector(s);
const board=$("#board"),tilesEl=$("#tiles"),ents=$("#ents"),handEl=$("#hand"),info=$("#info"),overlay=$("#overlay"),rangeEl=$("#range");
const rnd=n=>Math.floor(Math.random()*n);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
let UID=1;
const inst=id=>({uid:UID++,id,bonus:0});
const C=i=>CARDS[i.id];
const pw=i=>C(i).p+(i.bonus||0);
const key=(c,r)=>c+","+r;
const HELP="カードを盤面へドラッグ(またはタップで選んでからマスをタップ)して召喚。同じ種族に重ねると進化。手札同士でも重ねられます。";

/* ---------- 道 ---------- */
const SEG=[];let PLEN=0;
for(let k=0;k<PATH.length-1;k++){const [x1,y1]=PATH[k],[x2,y2]=PATH[k+1];const l=Math.hypot(x2-x1,y2-y1);SEG.push({x1,y1,x2,y2,l,s:PLEN});PLEN+=l;}
function posAt(d){
  for(const g of SEG){if(d<=g.s+g.l){const t=(d-g.s)/g.l;return {x:g.x1+(g.x2-g.x1)*t,y:g.y1+(g.y2-g.y1)*t,dx:Math.sign(g.x2-g.x1)};}}
  const g=SEG[SEG.length-1];return {x:g.x2,y:g.y2,dx:0};
}
const ROAD=new Map(); // key -> 道のりでの位置
for(let d=0;d<=PLEN;d+=.05){const p=posAt(d);const c=Math.floor(p.x),r=Math.floor(p.y);
  if(c>=0&&c<COLS&&r>=0&&r<ROWS&&!ROAD.has(key(c,r))&&Math.abs(p.x-(c+.5))<.06&&Math.abs(p.y-(r+.5))<.06)ROAD.set(key(c,r),d);}
const isRoad=(c,r)=>ROAD.has(key(c,r));

function figRatio(card,boost=1){
  const hTarget=(.62+.07*card.c)*boost, wMax=1.3*boost;
  const h=Math.min(hTarget,wMax*card.ht/card.w);
  return {w:h*card.w/card.ht,h};
}

let S,cellPx=56,tiles=[],drag=null;
function newState(){
  return {phase:"title",life:LIFE0,gauge:5,wave:0,deck:[],hand:[],grave:[],units:new Map(),enemies:[],shots:[],
    queue:[],spawnT:0,disc:0,speed:1,paused:false,sel:null,kills:0,evos:0,
    tribes:[],ubfT:0,xp:0,lv:1,pendLv:0,skills:{"石":{lv:1,cd:0}},aim:null,perk:{gauge:1,handMax:HANDMAX,dura:1,tribe:{}}};
}

/* ---------- 盤面 ---------- */
function buildTiles(){
  tilesEl.innerHTML="";tiles=[];
  for(let r=0;r<ROWS;r++){tiles[r]=[];for(let c=0;c<COLS;c++){
    const t=document.createElement("div");t.className="tile"+(isRoad(c,r)?" road":(c+r)%2?" alt":"");tilesEl.appendChild(t);tiles[r][c]=t;}}
  drawRoad();
  const s=PATH[0],g=PATH[PATH.length-1];
  $("#startMark").style.left=`calc(var(--cell)*${Math.floor(s[0])})`;
  $("#goalMark").style.cssText=`left:calc(var(--cell)*${Math.floor(g[0])});top:calc(var(--cell)*${ROWS} - 4px)`;
}
function drawRoad(){
  const pts=[[PATH[0][0],-.6],...PATH.slice(1,-1),[PATH[PATH.length-1][0],9.6]].map(p=>p.join(",")).join(" ");
  $("#roadSvg").innerHTML=`<defs><filter id="rough" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale=".16"/></filter></defs>
    <g filter="url(#rough)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="${pts}" stroke="rgba(70,46,20,.55)" stroke-width=".74"/>
      <polyline points="${pts}" stroke="rgba(176,142,92,.88)" stroke-width=".62"/>
      <polyline points="${pts}" stroke="rgba(120,90,52,.4)" stroke-width=".34" stroke-dasharray=".06 .2"/>
    </g>`;
}
function placeCandles(){
  // 机の絵(contain配置)の中でのろうそくの位置を画面座標に直す
  const vw=innerWidth,vh=innerHeight,k=Math.min(vw/TABLE_W,vh/TABLE_H),w=TABLE_W*k,h=TABLE_H*k,ox=(vw-w)/2,oy=(vh-h)/2;
  CANDLES.forEach(([cx,cy],i)=>{const x=ox+cx*w,y=oy+cy*h;const f=$("#fl"+(i+1));f.style.left=x+"px";f.style.top=y+"px";
    document.documentElement.style.setProperty(`--c${i+1}x`,x+"px");document.documentElement.style.setProperty(`--c${i+1}y`,y+"px");});
}
function fit(){
  placeCandles();
  const st=$("#stage").getBoundingClientRect();
  cellPx=Math.max(34,Math.floor(Math.min(st.width/COLS,st.height/ROWS)));
  board.style.setProperty("--cell",cellPx+"px");
  const hw=handEl.getBoundingClientRect().width;
  const cw=Math.max(52,Math.min(90,Math.floor((hw-5*5)/6)));
  document.documentElement.style.setProperty("--cwh",cw+"px");
  for(const e of S.enemies)placeEnemy(e);
}

/* ---------- カード ---------- */
function costOf(i){return Math.max(0,C(i).c-S.disc)}
function cardHTML(i,cls=""){
  const c=C(i),t=TRIBE[c.r];
  const s=Math.min(.68/c.ht,.86/c.w);
  const cost=costOf(i),dis=cost<c.c?`<s>${c.c}</s>`:"";
  return `<div class="card q${c.q} ${cls}" data-uid="${i.uid}">
    <div class="art"><img class="sp" src="${c.img}" alt="" style="width:calc(var(--cw)*${(c.w*s).toFixed(4)});height:calc(var(--cw)*${(c.ht*s).toFixed(4)})">
      <span class="cost">${dis}${cost}</span><img class="hd" src="${ICON[c.h]}" alt="${c.h}"><span class="pw">${pw(i)}</span></div>
    <div class="info"><div class="rc">${c.r}・${t.role}</div><div class="nm" style="font-size:calc(var(--cw)*${Math.min(.15,.9/c.n.length).toFixed(3)})">${c.n}</div></div></div>`;
}
function cardInfo(i,extra=""){
  const c=C(i),t=TRIBE[c.r];
  const evo=c.evo!=null?` / 同じカードを重ねると<span class="k">${CARDS[c.evo].n}</span>に進化`:"";
  return `<b>${c.n}</b>${i.bonus?`<span class="k">+${i.bonus}</span>`:""}${i.evolved?`<span class="k">(進化体・耐久1.5倍)</span>`:""}　${c.r}・${t.role}：${t.desc}<br>手 ${c.h}　パワー ${pw(i)}　コスト ${c.c}　効果：${EFF[c.e]||c.e}${evo}${extra}`;
}
function renderHand(){
  handEl.innerHTML=S.hand.map(i=>cardHTML(i,(S.sel===i.uid?"sel ":"")+(costOf(i)>S.gauge?"poor":""))).join("");
  if(drag){const el=handEl.querySelector(`.card[data-uid="${drag.uid}"]`);if(!el){cancelDrag();}else{drag.el=el;if(drag.moved){el.classList.add("lifted");showHL(drag.uid);}}}
  $("#deckN").textContent=S.deck.length;$("#graveN").textContent=S.grave.length;
}
let lastG=-1;
function renderHud(){
  $("#wave").textContent=`WAVE ${S.wave}/${WAVES}`;
  $("#life b").textContent=Math.max(0,Math.ceil(S.life));
  $("#gfill").style.width=(S.gauge/MAXG*100)+"%";
  const g=Math.floor(S.gauge);
  if(g!==lastG){lastG=g;$("#gnum").innerHTML=`${g}<small>/10</small>`;
    handEl.querySelectorAll(".card").forEach(e=>{const i=S.hand.find(h=>h.uid==e.dataset.uid);if(i)e.classList.toggle("poor",costOf(i)>S.gauge)});}
}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("on"),1500)}
function banner(msg){const b=$("#banner");b.textContent=msg;b.classList.remove("on");void b.offsetWidth;b.classList.add("on")}

function draw(n){
  for(let k=0;k<n;k++){
    if(S.hand.length>=S.perk.handMax)break;
    if(!S.deck.length){if(!S.grave.length)break;S.deck=shuffle(S.grave);S.grave=[];toast("墓地を山札に戻しました");}
    S.hand.push(S.deck.pop());
  }
}
const topUp=()=>{if(S.hand.length<HANDMIN)draw(HANDMIN-S.hand.length)};

/* ---------- ユニット ---------- */
function unitHp(card,i){return Math.round((T.dura0+card.c*T.duraCost)*(TRIBE[card.r].hpMul||1)*(i&&i.evolved?T.evoDura:1)*S.perk.dura)}
function makeUnit(i,c,r,fixedEvo){
  const card=C(i);
  const u={i,c,r,hp:unitHp(card,i),max:unitHp(card,i),cd:.3,buff:0,road:isRoad(c,r),el:document.createElement("div")};
  u.el.className=`unit q${card.q} rise`;
  u.el.style.cssText=`left:calc(var(--cell)*${c});top:calc(var(--cell)*${r});z-index:${10+r*10+5}`;
  const f=figRatio(card);
  u.el.innerHTML=`<div class="slab"><img src="${ICON[card.h]}" alt=""></div><div class="glow"></div>
    <div class="beam ${fixedEvo||card.q!=="並"?"ex":""}"></div>
    <div class="fig" style="--d:${(-Math.random()*2.6).toFixed(2)}s"><img src="${card.img}" alt="${card.n}" style="width:calc(var(--cell)*${f.w.toFixed(3)});height:calc(var(--cell)*${f.h.toFixed(3)})"></div>
    <div class="bar"><i></i></div><b class="upw">${pw(i)}</b><span class="ubf"></span>`;
  setTimeout(()=>u.el.classList.remove("rise"),1000);
  ents.appendChild(u.el);
  return u;
}
function updUnitBar(u){const i=u.el.querySelector(".bar i"),p=u.hp/u.max;i.style.width=Math.max(0,p*100)+"%";i.className=p<.3?"low":p<.6?"mid":"";}
function tribeBonus(u){
  const r=C(u.i).r;let b=S.perk.tribe[r]||0;
  if(r==="不死族")b+=Math.min(5,Math.floor(S.grave.length/3));
  if(r==="ゴブリン族"){for(const x of S.units.values())if(x!==u&&C(x.i).r==="ゴブリン族")b++;}
  if(C(u.i).e==="墓地のパワー+2"&&S.grave.length)b+=2;
  return b;
}
function refreshUbf(){for(const u of S.units.values()){const v=u.buff+tribeBonus(u);u.el.querySelector(".ubf").textContent=v?"+"+v:"";}}
function recalcBuffs(){
  for(const u of S.units.values())u.buff=0;
  for(const u of S.units.values()){
    const card=C(u.i);if(card.r!=="人間族")continue;
    const v=1+(card.e==="鼓舞"?1:0);
    for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=S.units.get(key(u.c+dc,u.r+dr));if(n)n.buff+=v;}
  }
  refreshUbf();
}
function onSummon(card,x,y){
  if(card.e==="1枚引く")draw(1);
  if(card.e==="2枚引く")draw(2);
  if(card.e==="ライフ+3"){S.life=Math.min(30,S.life+3);fxNum(x,y,"ライフ+3","heal");}
  if(card.e==="コストを1減らす"){S.disc+=1;toast("次に出すカードのコスト-1");}
  if(card.e==="墓地から1枚"&&S.grave.length&&S.hand.length<S.perk.handMax){const g=S.grave.splice(rnd(S.grave.length),1)[0];S.hand.push(g);toast(`墓地から${C(g).n}を手札へ`);}
  if(card.e==="山札から同族1枚"&&S.hand.length<S.perk.handMax){const k=S.deck.findIndex(x=>C(x).r===card.r);if(k>=0){const g=S.deck.splice(k,1)[0];S.hand.push(g);toast(`山札から${C(g).n}を手札へ`);}}
}
function destroyUnit(u){
  S.units.delete(key(u.c,u.r));
  u.el.style.transition="opacity .3s";u.el.style.opacity="0";setTimeout(()=>u.el.remove(),320);
  if(C(u.i).e==="破棄時 ライフ+2"){S.life=Math.min(30,S.life+2);fxNum(u.c+.5,u.r+.3,"ライフ+2","heal");}
  S.grave.push(u.i);
  recalcBuffs();topUp();renderHand();
}
function wearUnit(u,d){
  u.hp-=d;updUnitBar(u);
  if(u.hp<=0)destroyUnit(u);
}

/* ---------- 召喚と合体 ---------- */
function evolveTarget(a,b){ // a=重ねられる側, b=重ねる側(どちらもカードのインスタンス)
  const A=C(a),B=C(b);
  if(A.id===B.id&&A.evo!=null)return {id:A.evo,fixed:true};          // 同じカード → 確定進化
  const top=Math.max(A.c,B.c);
  const cand=CARDS.filter(x=>x.r===A.r&&x.c>top);
  if(cand.length)return {id:cand[rnd(cand.length)].id,fixed:false}; // 同族の上位からランダム
  return {power:true,keep:A.c>=B.c?a:b};                             // 上がない → 強化
}
function evolveLabel(ev){return ev.power?"強化 +2":ev.fixed?"進化！":"進化？"}
function evolveNote(ev){return ev.power?"　<span class='k'>(進化先がないので強化)</span>":ev.fixed?"　<span class='k'>(確定進化)</span>":"　<span class='k'>(ランダム進化)</span>"}
function resolveEvo(a,b){
  const ev=evolveTarget(a,b);let ni;
  if(ev.power){ni=ev.keep;ni.bonus=(ni.bonus||0)+2;S.grave.push(ni===a?b:a);}
  else{ni=inst(ev.id);ni.evolved=true;S.grave.push(b);S.evos++;}
  return {ev,ni};
}
function placeCheck(i,c,r){
  const card=C(i),u=S.units.get(key(c,r));
  if(u)return C(u.i).r===card.r?"merge":"重ねられるのは同じ種族のキャラだけです";
  if(isRoad(c,r)&&!TRIBE[card.r].road)return "道の上に置けるのは物質族だけです";
  return "ok";
}
function tryPlay(uid,c,r){
  const hi=S.hand.findIndex(h=>h.uid===uid);if(hi<0)return false;
  const i=S.hand[hi],card=C(i),cost=costOf(i);
  const chk=placeCheck(i,c,r);
  if(chk!=="ok"&&chk!=="merge"){toast(chk);return false;}
  if(cost>S.gauge){toast(`ゲージが足りません(あと${(cost-S.gauge).toFixed(1)})`);return false;}
  S.gauge-=cost;S.disc=0;S.hand.splice(hi,1);S.sel=null;
  if(chk==="ok"){
    const nu=makeUnit(i,c,r,false);S.units.set(key(c,r),nu);
    recalcBuffs();onSummon(card,c+.5,r+.2);info.innerHTML=cardInfo(i);
  }else{
    const u=S.units.get(key(c,r));
    const {ev,ni}=resolveEvo(u.i,i);
    u.el.remove();S.units.delete(key(c,r));
    const nu=makeUnit(ni,c,r,ev.fixed);S.units.set(key(c,r),nu);
    recalcBuffs();fxNum(c+.5,r+.1,evolveLabel(ev),"big");
    if(!ev.power)onSummon(C(ni),c+.5,r+.2);
    info.innerHTML=cardInfo(ni,evolveNote(ev));
  }
  draw(1);topUp();clearHL();renderHand();lastG=-1;renderHud();
  return true;
}
// 手札同士の合体(ゲージは使わない。手札は1枚減る)
function handMerge(srcUid,dstUid){
  const a=S.hand.find(h=>h.uid===dstUid),b=S.hand.find(h=>h.uid===srcUid);
  if(!a||!b||a===b)return false;
  if(C(a).r!==C(b).r){toast("重ねられるのは同じ種族のカードだけです");return false;}
  const {ev,ni}=resolveEvo(a,b);
  const ai=S.hand.indexOf(a);S.hand[ai]=ni;S.hand.splice(S.hand.indexOf(b),1);
  S.sel=null;topUp();clearHL();renderHand();lastG=-1;renderHud();
  info.innerHTML=cardInfo(ni,evolveNote(ev));toast(`手札で${ev.power?"強化":"進化"}：${C(ni).n}`);
  const el=handEl.querySelector(`.card[data-uid="${ni.uid}"]`);
  if(el)el.animate([{filter:"brightness(3)",transform:"translateY(-10px) scale(1.08)"},{filter:"none",transform:"none"}],{duration:500,easing:"ease-out"});
  return true;
}

/* ---------- 敵 ---------- */
function makeEnemy(id,boss,elite){
  const card=CARDS[id],w=S.wave;
  const hp=Math.round((T.hpBase+card.p*T.hpPow)*(1+T.hpGrow*(w-1))*(boss?5:1)*(elite?T.eliteHp:1));
  const e={card,d:0,x:0,y:0,face:1,hp,max:hp,spd:T.enemySpd*TRIBE[card.r].spd*(boss?.7:1),slow:0,stun:0,atk:.6,boss,elite,el:document.createElement("div")};
  const f=figRatio(card,boss?1.35:elite?1.05:.92);
  e.el.className="enemy"+(boss?" boss":"")+(elite?" elite":"");
  e.el.style.setProperty("--h",`calc(var(--cell)*${f.h.toFixed(3)})`);
  e.el.innerHTML=`<div class="esh"></div><img class="espr" src="${card.img}" alt="${card.n}" style="width:calc(var(--cell)*${f.w.toFixed(3)});height:var(--h)">
    <div class="ebar"><i></i></div><img class="ehd" src="${ICON[card.h]}" alt="${card.h}">`;
  ents.appendChild(e.el);moveEnemy(e,0);
  S.enemies.push(e);
}
function moveEnemy(e,dd){
  e.d+=dd;const p=posAt(e.d);e.x=p.x;e.y=p.y;
  if(p.dx)e.face=p.dx; // 元の絵は右向き。左へ進むときは反転
  placeEnemy(e);
}
function placeEnemy(e){
  e.el.style.transform=`translate(${e.x*cellPx}px,${(e.y+.3)*cellPx}px)`;
  e.el.style.zIndex=10+Math.floor(e.y*10)+8;
  e.el.style.setProperty("--face",e.face);
}
function dmgEnemy(e,atk,extraMul=1){
  if(e.hp<=0)return;
  const m=mult(atk.h,e.card.h);
  const d=Math.max(1,atk.p)*m*extraMul+(atk.e==="追加2点"?2:0);
  e.hp-=d;
  e.el.querySelector(".ebar i").style.width=Math.max(0,e.hp/e.max*100)+"%";
  e.el.classList.add("hit");setTimeout(()=>e.el.classList.remove("hit"),70);
  fxNum(e.x+(Math.random()-.5)*.3,e.y-.35,(Math.round(d*10)/10)+(m===2?"!":""),m===2?"win":m<1?"lose":"");
  if(e.hp<=0){e.el.classList.add("dead");setTimeout(()=>e.el.remove(),380);S.kills++;S.gauge=Math.min(MAXG,S.gauge+.25);
    gainXp(e.boss?20:(1+e.card.c)*(e.elite?2:1));}
}
/* ---------- 経験値・レベル ---------- */
const xpNeed=()=>T.xp0+S.lv*T.xpPer;
function gainXp(n){S.xp+=n;while(S.xp>=xpNeed()){S.xp-=xpNeed();S.lv++;S.pendLv++;}renderXp();}
function renderXp(){$("#lvl").textContent="Lv "+S.lv;$("#xpbar i").style.width=Math.min(100,S.xp/xpNeed()*100)+"%";$("#xpn").textContent=`${Math.floor(S.xp)}/${xpNeed()}`;}
function lvOptions(){
  const sk=[],pk=[];
  for(const h of ["石","鋏","紙"]){const s=S.skills[h];if(!s)sk.push({type:"skill",h,lv:1});else if(s.lv<3)sk.push({type:"skill",h,lv:s.lv+1});}
  if(S.perk.gauge<1.6)pk.push({type:"perk",id:"gauge"});
  if(S.perk.handMax<8)pk.push({type:"perk",id:"hand"});
  pk.push({type:"perk",id:"dura"},{type:"perk",id:"life"});
  const tr=S.tribes;pk.push({type:"perk",id:"tribe",r:tr[rnd(tr.length)]});
  const weights=CARDS.map(c=>!S.tribes.includes(c.r)?0:c.base?3:(S.lv>=4?1:0));
  const pickCard=()=>{let t=Math.random()*weights.reduce((a,b)=>a+b,0);for(let j=0;j<CARDS.length;j++){t-=weights[j];if(t<=0)return j;}return 0};
  // 1つは必ずカード、1つはスキル(取れるものがあれば)、残りはランダム
  const opts=[{type:"card",i:inst(pickCard())}];
  if(sk.length)opts.push(sk.splice(rnd(sk.length),1)[0]);
  const rest=shuffle([...sk,...pk]);
  while(opts.length<3&&rest.length)opts.push(rest.shift());
  while(opts.length<3)opts.push({type:"card",i:inst(pickCard())});
  return shuffle(opts);
}
function optHTML(o,k){
  if(o.type==="card"){const c=C(o.i);return `<button class="opt" data-k="${k}"><span class="kind">CARD</span>${cardHTML(o.i)}<span class="dsc">${c.r}・${TRIBE[c.r].role}<br>手札に加える</span></button>`;}
  if(o.type==="skill"){const s=SKILL[o.h];return `<button class="opt" data-k="${k}"><span class="kind">SKILL・手 ${o.h}</span><span class="ico"><img src="${ICON[o.h]}" alt="${o.h}"></span><span class="ttl">${s.n} ${o.lv===1?"獲得":"Lv"+o.lv}</span><span class="dsc">${s.desc(o.lv)}。再使用まで${s.cd[o.lv-1]}秒</span></button>`;}
  const p=PERK[o.id],tb=o.id==="tribe";
  return `<button class="opt" data-k="${k}"><span class="kind">BOOST</span><span class="ico">${tb?o.r[0]:p.g}</span><span class="ttl">${tb?o.r+"強化":p.t}</span><span class="dsc">${tb?o.r+"の攻撃力+1":p.d}</span></button>`;
}
function applyOpt(o){
  if(o.type==="card"){if(S.hand.length<S.perk.handMax)S.hand.push(o.i);else{S.deck.push(o.i);toast("手札がいっぱいなので山札に入れました");}}
  else if(o.type==="skill"){const old=S.skills[o.h];S.skills[o.h]={lv:o.lv,cd:old?Math.min(old.cd,SKILL[o.h].cd[o.lv-1]):0};}
  else if(o.id==="gauge")S.perk.gauge+=.15;
  else if(o.id==="hand"){S.perk.handMax++;draw(1);}
  else if(o.id==="dura")S.perk.dura+=.2;
  else if(o.id==="life")S.life=Math.min(30,S.life+5);
  else if(o.id==="tribe")S.perk.tribe[o.r]=(S.perk.tribe[o.r]||0)+1;
}
function showLevelUp(){
  S.phase="level";S.pendLv--;
  const opts=lvOptions();
  showPanel(`<h2>LEVEL UP</h2><p>Lv ${S.lv-S.pendLv} になりました。1つ選んでください</p><div class="lvopts">${opts.map(optHTML).join("")}</div>`,()=>{
    overlay.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{applyOpt(opts[+b.dataset.k]);overlay.hidden=true;S.phase="wave";renderHand();renderSkills();renderXp();lastG=-1;renderHud();});
  });
}
/* ---------- スキル ---------- */
function renderSkills(){
  const el=$("#skills");
  if(!el.children.length)el.innerHTML=["石","鋏","紙"].map(h=>`<button class="sk" data-h="${h}" aria-label="${SKILL[h].n}"><img src="${ICON[h]}" alt=""><span class="skl"></span><span class="skn">${SKILL[h].n}</span><span class="cdm"></span></button>`).join("");
  for(const b of el.children){
    const h=b.dataset.h,s=S.skills[h];
    b.classList.toggle("locked",!s);
    if(s){b.style.setProperty("--p",(s.cd/SKILL[h].cd[s.lv-1]).toFixed(3));b.classList.toggle("ready",s.cd<=0);b.querySelector(".skl").textContent="Lv"+s.lv;}
    else{b.style.setProperty("--p",0);b.classList.remove("ready");b.querySelector(".skl").textContent="";}
    b.classList.toggle("aim",S.aim===h);
  }
}
function setAim(h){
  S.aim=h;board.classList.toggle("aiming",!!h);
  if(h){S.sel=null;clearHL();renderHand();info.innerHTML=`<b>${SKILL[h].n}</b>　手 ${h}　${SKILL[h].desc(S.skills[h].lv)}。<span class="k">道をタップして発動</span>(もう一度ボタンで取り消し)`;}
  renderSkills();
}
function nearestD(x,y){let best=1e9,bd=0;for(let d=0;d<=PLEN;d+=.05){const p=posAt(d),q=Math.hypot(p.x-x,p.y-y);if(q<best){best=q;bd=d;}}return bd;}
function castSkill(h,x,y){
  const s=S.skills[h],sd=SKILL[h],lv=s.lv,atk={p:sd.dmg[lv-1],h,e:""};
  if(h==="石"){
    let t=null,best=sd.r[lv-1];
    for(const e of S.enemies){if(e.hp<=0)continue;const d=Math.hypot(e.x-x,e.y-y);if(d<=best){best=d;t=e;}}
    const tx=t?t.x:x,ty=t?t.y:y;fx("rock",tx,ty);
    setTimeout(()=>{fx("dust",tx,ty);board.classList.remove("shake");void board.offsetWidth;board.classList.add("shake");if(t&&t.hp>0)dmgEnemy(t,atk);},300);
  }else if(h==="鋏"){
    const d0=nearestD(x,y),half=sd.len[lv-1]/2;
    for(let k=0;k<=8;k++){const dd=d0-half+half*2*k/8;if(dd<0||dd>PLEN)continue;const p=posAt(dd);setTimeout(()=>fx("gale",p.x,p.y),k*28);}
    for(const e of S.enemies){if(e.hp>0&&Math.abs(e.d-d0)<=half)dmgEnemy(e,atk);}
  }else{
    const r=sd.r[lv-1];fx("seal",x,y,`--r:${r}`);
    for(const e of S.enemies){if(e.hp>0&&Math.hypot(e.x-x,e.y-y)<=r){e.stun=Math.max(e.stun||0,sd.stun[lv-1]);dmgEnemy(e,atk);}}
  }
  s.cd=sd.cd[lv-1];setAim(null);info.innerHTML=HELP;
}

function fxNum(x,y,txt,cls){
  const d=document.createElement("div");d.className="fx";
  d.style.transform=`translate(${x*cellPx}px,${y*cellPx}px)`;d.style.zIndex=250;
  d.innerHTML=`<div class="num ${cls||""}">${txt}</div>`;
  ents.appendChild(d);setTimeout(()=>d.remove(),720);
}
function fx(cls,x,y,st=""){const d=document.createElement("div");d.className="fx";d.style.transform=`translate(${x*cellPx}px,${y*cellPx}px)`;d.style.zIndex=240;
  d.innerHTML=`<div class="${cls}" style="${st}"></div>`;ents.appendChild(d);setTimeout(()=>d.remove(),650);}

/* ---------- ウェーブ ---------- */
function startWave(n,delay=2){
  S.wave=n;S.phase="wave";S.spawnT=delay;
  const count=T.count0+Math.floor(n*T.countPer),lim=2+n;
  const pool=CARDS.filter(c=>c.c<=lim);
  S.queue=[];
  for(let k=0;k<count;k++){
    const ws=pool.map(c=>1+Math.max(0,c.c-(n/2))*.8);
    let t=Math.random()*ws.reduce((a,b)=>a+b,0),pick=pool[0];
    for(let j=0;j<pool.length;j++){t-=ws[j];if(t<=0){pick=pool[j];break;}}
    S.queue.push({id:pick.id,boss:false,elite:n>=T.eliteFrom&&Math.random()<T.eliteRate});
  }
  if(n===WAVES){const top=[...CARDS].sort((a,b)=>b.c-a.c||b.p-a.p)[0];S.queue.push({id:top.id,boss:true});}
  S.gap=Math.max(.8,2.2-n*.18);
  if(delay<=2)banner(n===WAVES?"最終WAVE":`WAVE ${n}`);
  else setTimeout(()=>{if(S.wave===n)banner(n===WAVES?"最終WAVE":`WAVE ${n}`)},1700);
  renderHud();
}
function waveCleared(){
  if(S.wave>=WAVES){end(true);return;}
  // 持ち越しすぎないよう、ウェーブの終わりに場のキャラが風化する
  for(const u of [...S.units.values()]){wearUnit(u,u.max*T.waveWear);}
  banner(`WAVE ${S.wave} 突破`);
  startWave(S.wave+1,4.5);
}

/* ---------- メインループ ---------- */
function tick(dt){
  S.gauge=Math.min(MAXG,S.gauge+T.gaugeRate*S.perk.gauge*dt);
  for(const k in S.skills){const sk=S.skills[k];if(sk.cd>0)sk.cd=Math.max(0,sk.cd-dt);}
  if(S.queue.length){S.spawnT-=dt;if(S.spawnT<=0){const q=S.queue.shift();makeEnemy(q.id,q.boss,q.elite);S.spawnT=S.gap*(.7+Math.random()*.6);}}
  for(const e of S.enemies){
    if(e.hp<=0)continue;
    if(e.slow>0)e.slow-=dt;
    e.el.classList.toggle("slow",e.slow>0);
    if(e.pT>0){e.pT-=dt;e.pAcc=(e.pAcc||0)+e.pDps*dt;e.el.classList.add("poison");
      if(e.pAcc>=1){const d=Math.floor(e.pAcc);e.pAcc-=d;dmgEnemy(e,{p:d,h:null,e:""});if(e.hp<=0)continue;}}
    else if(e.el.classList.contains("poison"))e.el.classList.remove("poison");
    if(e.stun>0){e.stun-=dt;e.el.classList.add("stun");continue;}else if(e.el.classList.contains("stun"))e.el.classList.remove("stun");
    // 道の上の壁(物質族)に当たったら止まって攻撃
    let blocker=null;
    for(const u of S.units.values()){if(!u.road)continue;const gd=ROAD.get(key(u.c,u.r))-e.d;if(gd>=-.05&&gd<=.6){blocker=u;break;}}
    if(blocker){
      e.atk-=dt;
      if(e.atk<=0){e.atk=1;const dmg=(1.5+e.card.p*.8)*mult(e.card.h,C(blocker.i).h)*(e.boss?2.5:1);
        wearUnit(blocker,dmg);blocker.el.classList.add("hit");setTimeout(()=>blocker.el.classList.remove("hit"),90);}
    }else{
      moveEnemy(e,e.spd*(e.slow>0?.5:1)*dt);
      if(e.d>=PLEN-.05){
        const dmg=e.boss?8:1+Math.floor(e.card.c/3);
        S.life-=dmg;e.hp=0;e.el.classList.add("dead");setTimeout(()=>e.el.remove(),380);
        board.classList.remove("shake");void board.offsetWidth;board.classList.add("shake");
        fxNum(e.x,ROWS-.5,"-"+dmg,"hurt");
        if(S.life<=0){end(false);return;}
      }
    }
  }
  S.enemies=S.enemies.filter(e=>e.hp>0);
  S.ubfT-=dt;if(S.ubfT<=0){S.ubfT=.5;refreshUbf();}
  for(const u of S.units.values()){
    if(!TRIBE[C(u.i).r].heal)continue;
    u.healT=(u.healT??2)-dt;if(u.healT>0)continue;u.healT=2;
    const amt=1+pw(u.i)*.3;
    for(const x of S.units.values()){if(x===u||x.hp>=x.max)continue;if(Math.hypot(x.c-u.c,x.r-u.r)>1.6)continue;
      x.hp=Math.min(x.max,x.hp+amt);updUnitBar(x);fx("healfx",x.c+.5,x.r+.5);}
  }
  for(const u of [...S.units.values()]){
    u.cd-=dt;if(u.cd>0)continue;
    const card=C(u.i),t=TRIBE[card.r],ux=u.c+.5,uy=u.r+.5;
    let target=null;
    for(const e of S.enemies){if(e.hp<=0)continue;if(Math.hypot(e.x-ux,e.y-uy)>t.range)continue;if(!target||e.d>target.d)target=e;}
    if(!target)continue;
    u.cd=t.iv;
    const atk={p:pw(u.i)+u.buff+tribeBonus(u),h:card.h,e:card.e,r:card.r};
    if(t.shot==="claw"){fx("claw",target.x,target.y);dmgEnemy(target,atk);}
    else{const s={kind:t.shot,x:ux,y:u.r+.2,target,tx:target.x,ty:target.y,atk,el:document.createElement("div")};
      s.el.className="shot "+t.shot;s.el.style.zIndex=230;ents.appendChild(s.el);S.shots.push(s);}
    wearUnit(u,t.wear*(card.e==="消耗が遅い"?.5:1));
  }
  for(const s of S.shots){
    if(s.target&&s.target.hp>0){s.tx=s.target.x;s.ty=s.target.y;}
    const dx=s.tx-s.x,dy=s.ty-s.y,dist=Math.hypot(dx,dy),step=9*dt;
    if(dist<=step){
      s.done=true;s.el.remove();
      if(s.kind==="orb"){fx("ring",s.tx,s.ty);for(const e of S.enemies){if(e.hp>0&&Math.hypot(e.x-s.tx,e.y-s.ty)<=1.0)dmgEnemy(e,s.atk,e===s.target?1:.6);}}
      else if(s.target&&s.target.hp>0){
        const tg=s.target;dmgEnemy(tg,s.atk);
        if(s.kind==="bubble")tg.slow=1.8;
        if(s.kind==="breath"){fx("ring",s.tx,s.ty,"filter:hue-rotate(160deg)");for(const e of S.enemies){if(e!==tg&&e.hp>0&&e.d<tg.d&&tg.d-e.d<=1.3)dmgEnemy(e,s.atk,.7);}}
        if(s.kind==="thorn"&&tg.hp>0){tg.pT=3;tg.pDps=Math.max(1,s.atk.p)*.45*mult(s.atk.h,tg.card.h);}
      }
    }else{s.x+=dx/dist*step;s.y+=dy/dist*step;s.el.style.transform=`translate(${s.x*cellPx}px,${s.y*cellPx}px)`;}
  }
  S.shots=S.shots.filter(s=>!s.done);
  if(S.phase==="wave"&&!S.queue.length&&!S.enemies.length)waveCleared();
}
let last=0;
function frame(t){
  const dt=Math.min(.05,(t-last)/1000||0);last=t;
  if(S.phase==="wave"&&!S.paused){
    for(let k=0;k<S.speed&&S.phase==="wave";k++)tick(dt);
    renderHud();renderSkills();
    if(S.phase==="wave"&&S.pendLv>0)showLevelUp();
  }
  requestAnimationFrame(frame);
}

/* ---------- 入力 ---------- */
function cellAt(x,y){
  const b=board.getBoundingClientRect();
  const c=Math.floor((x-b.left)/cellPx),r=Math.floor((y-b.top)/cellPx);
  return c>=0&&c<COLS&&r>=0&&r<ROWS?{c,r}:null;
}
function showRange(c,r,range){
  if(c==null){rangeEl.hidden=true;return;}
  rangeEl.hidden=false;
  rangeEl.style.cssText=`left:${(c+.5-range)*cellPx}px;top:${(r+.5-range)*cellPx}px;width:${range*2*cellPx}px;height:${range*2*cellPx}px`;
}
function showHL(uid){
  clearHL();const i=S.hand.find(h=>h.uid===uid);if(!i)return;
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const k=placeCheck(i,c,r);if(k==="ok")tiles[r][c].classList.add("ok");else if(k==="merge")tiles[r][c].classList.add("merge");
  }
  handEl.querySelectorAll(".card").forEach(e=>{const h=S.hand.find(x=>x.uid==e.dataset.uid);if(h&&h!==i&&C(h).r===C(i).r)e.classList.add("mergeable");});
}
function clearHL(){for(const row of tiles)for(const t of row)t.classList.remove("ok","merge","hover");handEl.querySelectorAll(".mergeable").forEach(e=>e.classList.remove("mergeable","over"));showRange(null);}
handEl.addEventListener("pointerdown",ev=>{
  const el=ev.target.closest(".card");if(!el||S.phase!=="wave")return;
  ev.preventDefault();if(S.aim)setAim(null);
  drag={uid:+el.dataset.uid,el,x:ev.clientX,y:ev.clientY,moved:false,ghost:null,hover:null};
});
function cancelDrag(){if(!drag)return;const d=drag;drag=null;if(d.ghost)d.ghost.remove();if(d.el)d.el.classList.remove("lifted");if(d.hover)d.hover.classList.remove("hover");clearHL();}
function handTargetAt(x,y){const el=document.elementFromPoint(x,y);const c=el&&el.closest("#hand .card");return c&&+c.dataset.uid!==drag.uid?c:null;}
window.addEventListener("pointermove",ev=>{
  if(!drag)return;
  if(S.phase!=="wave"){cancelDrag();return;}
  if(!drag.moved&&Math.hypot(ev.clientX-drag.x,ev.clientY-drag.y)>8){
    drag.moved=true;
    const i=S.hand.find(h=>h.uid===drag.uid);
    const g=document.createElement("div");g.innerHTML=cardHTML(i);drag.ghost=g.firstElementChild;drag.ghost.classList.add("ghost");
    document.body.appendChild(drag.ghost);drag.el.classList.add("lifted");
    S.sel=null;handEl.querySelectorAll(".sel").forEach(e=>e.classList.remove("sel"));showHL(drag.uid);info.innerHTML=cardInfo(i);
  }
  if(drag.moved){
    drag.ghost.style.left=ev.clientX+"px";drag.ghost.style.top=ev.clientY+"px";
    if(drag.hover)drag.hover.classList.remove("hover");
    const p=cellAt(ev.clientX,ev.clientY);
    drag.hover=p?tiles[p.r][p.c]:null;if(drag.hover)drag.hover.classList.add("hover");
    const i=S.hand.find(h=>h.uid===drag.uid);
    if(p)showRange(p.c,p.r,TRIBE[C(i).r].range);else showRange(null);
    handEl.querySelectorAll(".over").forEach(e=>e.classList.remove("over"));
    const ht=handTargetAt(ev.clientX,ev.clientY);if(ht&&ht.classList.contains("mergeable"))ht.classList.add("over");
  }
});
function endDrag(ev,cancel){
  if(!drag)return;const d=drag;
  if(S.phase!=="wave"){cancelDrag();return;}
  if(d.moved){
    const ht=!cancel&&handTargetAt(ev.clientX,ev.clientY);
    drag=null;d.ghost.remove();d.el.classList.remove("lifted");
    if(ht){if(!handMerge(d.uid,+ht.dataset.uid)){clearHL();renderHand();}return;}
    const p=!cancel&&cellAt(ev.clientX,ev.clientY);
    if(!(p&&tryPlay(d.uid,p.c,p.r))){clearHL();renderHand();}
  }else{
    drag=null;if(cancel)return;
    if(S.sel===d.uid){S.sel=null;clearHL();}
    else{S.sel=d.uid;showHL(d.uid);info.innerHTML=cardInfo(S.hand.find(h=>h.uid===d.uid));}
    renderHand();if(S.sel!=null)showHL(S.sel);
  }
}
window.addEventListener("pointerup",ev=>endDrag(ev,false));
window.addEventListener("pointercancel",ev=>endDrag(ev,true));
window.addEventListener("blur",()=>cancelDrag());
board.addEventListener("click",ev=>{
  if(S.phase!=="wave")return;
  const p=cellAt(ev.clientX,ev.clientY);if(!p)return;
  if(S.aim){const b=board.getBoundingClientRect();castSkill(S.aim,(ev.clientX-b.left)/cellPx,(ev.clientY-b.top)/cellPx);return;}
  if(S.sel!=null){tryPlay(S.sel,p.c,p.r);return;}
  const u=S.units.get(key(p.c,p.r));
  for(const x of S.units.values())x.el.classList.remove("sel");
  if(u){u.el.classList.add("sel");showRange(u.c,u.r,TRIBE[C(u.i).r].range);
    info.innerHTML=cardInfo(u.i,`　耐久 ${Math.ceil(u.hp)}/${u.max}${u.buff?`　支援 +${u.buff}`:""}`);}
  else showRange(null);
});
$("#skills").addEventListener("click",ev=>{
  const b=ev.target.closest(".sk");if(!b||S.phase!=="wave")return;
  const h=b.dataset.h,s=S.skills[h];
  if(!s){toast("レベルアップで獲得できます");return;}
  if(s.cd>0){toast(`${SKILL[h].n}はあと${Math.ceil(s.cd)}秒`);return;}
  setAim(S.aim===h?null:h);
});
$("#spd").addEventListener("click",()=>{S.speed=S.speed===1?2:1;$("#spd").textContent="×"+S.speed;$("#spd").setAttribute("aria-pressed",S.speed===2)});
$("#pause").addEventListener("click",()=>setPause(!S.paused));
function setPause(p){
  if(S.phase!=="wave")return;S.paused=p;$("#pause").textContent=p?"▶":"❚❚";$("#pause").setAttribute("aria-pressed",p);
  if(p)showPanel(`<h2>一時停止</h2><button class="go" id="resume">再開</button><button class="sub" id="howBtn">遊び方</button><button class="sub" id="retire">タイトルに戻る</button>`,()=>{
    $("#resume").onclick=()=>setPause(false);$("#howBtn").onclick=()=>howTo(0,()=>setPause(true));$("#retire").onclick=()=>{S.paused=false;S.phase="title";ents.innerHTML="";titleScreen();};});
  else overlay.hidden=true;
}
document.addEventListener("visibilitychange",()=>{if(document.hidden&&S.phase==="wave"&&!S.paused)setPause(true)});
window.addEventListener("resize",fit);

/* ---------- 画面 ---------- */
function showPanel(html,bind){cancelDrag();S.sel=null;if(S.aim){S.aim=null;board.classList.remove("aiming");}overlay.innerHTML=`<div class="panel">${html}</div>`;overlay.hidden=false;bind&&bind();}
function pickTribes(){return shuffle(Object.keys(TRIBE)).slice(0,RUN_TRIBES);}
function tribeList(list){return list.map(k=>`<dt>${k}</dt><dd>${TRIBE[k].role}：${TRIBE[k].desc}</dd>`).join("");}
// 種族の代表カード(1組目の進化前)
const repCard=r=>CARDS.find(c=>c.base&&c.r===r);
let nextTribes=null;
function titleScreen(){
  S.phase="title";S.paused=false;ents.innerHTML="";
  showPanel(`<button class="helpBtn" id="helpBtn" aria-label="遊び方">?</button>
    <h2 class="logo">サモンディフェンス</h2>
    <button class="go" id="startBtn">はじめる</button>`,()=>{$("#startBtn").onclick=chooseScreen;$("#helpBtn").onclick=()=>howTo(0,titleScreen);});
}
const RULES=`<ul>
  <li>魔術師の卓上遊戯。道を進む敵を、カードから召喚したキャラで倒します。全${WAVES}ウェーブ、結界まで通さなければクリア</li>
  <li>ゲージは時間で溜まります。<b>コスト</b>ぶん払って沿道に召喚。道の上に置けるのは物質族だけ</li>
  <li>同じ種族に重ねると<b>進化</b>。同じカード同士なら決まった姿、別のカードならランダム。<b>手札同士</b>でも重ねられます(ゲージ不要)</li>
  <li>敵にも手があり、<b>じゃんけんで勝つと2倍、負けると半分</b>。敵は全種族から出てきます</li>
  <li>敵を倒すと経験値。<b>レベルアップ</b>でカード・スキル・強化から1つ選べます</li>
  <li><b>スキル</b>はボタンを押してから道をタップ。スキルにも手があります(最初は石の落石)</li>
  <li>キャラは攻撃するたびに<b>耐久</b>が減り、0で墓地へ。ウェーブが終わるたびにも少し減ります。山札が切れると墓地が戻ります</li>
  <li>はじめに<b>カードの束</b>を1つ選び、その束の${RUN_TRIBES}種族で戦います</li>
</ul>`;
function howTo(pg,back){
  const body=pg===0?RULES:`<dl class="tribes">${tribeList(Object.keys(TRIBE))}</dl>`;
  showPanel(`<h2 class="sm">${pg===0?"遊び方":"種族の特性"}</h2>${body}
    <div class="pager"><button class="sub" id="hPrev" ${pg===0?"disabled":""}>‹ 戻る</button><span class="pg">${pg+1} / 2</span><button class="sub" id="hNext" ${pg===1?"disabled":""}>次へ ›</button></div>
    <button class="go small" id="hClose">閉じる</button>`,()=>{
    $("#hPrev").onclick=()=>howTo(0,back);$("#hNext").onclick=()=>howTo(1,back);$("#hClose").onclick=back;});
}
function chooseScreen(){
  S.phase="choose";
  // 束ごとに封蝋の種族(必ず入っている種族)を1つ見せる。封蝋はなるべく重ならないように
  let bundles;
  for(let g=0;g<30;g++){bundles=[0,1,2].map(()=>{const t=pickTribes();return {t,seal:t[rnd(t.length)]};});
    if(new Set(bundles.map(b=>b.seal)).size===3)break;}
  const chip=r=>{const c=repCard(r),s=Math.min(28/c.ht,32/c.w);return `<span class="tc"><img src="${c.img}" alt="" style="width:${(c.w*s).toFixed(1)}px;height:${(c.ht*s).toFixed(1)}px"><b>${r}</b><i>${TRIBE[r].role}</i></span>`;};
  showPanel(`<h2 class="sm">カードの束を選ぶ</h2><p>封蝋の種族は必ず入っています。残りの${RUN_TRIBES-1}種族は開けてのお楽しみ</p>
    <div class="bundles">${bundles.map((b,k)=>`<button class="bundle" data-k="${k}" aria-label="${b.seal}の封蝋の束">
      <div class="stack"><span class="wax">${b.seal[0]}</span><span class="sealName">${b.seal}</span></div>
      <div class="reveal">${[b.seal,...b.t.filter(x=>x!==b.seal)].map(chip).join("")}</div></button>`).join("")}</div>
    <div class="chooseFoot"></div>`,()=>{
    const wrap=overlay.querySelector(".bundles");
    overlay.querySelectorAll(".bundle").forEach(el=>el.onclick=()=>{
      if(wrap.classList.contains("done"))return;
      wrap.classList.add("done");el.classList.add("picked","open");
      nextTribes=bundles[+el.dataset.k].t;
      setTimeout(()=>wrap.querySelectorAll(".bundle:not(.picked)").forEach(x=>x.classList.add("open","other")),750);
      setTimeout(()=>{overlay.querySelector(".chooseFoot").innerHTML=`<button class="go" id="goBtn">召喚開始</button>`;$("#goBtn").onclick=start;$("#goBtn").focus();},1200);
    });
  });
}
function end(win){
  S.phase=win?"clear":"over";
  showPanel(`<h2>${win?"防衛成功":"結界崩壊"}</h2>
    <p>${win?`全${WAVES}ウェーブを守りきりました。`:`WAVE ${S.wave} で拠点のライフが尽きました。`}<br>Lv ${S.lv}　撃破 ${S.kills}体　進化 ${S.evos}回</p>
    <button class="go" id="again">もう一度</button>`,()=>{$("#again").onclick=()=>titleScreen();});
}
function start(){
  cancelDrag();overlay.hidden=true;ents.innerHTML="";
  const keep=S&&S.speed;
  S=newState();S.speed=keep||1;
  S.tribes=nextTribes||pickTribes();nextTribes=null;
  const bases=CARDS.filter(c=>c.base&&S.tribes.includes(c.r)).map(c=>c.id);
  S.deck=shuffle([...bases,bases[rnd(bases.length)],bases[rnd(bases.length)]].map(inst));
  board.classList.remove("aiming");
  draw(4);clearHL();renderHand();fit();lastG=-1;renderHud();renderXp();renderSkills();
  info.innerHTML=`今回の種族：<b>${S.tribes.join("・")}</b><br>${HELP}`;
  startWave(1);
}

S=newState();
buildTiles();fit();renderHand();renderHud();renderXp();renderSkills();info.innerHTML=HELP;titleScreen();
requestAnimationFrame(frame);
