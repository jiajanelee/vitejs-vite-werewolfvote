import React, { useState, useEffect, useCallback, useRef } from "react";

const POLL_INTERVAL = 2000;
const PLAYER_COUNT = 12;

function genRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Firebase Config ───────────────────────────────────────────────────────
// 將下方 YOUR_DATABASE_URL 換成你的 Firebase Realtime Database URL
// 格式：https://你的專案名稱-default-rtdb.firebaseio.com
const FIREBASE_URL = "https://werewolf-voting-default-rtdb.asia-southeast1.firebasedatabase.app";
const FIREBASE_CONFIGURED = FIREBASE_URL !== "YOUR_DATABASE_URL" && FIREBASE_URL.startsWith("https://");

// ── Storage (Firebase Realtime Database REST API) ─────────────────────────
async function loadRoom(code) {
  try {
    const res = await fetch(`${FIREBASE_URL}/rooms/${code}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    return data || null;
  } catch { return null; }
}

async function saveRoom(room) {
  room.updatedAt = Date.now();
  const res = await fetch(`${FIREBASE_URL}/rooms/${room.code}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(room),
  });
  if (!res.ok) throw new Error(`Firebase 儲存失敗：${res.status} ${res.statusText}`);
}

// ── Role catalogue ────────────────────────────────────────────────────────
const ROLE_MAP = {
  wolf:      { id:"wolf",      label:"狼人",     emoji:"🐺", camp:"wolf" },
  wolf2:     { id:"wolf2",     label:"狼王",     emoji:"👑", camp:"wolf" },
  seer:      { id:"seer",      label:"預言家",   emoji:"🔮", camp:"good" },
  witch:     { id:"witch",     label:"女巫",     emoji:"🧙", camp:"good" },
  hunter:    { id:"hunter",    label:"獵人",     emoji:"🏹", camp:"good" },
  guard:     { id:"guard",     label:"守衛",     emoji:"🛡", camp:"good" },
  magician:  { id:"magician",  label:"魔術師",   emoji:"🎩", camp:"good" },
  merchant:  { id:"merchant",  label:"奇蹟商人", emoji:"🛒", camp:"good" },
  secretlove:{ id:"secretlove",label:"暗戀者",   emoji:"💘", camp:"good" },
  dreamer:   { id:"dreamer",   label:"攝夢人",   emoji:"🌙", camp:"good" },
  lonegirl:  { id:"lonegirl",  label:"覺醒孤獨少女", emoji:"🌟", camp:"good" },
  lucky:     { id:"lucky",     label:"幸運兒",   emoji:"🍀", camp:"good" },
  village:   { id:"village",   label:"村民",     emoji:"👤", camp:"good" },
};
const ROLE_COLORS = {
  wolf:      { bg:"var(--color-background-danger)",   text:"var(--color-text-danger)"   },
  wolf2:     { bg:"var(--color-background-danger)",   text:"var(--color-text-danger)"   },
  seer:      { bg:"var(--color-background-info)",     text:"var(--color-text-info)"     },
  witch:     { bg:"var(--color-background-warning)",  text:"var(--color-text-warning)"  },
  hunter:    { bg:"var(--color-background-warning)",  text:"var(--color-text-warning)"  },
  guard:     { bg:"var(--color-background-success)",  text:"var(--color-text-success)"  },
  magician:  { bg:"var(--color-background-info)",     text:"var(--color-text-info)"     },
  merchant:  { bg:"var(--color-background-success)",  text:"var(--color-text-success)"  },
  secretlove:{ bg:"var(--color-background-warning)",  text:"var(--color-text-warning)"  },
  dreamer:   { bg:"var(--color-background-info)",     text:"var(--color-text-info)"     },
  lonegirl:  { bg:"var(--color-background-warning)",  text:"var(--color-text-warning)"  },
  lucky:     { bg:"var(--color-background-success)",  text:"var(--color-text-success)"  },
  village:   { bg:"var(--color-background-tertiary)", text:"var(--color-text-tertiary)" },
};

// ── Presets ───────────────────────────────────────────────────────────────
// nightOrder step shape:
//   { roleId, label, firstNightOnly?, identifyPlayers?, note?,
//     action?:{ key, label, multi?, isWitch?, isSwap?, isGrant? } }
const PRESETS = [
  {
    id:"wolfking_magician", label:"狼王魔術師",
    desc:"狼王 狼人×3 預言家 女巫 獵人 魔術師 村民×4",
    roles:["wolf2","wolf","wolf","wolf","seer","witch","hunter","magician","village","village","village","village"],
    nightOrder:[
      { roleId:"magician",  label:"魔術師行動",  identifyPlayers:false,
        action:{ key:"swap", label:"選擇要互換的兩名玩家", multi:true, isSwap:true } },
      { roleId:"wolf2",     label:"狼王 & 狼人睜眼", identifyPlayers:true,
        action:{ key:"kill", label:"請選擇殺人目標", multi:false } },
      { roleId:"witch",     label:"女巫睜眼",    identifyPlayers:false,
        action:{ key:"witch", label:"女巫行動", multi:false, isWitch:true } },
      { roleId:"seer",      label:"預言家睜眼",  identifyPlayers:false,
        action:{ key:"check", label:"請選擇查驗目標", multi:false } },
      { roleId:"hunter",    label:"獵人睜眼（確認開槍狀態）", identifyPlayers:false,
        note:"首夜確認獵人是否開槍", action:null },
    ],
  },
  {
    id:"wolfking_merchant", label:"狼王奇蹟商人",
    desc:"狼王 狼人×3 預言家 女巫 守衛 奇蹟商人 村民×4",
    roles:["wolf2","wolf","wolf","wolf","seer","witch","guard","merchant","village","village","village","village"],
    nightOrder:[
      { roleId:"merchant",  label:"奇蹟商人行動",identifyPlayers:false,
        action:{ key:"grant", label:"選擇授予技能的玩家", multi:false, isGrant:true } },
      { roleId:"guard",     label:"守衛睜眼",    identifyPlayers:false,
        action:{ key:"guard", label:"請選擇守護目標", multi:false, isGuard:true } },
      { roleId:"wolf2",     label:"狼王 & 狼人睜眼", identifyPlayers:true,
        action:{ key:"kill", label:"請選擇殺人目標", multi:false } },
      { roleId:"witch",     label:"女巫睜眼",    identifyPlayers:false,
        action:{ key:"witch", label:"女巫行動", multi:false, isWitch:true } },
      { roleId:"seer",      label:"預言家睜眼",  identifyPlayers:false,
        action:{ key:"check", label:"請選擇查驗目標", multi:false } },
      { roleId:"lucky",     label:"幸運兒行動（若已獲得技能）", identifyPlayers:false,
        note:"僅在奇蹟商人授予技能後行動", action:{ key:"lucky", label:"幸運兒使用技能目標", multi:false } },
    ],
  },
  {
    id:"wolfking_guard", label:"狼王守衛",
    desc:"狼王 狼人×3 預言家 女巫 獵人 守衛 村民×4",
    roles:["wolf2","wolf","wolf","wolf","seer","witch","hunter","guard","village","village","village","village"],
    nightOrder:[
      { roleId:"guard",     label:"守衛睜眼",    identifyPlayers:false,
        action:{ key:"guard", label:"請選擇守護目標", multi:false, isGuard:true } },
      { roleId:"wolf2",     label:"狼王 & 狼人睜眼", identifyPlayers:true,
        action:{ key:"kill", label:"請選擇殺人目標", multi:false } },
      { roleId:"witch",     label:"女巫睜眼",    identifyPlayers:false,
        action:{ key:"witch", label:"女巫行動", multi:false, isWitch:true } },
      { roleId:"seer",      label:"預言家睜眼",  identifyPlayers:false,
        action:{ key:"check", label:"請選擇查驗目標", multi:false } },
      { roleId:"hunter",    label:"獵人睜眼（確認開槍狀態）", identifyPlayers:false,
        note:"首夜確認獵人是否開槍", action:null },
    ],
  },
  {
    id:"secretlove", label:"暗戀者",
    desc:"狼人×4 預言家 女巫 獵人 白癡 暗戀者 村民×3",
    roles:["wolf","wolf","wolf","wolf","seer","witch","hunter","idiot","secretlove","village","village","village"],
    nightOrder:[
      { roleId:"secretlove",label:"暗戀者選擇偶像（僅首夜）", identifyPlayers:false,
        firstNightOnly:true,
        action:{ key:"idol", label:"請選擇你的偶像", multi:false } },
      { roleId:"guard",     label:"守衛睜眼",    identifyPlayers:false,
        action:{ key:"guard", label:"請選擇守護目標", multi:false, isGuard:true } },
      { roleId:"wolf",      label:"狼人睜眼",    identifyPlayers:true,
        action:{ key:"kill", label:"請選擇殺人目標", multi:false } },
      { roleId:"witch",     label:"女巫睜眼",    identifyPlayers:false,
        action:{ key:"witch", label:"女巫行動", multi:false, isWitch:true } },
      { roleId:"seer",      label:"預言家睜眼",  identifyPlayers:false,
        action:{ key:"check", label:"請選擇查驗目標", multi:false } },
      { roleId:"hunter",    label:"獵人睜眼（確認開槍狀態）", identifyPlayers:false,
        note:"首夜確認獵人是否開槍", action:null },
    ],
  },
  {
    id:"lonegirl", label:"覺醒孤獨少女",
    desc:"狼人×4 預言家 女巫 獵人 攝夢人 覺醒孤獨少女 村民×3",
    roles:["wolf","wolf","wolf","wolf","seer","witch","hunter","dreamer","lonegirl","village","village","village"],
    nightOrder:[
      { roleId:"lonegirl",  label:"覺醒孤獨少女選擇偶像（僅首夜）", identifyPlayers:false,
        firstNightOnly:true,
        action:{ key:"idol", label:"請選擇你的偶像", multi:false } },
      { roleId:"dreamer",   label:"攝夢人行動",  identifyPlayers:false,
        note:"技能不可空放，夢遊對象免疫狼殺與毒藥；連續兩晚夢遊同一人則死亡",
        action:{ key:"dream", label:"請選擇攝夢目標（必選，不可空放）", multi:false } },
      { roleId:"wolf",      label:"狼人睜眼",    identifyPlayers:true,
        action:{ key:"kill", label:"請選擇殺人目標", multi:false } },
      { roleId:"witch",     label:"女巫睜眼",    identifyPlayers:false,
        action:{ key:"witch", label:"女巫行動", multi:false, isWitch:true } },
      { roleId:"seer",      label:"預言家睜眼",  identifyPlayers:false,
        action:{ key:"check", label:"請選擇查驗目標", multi:false } },
      { roleId:"hunter",    label:"獵人睜眼（確認開槍狀態）", identifyPlayers:false,
        note:"首夜確認獵人是否開槍", action:null },
    ],
  },
];

// night: 本晚行動資料
// lastDreamTarget: 上一晚的攝夢目標（跨夜追蹤）
// roles: room.roles，用於判斷查驗結果陣營
// 魔術師互換邏輯：所有技能施放目標先經過 swapTarget 轉換
// swap = [A, B]：對 A 施放的技能實際作用於 B，對 B 施放的技能實際作用於 A
function swapTarget(num, swap) {
  if (!swap || swap.length !== 2 || !num) return num;
  if (num === swap[0]) return swap[1];
  if (num === swap[1]) return swap[0];
  return num;
}

// 取得預言家查驗結果（考慮魔術師互換）
// 查驗 target → 實際看到的是 swapTarget(target) 的陣營
function getSeerResult(checkTarget, swap, roles) {
  const realTarget = swapTarget(checkTarget, swap);
  const roleId = roles?.[`p${realTarget}`];
  const camp = ROLE_MAP[roleId]?.camp;
  return {
    checkTarget,           // 預言家查驗的號碼
    realTarget,            // 實際看到底牌的號碼（經 swap 後）
    swapped: realTarget !== checkTarget,
    camp: camp || null,    // "wolf" | "good" | null
    isWolf: camp === "wolf",
  };
}

function computeNightDeaths(night, lastDreamTarget) {
  const swap = night.swap?.length === 2 ? night.swap : null;

  // 所有技能目標先經過魔術師互換轉換
  const wolfTarget   = swapTarget(night.kill?.[0],         swap);
  const guardTarget  = swapTarget(night.guard?.[0],        swap);
  const dreamTarget  = swapTarget(night.dream?.[0],        swap);
  const witchSave    = swapTarget(night.witchSave?.[0],    swap);
  const witchPoison  = swapTarget(night.witchPoison?.[0],  swap);
  const dreamerNum   = night.dreamerNum;   // 攝夢人自身號碼（不受 swap 影響）
  const killed = [];

  // ── 先計算攝夢人本晚是否被擊殺（被狼殺且未被救；或被女巫毒殺）──
  // 攝夢人被狼殺：守衛/女巫單獨救可活；雙重保護則死
  let dreamerKilledThisNight = false;
  if (dreamerNum) {
    const dreamerWolfKilled = wolfTarget === dreamerNum;
    const dreamerPoisoned   = witchPoison === dreamerNum;
    if (dreamerWolfKilled) {
      const singleGuard = guardTarget === dreamerNum && witchSave !== dreamerNum;
      const singleWitch = witchSave === dreamerNum  && guardTarget !== dreamerNum;
      if (!singleGuard && !singleWitch) dreamerKilledThisNight = true;
    }
    if (dreamerPoisoned) dreamerKilledThisNight = true;
  }

  // ── 攝夢目標處理 ──
  // 夢遊目標免疫狼殺與女巫毒藥；女巫解藥不衝突
  // 連續兩晚被夢遊 → 第二晚死亡
  // 攝夢人本晚出局 → 夢遊目標跟著死
  if (dreamTarget) {
    if (dreamerKilledThisNight) {
      killed.push({ num: dreamTarget, reason: "攝夢人出局，夢遊者同死" });
    } else if (lastDreamTarget === dreamTarget) {
      killed.push({ num: dreamTarget, reason: "連續夢遊兩晚死亡" });
    }
    // 否則夢遊目標本晚存活（免疫狼殺與毒藥）
  }

  // ── 攝夢人本晚出局 ──
  if (dreamerKilledThisNight && dreamerNum) {
    killed.push({ num: dreamerNum, reason: "攝夢人出局" });
  }

  // ── 一般狼殺（非攝夢目標、非攝夢人） ──
  if (wolfTarget && wolfTarget !== dreamTarget && wolfTarget !== dreamerNum) {
    const singleGuard = guardTarget === wolfTarget && witchSave !== wolfTarget;
    const singleWitch = witchSave === wolfTarget  && guardTarget !== wolfTarget;
    const saved = singleGuard || singleWitch;
    if (!saved) killed.push({ num: wolfTarget, reason: "狼人擊殺" });
  }

  // ── 女巫毒殺（非攝夢目標、非攝夢人，攝夢人單獨處理過了） ──
  if (witchPoison && witchPoison !== dreamTarget && witchPoison !== dreamerNum) {
    killed.push({ num: witchPoison, reason: "女巫毒殺" });
  }

  // ── 幸運兒為狼陣營：技能無效，奇蹟商人死亡 ──
  const luckyIsWolf  = night.luckyIsWolf;    // boolean，由上帝在 lucky 步驟確認
  const merchantNum  = night.merchantNum;    // 奇蹟商人號碼
  if (luckyIsWolf && merchantNum) {
    if (!killed.find(k=>k.num===merchantNum)) {
      killed.push({ num: merchantNum, reason: "幸運兒為狼陣營，奇蹟商人反噬死亡" });
    }
  }

  return killed;
}

const defaultRoom = (code, presetId = "std") => ({
  code, phase:"lobby",
  preset: presetId,
  players:{}, roles:{}, rolesRevealed:false,
  sheriff:null, sheriffBadgeLost:false,
  campaign:{ candidates:[], speakers:[], speakerDir:null, currentSpeaker:null,
             finalCandidates:[], votes:{}, pkRound:false, pkCandidates:[], result:null },
  exile:{ targetOptions:[], votes:{}, result:null, published:false },
  idiotRevealed:false,   // 白癡是否已亮出身份（亮牌後失去投票權但不出局）
  night:null, nightStep:0,
  lastDreamTarget:null,  // 上一晚攝夢目標（用於連續夢遊判斷）
  swapHistory:[],        // 歷史互換記錄，魔術師用過的號碼不可再選
  witchSaveUsed:false,   // 女巫解藥是否已用過
  witchPoisonUsed:false, // 女巫毒藥是否已用過
  lonegirlIdol:null,          // 覺醒孤獨少女選擇的偶像號碼
  lonegirlTransformed:false,  // 是否已觸發轉變
  lonegirlNewRole:null,       // 轉變後的角色 id
  wolfBoomCount:0,        // 狼人自爆累計次數（連續兩次警徽流失）
  campaignPaused:false,   // 警長競選是否被自爆中斷（需繼續競選）
  campaignResuming:false, // 下一個白天是否繼續警長競選
  dayCount:1, log:[], voteHistory:[], nightHistory:[],
  firstSpeaker:null, firstSpeakerDir:null,
  updatedAt: Date.now(),
});

// ── Design tokens ─────────────────────────────────────────────────────────
const clr = {
  bg:"var(--color-background-primary)", bg2:"var(--color-background-secondary)",
  bg3:"var(--color-background-tertiary)", text:"var(--color-text-primary)",
  text2:"var(--color-text-secondary)", text3:"var(--color-text-tertiary)",
  border:"var(--color-border-tertiary)", border2:"var(--color-border-secondary)",
  danger:"var(--color-text-danger)",   dangerBg:"var(--color-background-danger)",
  success:"var(--color-text-success)", successBg:"var(--color-background-success)",
  info:"var(--color-text-info)",       infoBg:"var(--color-background-info)",
  warn:"var(--color-text-warning)",    warnBg:"var(--color-background-warning)",
};
const card = { background:clr.bg, border:`0.5px solid ${clr.border}`,
  borderRadius:"var(--border-radius-lg)", padding:"1.25rem", marginBottom:"1rem" };
const btn = (variant="default", disabled=false) => {
  const map = {
    default:{ bg:"transparent",   color:clr.text,    border:`0.5px solid ${clr.border2}` },
    primary:{ bg:clr.infoBg,      color:clr.info,    border:`0.5px solid ${clr.info}`    },
    danger: { bg:clr.dangerBg,    color:clr.danger,  border:`0.5px solid ${clr.danger}`  },
    success:{ bg:clr.successBg,   color:clr.success, border:`0.5px solid ${clr.success}` },
    warn:   { bg:clr.warnBg,      color:clr.warn,    border:`0.5px solid ${clr.warn}`    },
  };
  const v = map[variant]||map.default;
  return { padding:"8px 16px", borderRadius:"var(--border-radius-md)", fontSize:14,
    fontWeight:500, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.45:1,
    border:v.border, background:v.bg, color:v.color, transition:"opacity .15s" };
};
const tag = (color="info") => {
  const map = { info:{bg:clr.infoBg,color:clr.info}, success:{bg:clr.successBg,color:clr.success},
    warn:{bg:clr.warnBg,color:clr.warn}, danger:{bg:clr.dangerBg,color:clr.danger},
    gray:{bg:clr.bg3,color:clr.text2} };
  const v = map[color]||map.gray;
  return { display:"inline-block", padding:"2px 10px", borderRadius:"var(--border-radius-md)",
    fontSize:12, fontWeight:500, background:v.bg, color:v.color, marginLeft:6 };
};

const PHASES = { lobby:"等待加入", campaign:"警長競選", campaignVote:"投票選警長",
  campaignPK:"平票 PK", night:"夜晚行動", day:"白天放逐投票", result:"放逐結果" };
// Day count when sheriff campaign happened (always day 1)
const CAMPAIGN_DAY = 1;

// ── Shared small components ───────────────────────────────────────────────
function Log({ entries }) {
  return (
    <div style={{ maxHeight:160, overflowY:"auto", fontSize:13, color:clr.text2 }}>
      {[...entries].reverse().map((e,i) => (
        <div key={i} style={{ padding:"4px 0", borderBottom:`0.5px solid ${clr.border}` }}>{e}</div>
      ))}
    </div>
  );
}

function MultiNumberSelect({ label, max=12, value=[], onChange, exclude=[] }) {
  const nums = Array.from({length:max},(_,i)=>i+1).filter(n=>!exclude.includes(n));
  const toggle = n => value.includes(n) ? onChange(value.filter(x=>x!==n)) : onChange([...value,n]);
  return (
    <div style={{ marginBottom:12 }}>
      {label ? <div style={{ fontSize:13, color:clr.text2, marginBottom:6 }}>{label}</div> : null}
      {value.length>0 && <div style={{ fontSize:12, color:clr.info, marginBottom:8 }}>已選：{[...value].sort((a,b)=>a-b).join("、")} 號</div>}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
        {nums.map(n => {
          const sel = value.includes(n);
          return (
            <button key={n} onClick={() => toggle(n)} style={{
              display:"flex", alignItems:"center", gap:4,
              padding:sel?"5px 10px 5px 8px":"5px 12px", minWidth:44,
              borderRadius:"var(--border-radius-md)", fontSize:14, fontWeight:sel?500:400,
              cursor:"pointer", border:sel?`1.5px solid ${clr.info}`:`0.5px solid ${clr.border2}`,
              background:sel?clr.infoBg:"transparent", color:sel?clr.info:clr.text,
              transform:sel?"scale(1.06)":"scale(1)", transition:"all .12s ease",
              boxShadow:sel?`0 0 0 3px ${clr.infoBg}`:"none",
            }}>
              {sel && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── NightPickBtn & NightChoiceBtn: stable top-level components ───────────
// Must be top-level (not inline) to avoid React remount on every render
function NightPickBtn({ stateKey, multi=false, opts, label, na, setNightActions }) {
  const val = na[stateKey]||[];
  const toggle = n => {
    const next = multi
      ? (val.includes(n)?val.filter(x=>x!==n):[...val,n])
      : (val.includes(n)?[]:[n]);
    setNightActions(prev=>({...prev,[stateKey]:next}));
  };
  return (
    <div style={{ marginTop:6 }}>
      {label && <div style={{ fontSize:12, color:clr.text2, marginBottom:5 }}>{label}</div>}
      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
        {(opts||[]).map(n=>{
          const sel=val.includes(n);
          return (
            <button key={n} onClick={()=>toggle(n)} style={{
              padding:sel?"5px 9px 5px 7px":"5px 11px",
              borderRadius:"var(--border-radius-md)", fontSize:13,
              border:sel?`1.5px solid ${clr.info}`:`0.5px solid ${clr.border2}`,
              background:sel?clr.infoBg:"transparent", color:sel?clr.info:clr.text,
              cursor:"pointer", display:"flex", alignItems:"center", gap:3, transition:"all .1s",
            }}>
              {sel&&<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              {n}
            </button>
          );
        })}
      </div>
      {val.length>0 && <div style={{ fontSize:12, color:clr.info, marginTop:5 }}>已選：{val.join("、")} 號</div>}
    </div>
  );
}

function NightChoiceBtn({ stateKey, choices, na, setNightActions }) {
  const sel = na[stateKey];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:6 }}>
      {choices.map(c=>(
        <button key={c.key}
          onClick={()=>setNightActions(prev=>({...prev,[stateKey]:c.key}))}
          style={{
            textAlign:"left", padding:"8px 12px",
            borderRadius:"var(--border-radius-md)", fontSize:13,
            border:sel===c.key?`1.5px solid ${clr.info}`:`0.5px solid ${clr.border2}`,
            background:sel===c.key?clr.infoBg:"transparent",
            color:sel===c.key?clr.info:clr.text, cursor:"pointer", transition:"all .1s",
          }}>{c.label}
        </button>
      ))}
    </div>
  );
}

function VoteButtons({ options, onVote, label, isDanger }) {
  return (
    <div>
      <div style={{ fontSize:13, color:clr.text2, marginBottom:8 }}>{label}</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
        {options.map(n => (
          <button key={n} onClick={() => onVote(n)}
            style={{ ...btn(n===0?"warn":isDanger?"danger":"primary"), minWidth:52, padding:"8px 12px" }}>
            {n===0?"棄票":`${n} 號`}
          </button>
        ))}
      </div>
    </div>
  );
}

function GodVoteMatrix({ votes, candidates }) {
  const grouped = {};
  candidates.forEach(c => grouped[c]=[]);
  grouped[0] = [];
  Object.entries(votes||{}).forEach(([voter,target]) => {
    const t = Number(target);
    if (grouped[t]!==undefined) grouped[t].push(Number(voter));
    else grouped[t] = [Number(voter)];
  });
  return (
    <div>
      <div style={{ fontSize:12, color:clr.text2, marginBottom:8 }}>即時票型（已投 {Object.keys(votes).length} 票）</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {Object.entries(grouped||{}).map(([target,voters]) => {
          const t = Number(target);
          if (t!==0 && !candidates.includes(t)) return null;
          return (
            <div key={target} style={{ display:"flex", alignItems:"center", gap:8, minHeight:28 }}>
              <div style={{ minWidth:52, padding:"3px 8px", borderRadius:"var(--border-radius-md)",
                background:t===0?clr.warnBg:clr.infoBg, color:t===0?clr.warn:clr.info,
                fontSize:13, fontWeight:500, textAlign:"center", flexShrink:0 }}>
                {t===0?"棄票":`${t} 號`}
              </div>
              <div style={{ fontSize:13, color:clr.text2, flexShrink:0 }}>：</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                {voters.length===0
                  ? <span style={{ fontSize:12, color:clr.text3 }}>尚無</span>
                  : voters.sort((a,b)=>a-b).map(v => (
                    <span key={v} style={{ background:clr.bg2, borderRadius:"var(--border-radius-md)", padding:"2px 8px", fontSize:12, color:clr.text2 }}>{v} 號</span>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerVoteMatrix({ votes, candidates }) {
  const grouped = {};
  candidates.forEach(c => grouped[c]=[]);
  grouped[0] = [];
  Object.entries(votes||{}).forEach(([voter,target]) => {
    const t = Number(target);
    if (grouped[t]!==undefined) grouped[t].push(Number(voter));
    else grouped[t] = [Number(voter)];
  });
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {Object.entries(grouped||{}).map(([target,voters]) => {
        const t = Number(target);
        if (t!==0 && !candidates.includes(t)) return null;
        if (voters.length===0) return null;
        return (
          <div key={target} style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
            <div style={{ minWidth:52, padding:"4px 8px", borderRadius:"var(--border-radius-md)",
              background:t===0?clr.warnBg:clr.infoBg, color:t===0?clr.warn:clr.info,
              fontSize:13, fontWeight:500, textAlign:"center", flexShrink:0 }}>
              {t===0?"棄票":`${t} 號`}
            </div>
            <div style={{ fontSize:13, color:clr.text2, paddingTop:4, flexShrink:0 }}>：</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4, paddingTop:2 }}>
              {voters.sort((a,b)=>a-b).map(v => (
                <span key={v} style={{ background:clr.bg2, borderRadius:"var(--border-radius-md)", padding:"3px 8px", fontSize:12, color:clr.text2 }}>{v} 號</span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CampaignResult({ result }) {
  const { winner, tally, pkLost, pkCandidates } = result;
  return (
    <div>
      <div style={{ fontSize:14, fontWeight:500, marginBottom:8 }}>
        {winner ? `🎉 ${winner} 號當選警長！` : pkLost ? "⚠ 警徽流失" : `⚡ 平票 PK：${pkCandidates?.join("、")} 號`}
      </div>
      {tally && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
          {Object.entries(tally||{}).map(([n,v]) => Number(v)>0 && (
            <span key={n} style={{
              background:Number(n)===winner?clr.successBg:clr.bg2,
              color:Number(n)===winner?clr.success:clr.text2,
              borderRadius:"var(--border-radius-md)", padding:"3px 10px", fontSize:13 }}>
              {n==0?"棄票":`${n}號`} {Number(v).toFixed(1)}票
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ExileResult({ result }) {
  const { exiled, tied, tally, idiotSaved } = result;
  return (
    <div>
      <div style={{ fontSize:14, fontWeight:500, marginBottom:8 }}>
        {exiled && idiotSaved
          ? `🃏 ${exiled} 號（白癡）被放逐 → 亮出身份！不出局，失去投票權`
          : exiled
          ? `🔨 ${exiled} 號被放逐出局`
          : `平票！${tied?.join("、")} 號均未被放逐`}
      </div>
      {tally && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
          {Object.entries(tally||{}).map(([n,v]) => Number(v)>0 && (
            <span key={n} style={{
              background:Number(n)===exiled?clr.dangerBg:clr.bg2,
              color:Number(n)===exiled?clr.danger:clr.text2,
              borderRadius:"var(--border-radius-md)", padding:"3px 10px", fontSize:13 }}>
              {n==0?"棄票":`${n}號`} {Number(v).toFixed(1)}票
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerVoteHistory({ voteHistory }) {
  const [open, setOpen] = useState(false);
  if (!voteHistory?.length) return null;
  return (
    <div style={{ marginTop:8 }}>
      <button onClick={() => setOpen(o=>!o)}
        style={{ ...btn("default"), width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M2 7h10M2 10.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
        查看票型紀錄（{voteHistory.length} 輪）
      </button>
      {open && (
        <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:10 }}>
          {voteHistory.map((entry,i) => (
            <div key={i} style={{ ...card, marginBottom:0 }}>
              <div style={{ fontSize:13, fontWeight:500, color:clr.text, marginBottom:10 }}>
                {entry.label}
                {entry.winner && <span style={{ marginLeft:6, fontSize:12, color:clr.success, background:clr.successBg, padding:"2px 8px", borderRadius:"var(--border-radius-md)" }}>當選 {entry.winner} 號</span>}
                {entry.exiled && <span style={{ marginLeft:6, fontSize:12, color:clr.danger, background:clr.dangerBg, padding:"2px 8px", borderRadius:"var(--border-radius-md)" }}>放逐 {entry.exiled} 號</span>}
                {entry.pkLost && <span style={{ marginLeft:6, fontSize:12, color:clr.warn, background:clr.warnBg, padding:"2px 8px", borderRadius:"var(--border-radius-md)" }}>警徽流失</span>}
                {entry.tied && <span style={{ marginLeft:6, fontSize:12, color:clr.text2, background:clr.bg2, padding:"2px 8px", borderRadius:"var(--border-radius-md)" }}>平票</span>}
              </div>
              <PlayerVoteMatrix votes={entry.votes} candidates={entry.candidates} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PlayerGridGod: shows roles + dead status ──────────────────────────────
function PlayerGridGod({ room }) {
  const nums = Array.from({length:PLAYER_COUNT},(_,i)=>i+1);
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8 }}>
      {nums.map(n => {
        const roleId = room.roles?.[`p${n}`];
        const role   = roleId ? ROLE_MAP[roleId] : null;
        const rc     = roleId ? ROLE_COLORS[roleId] : null;
        const isDead = Object.values(room.players||{}).find(p=>p.num===n)?.dead;
        const isSheriff = room.sheriff===n;
        return (
          <div key={n} style={{ borderRadius:"var(--border-radius-md)", border:`0.5px solid ${clr.border}`,
            padding:"8px 4px", textAlign:"center", opacity:isDead?0.35:1, background:rc?rc.bg:"transparent" }}>
            <div style={{ fontSize:18, fontWeight:500, color:rc?rc.text:clr.text }}>{n}</div>
            {isSheriff && <div style={{ fontSize:10, color:clr.warn }}>⭐ 警長</div>}
            {role && <div style={{ fontSize:10, color:rc?.text||clr.text3 }}>{role.emoji}{role.label}</div>}
            {isDead && <div style={{ fontSize:10, color:clr.danger }}>出局</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── PlayerGrid: for seat selection ───────────────────────────────────────
function PlayerGrid({ room, myNum, onSelect }) {
  const nums = Array.from({length:PLAYER_COUNT},(_,i)=>i+1);
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8 }}>
      {nums.map(n => {
        const isMe = myNum===n;
        const isSheriff = room.sheriff===n;
        const isDead = Object.values(room.players||{}).find(p=>p.num===n)?.dead;
        return (
          <button key={n} onClick={() => onSelect&&onSelect(n)}
            style={{ ...btn(isMe?"primary":"default"), display:"flex", flexDirection:"column",
              alignItems:"center", gap:2, padding:"10px 4px", opacity:isDead?0.38:1 }}>
            <span style={{ fontSize:20, fontWeight:500, lineHeight:1 }}>{n}</span>
            {isSheriff && <span style={{ fontSize:10, color:clr.warn }}>⭐</span>}
            {isDead && <span style={{ fontSize:10, color:clr.danger }}>出局</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── RoleAssigner ─────────────────────────────────────────────────────────
function RoleAssigner({ roles, preset, onChange }) {
  const nums = Array.from({length:12},(_,i)=>i+1);
  const suggested = {};
  if (preset?.roles?.length) {
    preset.roles.forEach((rid,i) => { if (nums[i]) suggested[`p${nums[i]}`]=rid; });
  }
  const setRole = (n,rid) => {
    const k=`p${n}`, next={...roles};
    if (next[k]===rid) delete next[k]; else next[k]=rid;
    onChange(next);
  };
  return (
    <div style={{ marginBottom:10 }}>
      {preset?.roles?.length>0 && (
        <button onClick={() => onChange({...suggested})} style={{ ...btn("default"), fontSize:12, marginBottom:10 }}>
          套用版型預設排列
        </button>
      )}
      {nums.map(n => {
        const assigned = roles[`p${n}`];
        return (
          <div key={n} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            <div style={{ minWidth:36, fontSize:13, fontWeight:500, color:clr.text2 }}>{n} 號</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
              {Object.keys(ROLE_MAP).map(rid => {
                const r=ROLE_MAP[rid], sel=assigned===rid, rc2=ROLE_COLORS[rid];
                return (
                  <button key={rid} onClick={() => setRole(n,rid)} style={{
                    padding:"3px 8px", borderRadius:"var(--border-radius-md)", fontSize:12,
                    border:sel?`1.5px solid ${rc2.text}`:`0.5px solid ${clr.border}`,
                    background:sel?rc2.bg:"transparent", color:sel?rc2.text:clr.text3,
                    cursor:"pointer", transition:"all .1s",
                  }}>{r.emoji} {r.label}</button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── GodNightPanel ─────────────────────────────────────────────────────────
const GRANT_SKILLS = [
  { key:"grant_check",  label:"查驗技能", emoji:"🔮" },
  { key:"grant_poison", label:"毒藥技能", emoji:"☠"  },
  { key:"grant_gun",    label:"獵槍技能", emoji:"🏹" },
];
const WITCH_SKILLS = [
  { key:"save",   label:"💊 使用解藥（救人）" },
  { key:"poison", label:"☠ 使用毒藥（毒人）"  },
  { key:"skip",   label:"跳過（不用藥）"       },
];

// ── NightHistory: persistent night action log ─────────────────────────────
function NightHistory({ nightHistory, roles }) {
  const [open, setOpen] = useState(true);
  if (!nightHistory?.length) return null;
  return (
    <div style={{ ...card, marginBottom:12 }}>
      <button onClick={() => setOpen(o=>!o)}
        style={{ ...btn("default"), width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 10px" }}>
        <span style={{ fontSize:13, fontWeight:500, color:clr.text }}>
          🌙 夜間行動紀錄（{nightHistory.length} 夜）
        </span>
        <span style={{ fontSize:12, color:clr.text3 }}>{open ? "▲ 收起" : "▼ 展開"}</span>
      </button>

      {open && (
        <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:10 }}>
          {[...nightHistory].reverse().map((entry, i) => {
            const swap = entry.swap;
            const sr = entry.check
              ? getSeerResult(entry.check, swap, entry.roles||{}) : null;
            return (
              <div key={i} style={{ padding:"10px 12px", borderRadius:"var(--border-radius-md)",
                border:`0.5px solid ${clr.border}`, background:clr.bg2 }}>

                {/* Header */}
                <div style={{ fontSize:13, fontWeight:500, color:clr.text, marginBottom:8,
                  display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>{entry.label}</span>
                  {entry.deaths?.length===0
                    ? <span style={{ fontSize:12, color:clr.success, background:clr.successBg, padding:"2px 8px", borderRadius:"var(--border-radius-md)" }}>平安夜</span>
                    : <span style={{ fontSize:12, color:clr.danger, background:clr.dangerBg, padding:"2px 8px", borderRadius:"var(--border-radius-md)" }}>
                        出局：{entry.deaths.map(d=>d.num+" 號").join("、")}
                      </span>
                  }
                </div>

                {/* Action details */}
                <div style={{ display:"flex", flexDirection:"column", gap:4, fontSize:12, color:clr.text2 }}>
                  {entry.swap && (
                    <div>🎩 魔術師互換：{entry.swap[0]} 號 ↔ {entry.swap[1]} 號</div>
                  )}
                  {entry.idol && (
                    <div>💘 偶像：{entry.idol} 號</div>
                  )}
                  {entry.grant && (
                    <div>🛒 商人授予 {entry.grant} 號：{GRANT_SKILLS.find(g=>g.key===entry.grantSkill)?.label||"技能"}</div>
                  )}
                  {entry.dream && (
                    <div>🌙 攝夢目標：{entry.dream} 號</div>
                  )}
                  {entry.kill && (
                    <div style={{ color:clr.danger }}>
                      🐺 狼殺目標：{swapTarget(entry.kill, swap)} 號
                      {swap && swapTarget(entry.kill,swap)!==entry.kill ? ` （原 ${entry.kill} 號，經互換）` : ""}
                    </div>
                  )}
                  {entry.guard && (
                    <div style={{ color:clr.success }}>🛡 守衛守護：{swapTarget(entry.guard, swap)} 號</div>
                  )}
                  {entry.witchSave && (
                    <div style={{ color:clr.success }}>💊 女巫救人：{swapTarget(entry.witchSave, swap)} 號</div>
                  )}
                  {entry.witchPoison && (
                    <div style={{ color:clr.danger }}>☠ 女巫毒殺：{swapTarget(entry.witchPoison, swap)} 號</div>
                  )}
                  {entry.lucky && (
                    <div>🍀 幸運兒技能目標：{entry.lucky} 號</div>
                  )}
                  {sr && (
                    <div style={{ padding:"3px 8px", borderRadius:"var(--border-radius-md)",
                      background:sr.isWolf?clr.dangerBg:clr.successBg,
                      color:sr.isWolf?clr.danger:clr.success }}>
                      🔮 預言家查驗 {sr.checkTarget} 號
                      {sr.swapped && ` → 實際看 ${sr.realTarget} 號`}
                      ：{sr.isWolf ? "⚠ 狼人陣營" : "✓ 好人陣營"}
                    </div>
                  )}
                  {entry.lonegirlTransformed && entry.lonegirlNewRole && (
                    <div style={{ padding:"3px 8px", borderRadius:"var(--border-radius-md)",
                      background:entry.lonegirlNewRole==="wolf"?clr.dangerBg:clr.infoBg,
                      color:entry.lonegirlNewRole==="wolf"?clr.danger:clr.info }}>
                      🌟 孤獨少女轉變為 {ROLE_MAP[entry.lonegirlNewRole]?.label||entry.lonegirlNewRole}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GodNightPanel({ room, godAction, loading }) {
  // Own internal state — fully isolated from parent polling re-renders
  const [na, setNa] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  // Use local stepIdx so UI updates immediately on advance (don't wait for Firebase roundtrip)
  const [localStep, setLocalStep] = useState(room.nightStep||0);
  const stepIdx = localStep;

  // Sync localStep if room.nightStep changes from outside (e.g. goBack from another device)
  useEffect(() => {
    setLocalStep(room.nightStep||0);
  }, [room.nightStep]);

  const preset      = PRESETS.find(p=>p.id===room.preset)||PRESETS[0];
  const fullOrder   = preset.nightOrder;
  const isFirstNight= !room.rolesRevealed; // first night = roles not yet revealed

  // Build effective night order with lonegirl inherited role injected
  const buildOrder = () => {
    let base = fullOrder.filter(s=>isFirstNight||!s.firstNightOnly);
    if (!isFirstNight && room.lonegirlTransformed && room.lonegirlNewRole) {
      const inherited = room.lonegirlNewRole;
      const stepMap = {
        seer:    { roleId:"seer",    label:"覺醒孤獨少女（繼承預言家）睜眼", identifyPlayers:false,
                   action:{ key:"check", label:"請選擇查驗目標", multi:false } },
        witch:   { roleId:"witch",   label:"覺醒孤獨少女（繼承女巫）睜眼",   identifyPlayers:false,
                   action:{ key:"witch", label:"女巫行動", multi:false, isWitch:true } },
        hunter:  { roleId:"hunter",  label:"覺醒孤獨少女（繼承獵人）睜眼",   identifyPlayers:false,
                   note:"被毒殺時不能開槍", action:null },
        dreamer: { roleId:"dreamer", label:"覺醒孤獨少女（繼承攝夢人）行動", identifyPlayers:false,
                   note:"技能不可空放，夢遊對象免疫狼殺與毒藥；連續兩晚夢遊同一人則死亡",
                   action:{ key:"dream", label:"請選擇攝夢目標（必選，不可空放）", multi:false } },
      };
      const injected = stepMap[inherited];
      if (injected) {
        const existIdx = base.findIndex(s=>s.roleId===inherited);
        base = base.map((s,i) => i===existIdx ? {...s, label:injected.label, note:injected.note} : s);
        // If original role step doesn't exist (role was killed), insert before hunter or at end
        if (existIdx < 0) {
          const hunterIdx = base.findIndex(s=>s.roleId==="hunter");
          const arr = [...base];
          if (hunterIdx>=0) arr.splice(hunterIdx, 0, injected);
          else arr.push(injected);
          return arr;
        }
      }
    }
    return base;
  };
  const order = buildOrder();
  const aliveNums   = Array.from({length:12},(_,i)=>i+1)
    .filter(n=>!Object.values(room.players||{}).find(p=>p.num===n)?.dead);
  const night       = room.night||{};
  const currentStep = order[stepIdx];
  // setNightActions shim for child components
  const setNightActions = setNa;

  // Players who hold a given roleId (from room.roles, filtered to alive)
  const roleOwners = (rid) =>
    Object.entries(room.roles||{})
      .filter(([,v])=>v===rid)
      .map(([k])=>Number(k.replace("p","")))
      .filter(n=>aliveNums.includes(n));

  const dreamerNums = roleOwners("dreamer");
  const wolfKill = night.kill?.[0] || na.kill?.[0];

  // ── Build stepData and advance ───────────────────────────────────────────
  const advanceStep = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const step = order[stepIdx];
    const act  = step?.action;
    const stepData = {};
    if (act?.isWitch) {
      const choice = na.witchChoice;
      // witchSave will be auto-filled below (wolfKill); poison target from witchTarget
      if (choice==="poison") stepData.witchPoison = na.witchTarget||[];
    } else if (act?.isSwap) {
      stepData.swap = na.swap||[];
    } else if (act?.isGrant) {
      stepData.grant      = na.grant||[];
      stepData.grantSkill = na.grantSkill_choice ? [na.grantSkill_choice] : [];
    } else if (act) {
      stepData[act.key] = na[act.key]||[];
    }
    if (dreamerNums.length) stepData.dreamerNum = dreamerNums[0];

    // Lucky wolf check: save for resolveNight
    if (currentStep?.roleId==="lucky") {
      const luckyNum  = room.night?.grant?.[0] || null;
      const luckyRole = luckyNum ? room.roles?.[`p${luckyNum}`] : null;
      stepData.luckyIsWolf  = luckyRole ? ROLE_MAP[luckyRole]?.camp==="wolf" : false;
      stepData.merchantNum  = roleOwners("merchant")[0] || null;
    }

    // First night: save identity for each role separately
    const role = ROLE_MAP[step?.roleId];
    const isWolfCamp = role?.camp === "wolf";
    const roleIdToSave = isFirstNight ? step?.roleId : null;

    // For wolf-camp: wolf2 and wolf are entered in separate NightPickBtns
    // saveNightStep only handles one roleId+nums pair, so we call it twice for wolf steps
    // by embedding both into stepData as special keys for the action handler
    // Collect identity nums for this step's roleId
    // For wolf-camp: each sub-role (wolf2, wolf) has its own key
    const identifyNums = isFirstNight ? (na[`id_${step?.roleId}`]||[]) : [];
    // For wolf steps, also save the other wolf sub-role nums via stepData
    if (isFirstNight && isWolfCamp) {
      stepData._wolfIdentify = {
        wolf2: na["id_wolf2"]||[],
        wolf:  na["id_wolf"]||[],
      };
    }

    // Also save witch save auto-fill: if save chosen, target = wolfKill
    if (act?.isWitch) {
      const choice = na.witchChoice;
      if (choice==="save") stepData.witchSave = wolfKill ? [wolfKill] : [];
      // poison already handled above
    }

    const nextStep = stepIdx+1;
    // Update UI immediately, then persist to Firebase
    setLocalStep(nextStep);
    setNa({});
    try {
      await godAction("saveNightStep",{
        data: stepData,
        roleId: roleIdToSave,
        nums: identifyNums,
        nextStep,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const goBack = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const prevStep = Math.max(0, stepIdx-1);
    setLocalStep(prevStep);
    setNa({});
    try {
      await godAction("saveNightStep",{ data:{}, roleId:null, nums:[], nextStep:prevStep });
    } finally {
      setIsSaving(false);
    }
  };

  const swapSel = na.swap||[];
  const swapPreview = swapSel.length===2 ? `${swapSel[0]} 號 ↔ ${swapSel[1]} 號`
    : swapSel.length===1 ? `${swapSel[0]} 號 ↔ ?` : null;

  return (
    <div style={card}>
      <div style={{ fontSize:14, fontWeight:500, color:clr.text, marginBottom:4 }}>🌙 夜晚行動</div>
      <div style={{ fontSize:12, color:clr.text3, marginBottom:12 }}>
        第 {room.dayCount} 夜　{isFirstNight?"首夜":"（首夜限定步驟已略過）"}
      </div>

      {/* Progress bar */}
      <div style={{ display:"flex", gap:4, marginBottom:16, flexWrap:"wrap" }}>
        {order.map((s,i)=>{
          const r=ROLE_MAP[s.roleId], done=i<stepIdx, active=i===stepIdx;
          return (
            <div key={i} style={{ padding:"3px 10px", borderRadius:"var(--border-radius-md)", fontSize:12,
              border:active?`1.5px solid ${clr.info}`:`0.5px solid ${clr.border}`,
              background:done?clr.bg3:active?clr.infoBg:"transparent",
              color:done?clr.text3:active?clr.info:clr.text2, fontWeight:active?500:400 }}>
              {r?.emoji} {r?.label} {done&&"✓"}
            </div>
          );
        })}
      </div>

      {/* ── 本夜行動紀錄（常駐，隨步驟即時更新）── */}
      {(() => {
        const swap = night.swap?.length===2 ? night.swap : null;
        const sr = night.check?.[0]
          ? getSeerResult(night.check[0], swap, room.roles||{}) : null;
        const hasAny = night.kill?.[0] || night.guard?.[0] || night.dream?.[0] ||
          night.witchSave?.[0] || night.witchPoison?.[0] || night.swap?.length===2 ||
          night.grant?.[0] || night.idol?.[0] || night.check?.[0] ||
          night.lucky?.[0] || room.lonegirlTransformed;
        if (!hasAny) return null;
        return (
          <div style={{ ...card, marginBottom:12, background:clr.bg2, border:`0.5px solid ${clr.border}` }}>
            <div style={{ fontSize:12, fontWeight:500, color:clr.text2, marginBottom:8 }}>
              📋 本夜行動紀錄
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4, fontSize:13 }}>
              {night.swap?.length===2 && (
                <div style={{ color:clr.info }}>🎩 魔術師互換：{night.swap[0]} 號 ↔ {night.swap[1]} 號</div>
              )}
              {night.idol?.[0] && (
                <div style={{ color:clr.warn }}>💘 偶像：{night.idol[0]} 號</div>
              )}
              {night.grant?.[0] && (
                <div style={{ color:clr.success }}>🛒 商人授予 {night.grant[0]} 號：{GRANT_SKILLS.find(g=>g.key===night.grantSkill?.[0])?.label||"技能"}</div>
              )}
              {night.dream?.[0] && (
                <div style={{ color:clr.info }}>🌙 攝夢目標：{night.dream[0]} 號</div>
              )}
              {night.kill?.[0] && (
                <div style={{ color:clr.danger }}>🐺 狼殺目標：{swapTarget(night.kill[0], swap)} 號{swap && swapTarget(night.kill[0],swap)!==night.kill[0]?` （原 ${night.kill[0]} 號，經魔術師互換）`:""}</div>
              )}
              {night.guard?.[0] && (
                <div style={{ color:clr.success }}>🛡 守衛守護：{swapTarget(night.guard[0], swap)} 號</div>
              )}
              {night.witchSave?.[0] && (
                <div style={{ color:clr.success }}>💊 女巫救人：{swapTarget(night.witchSave[0], swap)} 號</div>
              )}
              {night.witchPoison?.[0] && (
                <div style={{ color:clr.danger }}>☠ 女巫毒殺：{swapTarget(night.witchPoison[0], swap)} 號</div>
              )}
              {night.lucky?.[0] && (
                <div style={{ color:clr.success }}>🍀 幸運兒技能目標：{night.lucky[0]} 號</div>
              )}
              {night.check?.[0] && sr && (
                <div style={{ padding:"3px 8px", borderRadius:"var(--border-radius-md)",
                  background: sr.isWolf?clr.dangerBg:clr.successBg,
                  color: sr.isWolf?clr.danger:clr.success }}>
                  🔮 預言家查驗 {sr.checkTarget} 號
                  {sr.swapped && <span style={{ fontSize:11 }}> → 實際看 {sr.realTarget} 號</span>}
                  ：{sr.isWolf ? "⚠ 狼人陣營" : "✓ 好人陣營"}
                </div>
              )}
              {room.lonegirlTransformed && room.lonegirlNewRole && (
                <div style={{ padding:"3px 8px", borderRadius:"var(--border-radius-md)",
                  background:room.lonegirlNewRole==="wolf"?clr.dangerBg:clr.infoBg,
                  color:room.lonegirlNewRole==="wolf"?clr.danger:clr.info, fontSize:12 }}>
                  🌟 孤獨少女已轉變為 {ROLE_MAP[room.lonegirlNewRole]?.label||room.lonegirlNewRole}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── 步驟卡片 ── */}
      {currentStep ? (()=>{ try {
        const role = ROLE_MAP[currentStep.roleId];
        const act  = currentStep.action;
        const rc   = ROLE_COLORS[currentStep.roleId] || { bg: clr.infoBg, text: clr.info };
        const knownOwners = roleOwners(currentStep.roleId);
        const witchChoice = na.witchChoice;
        const isWolfCamp  = role?.camp === "wolf";

        // Wolf composition — calculated safely outside JSX
        const curPreset  = PRESETS.find(p=>p.id===room.preset)||PRESETS[0];
        const hasWolf2   = curPreset.roles.includes("wolf2");
        const wolfCount  = curPreset.roles.filter(rid=>rid==="wolf").length;
        const wolf2Sel   = na["id_wolf2"]||[];
        const wolfSel    = na["id_wolf"]||[];

        return (
          <div style={{ padding:"12px 14px", borderRadius:"var(--border-radius-md)",
            border:`1.5px solid ${rc?.text||clr.info}`, background:rc?.bg||clr.infoBg, marginBottom:14 }}>

            {/* Header */}
            <div style={{ fontSize:14, fontWeight:500, color:rc?.text||clr.info, marginBottom:4 }}>
              {role?.emoji} {currentStep.label}
            </div>
            {currentStep.firstNightOnly && (
              <div style={{ fontSize:11, color:clr.warn, marginBottom:6 }}>★ 僅首夜行動</div>
            )}
            {currentStep.note && (
              <div style={{ fontSize:12, color:clr.text2, marginBottom:8,
                padding:"4px 8px", borderRadius:"var(--border-radius-md)", background:"rgba(0,0,0,0.04)" }}>
                📌 {currentStep.note}
              </div>
            )}

            {/* ① 首夜：所有角色都要輸入玩家號碼 */}
            {isFirstNight && (
              <div style={{ marginBottom:14, padding:"8px 10px",
                borderRadius:"var(--border-radius-md)", background:"rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize:12, fontWeight:500, color:clr.text, marginBottom:6 }}>
                  ① 角色玩家號碼
                </div>
                {isWolfCamp ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {hasWolf2 && (
                      <div>
                        <div style={{ fontSize:12, color:clr.text2, marginBottom:4 }}>
                          👑 狼王（限選 1 人）
                          {wolf2Sel.length>1 && <span style={{ color:clr.danger, marginLeft:6 }}>⚠ 只能選 1 人</span>}
                        </div>
                        <NightPickBtn
                          stateKey="id_wolf2" multi={true}
                          label="" opts={aliveNums.filter(n=>!wolfSel.includes(n))}
                          na={na} setNightActions={setNightActions}
                        />
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize:12, color:clr.text2, marginBottom:4 }}>
                        🐺 狼人（限選 {wolfCount} 人）
                        {wolfSel.length>wolfCount && <span style={{ color:clr.danger, marginLeft:6 }}>⚠ 最多 {wolfCount} 人</span>}
                      </div>
                      <NightPickBtn
                        stateKey="id_wolf" multi={true}
                        label="" opts={aliveNums.filter(n=>!wolf2Sel.includes(n))}
                        na={na} setNightActions={setNightActions}
                      />
                    </div>
                  </div>
                ) : (
                  <NightPickBtn
                    stateKey={`id_${currentStep.roleId}`}
                    multi={false}
                    label={`${role?.label} 是幾號？`}
                    opts={aliveNums}
                    na={na}
                    setNightActions={setNightActions}
                  />
                )}
              </div>
            )}

            {/* 非首夜：顯示已知號碼 */}
            {!isFirstNight && knownOwners.length>0 && (
              <div style={{ marginBottom:10, padding:"6px 10px",
                borderRadius:"var(--border-radius-md)", background:"rgba(0,0,0,0.05)",
                fontSize:13, color:rc?.text||clr.info }}>
                {role?.label}：{knownOwners.join("、")} 號
              </div>
            )}

            {/* ② 技能施放 */}
            {act && (
              <div style={{
                borderTop: isFirstNight ? `0.5px solid rgba(0,0,0,0.08)` : "none",
                paddingTop: isFirstNight ? 10 : 0,
              }}>
                {isFirstNight && (
                  <div style={{ fontSize:12, fontWeight:500, color:clr.text, marginBottom:6 }}>
                    ② 技能施放目標
                  </div>
                )}

                {/* WITCH：擇一技能再選目標 */}
                {act.isWitch && (() => {
                  // 首夜：從 UI 輸入的女巫號碼判斷（room.roles 尚未寫入）
                  // 非首夜：從 room.roles 讀取
                  const witchNum = isFirstNight
                    ? (na["id_witch"]||[])[0]
                    : roleOwners("witch")[0];
                  const witchKilled = wolfKill && witchNum && Number(wolfKill) === Number(witchNum);
                  const canSave  = wolfKill && !witchKilled && !room.witchSaveUsed;
                  const canPoison = !room.witchPoisonUsed;
                  const availSkills = WITCH_SKILLS.filter(s => {
                    if (s.key==="save")   return canSave;
                    if (s.key==="poison") return canPoison;
                    return true;  // "skip" always available
                  });
                  return (
                    <div>
                      <div style={{ fontSize:12, color:clr.text2, marginBottom:4 }}>
                        今晚被殺：<strong>{wolfKill?`${wolfKill} 號`:"無（平安夜）"}</strong>
                        {witchKilled && <span style={{ color:clr.danger, marginLeft:6 }}>（女巫本人！不可自救）</span>}
                      </div>
                      <div style={{ display:"flex", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                        <span style={{ fontSize:12, color:room.witchSaveUsed?clr.danger:clr.success }}>
                          💊 解藥：{room.witchSaveUsed?"已用完":"剩餘 1 次"}
                        </span>
                        <span style={{ fontSize:12, color:room.witchPoisonUsed?clr.danger:clr.success }}>
                          ☠ 毒藥：{room.witchPoisonUsed?"已用完":"剩餘 1 次"}
                        </span>
                      </div>
                      <div style={{ fontSize:12, color:clr.text2, marginBottom:2 }}>請選擇使用哪項技能</div>
                      <NightChoiceBtn choices={availSkills} stateKey="witchChoice" na={na} setNightActions={setNightActions} />
                      {witchChoice==="save" && canSave && (
                        <div style={{ marginTop:8, padding:"6px 10px", borderRadius:"var(--border-radius-md)",
                          background:clr.successBg, fontSize:13, color:clr.success }}>
                          💊 自動救回 <strong>{wolfKill} 號</strong>（被殺玩家）
                        </div>
                      )}
                      {witchChoice==="poison" && (
                        <div style={{ marginTop:10 }}>
                          <NightPickBtn stateKey="witchTarget" multi={false}
                            label="選擇毒殺目標" opts={aliveNums} na={na} setNightActions={setNightActions} />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* SWAP（魔術師）：選兩人，已用過的號碼不可再選 */}
                {act.isSwap && (() => {
                  const usedNums = room.swapHistory||[];
                  const swapOpts = aliveNums.filter(n=>!usedNums.includes(n));
                  return (
                  <div>
                    {usedNums.length>0 && (
                      <div style={{ fontSize:12, color:clr.text3, marginBottom:6 }}>
                        已用過（不可選）：{usedNums.join("、")} 號
                      </div>
                    )}
                    <NightPickBtn stateKey="swap" multi={true} label="選擇互換的兩名玩家（點選兩人）" opts={swapOpts} na={na} setNightActions={setNightActions} />
                    {swapPreview && (
                      <div style={{ marginTop:8, fontSize:13, fontWeight:500, color:rc?.text||clr.info,
                        padding:"6px 10px", borderRadius:"var(--border-radius-md)", background:"rgba(0,0,0,0.06)" }}>
                        🎩 互換預覽：{swapPreview}
                      </div>
                    )}
                    {swapSel.length>2 && (
                      <div style={{ fontSize:12, color:clr.danger, marginTop:4 }}>只能選兩人，請重新選擇</div>
                    )}
                  </div>
                  );
                })()}

                {/* GRANT（奇蹟商人）：先選技能種類，再選授予目標 */}
                {act.isGrant && (
                  <div>
                    <div style={{ fontSize:12, color:clr.text2, marginBottom:2 }}>選擇授予的技能種類</div>
                    <NightChoiceBtn
                      choices={GRANT_SKILLS.map(g=>({key:g.key,label:`${g.emoji} ${g.label}`}))}
                      stateKey="grantSkill_choice" na={na} setNightActions={setNightActions} />
                    {na.grantSkill_choice && (
                      <div style={{ marginTop:10 }}>
                        <NightPickBtn stateKey="grant" multi={false} label="選擇授予的玩家" opts={aliveNums} na={na} setNightActions={setNightActions} />
                      </div>
                    )}
                    {na.grant?.[0] && na.grantSkill_choice && (
                      <div style={{ marginTop:8, fontSize:13, color:clr.success }}>
                        ✓ {na.grant[0]} 號 獲得 {GRANT_SKILLS.find(g=>g.key===na.grantSkill_choice)?.label}
                      </div>
                    )}
                  </div>
                )}

                {/* LUCKY（幸運兒）：自動帶入奇蹟商人指定的號碼，確認是否為狼陣營 */}
                {currentStep.roleId==="lucky" && !act.isGrant && !act.isWitch && !act.isSwap && !act.isGuard && (() => {
                  const luckyNum    = room.night?.grant?.[0] || null;
                  const luckyRole   = luckyNum ? room.roles?.[`p${luckyNum}`] : null;
                  const luckyIsWolf = luckyRole ? ROLE_MAP[luckyRole]?.camp==="wolf" : false;
                  const merchantNums= roleOwners("merchant");
                  const merchantNum = merchantNums[0];
                  return (
                    <div>
                      {luckyNum ? (
                        <div style={{ padding:"8px 10px", borderRadius:"var(--border-radius-md)",
                          background: luckyIsWolf ? clr.dangerBg : clr.successBg,
                          marginBottom:10 }}>
                          <div style={{ fontSize:13, fontWeight:500,
                            color: luckyIsWolf ? clr.danger : clr.success }}>
                            🍀 幸運兒：{luckyNum} 號
                            {luckyIsWolf
                              ? `（狼陣營！技能無效，奇蹟商人 ${merchantNum} 號將死亡）`
                              : "（技能生效）"}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize:12, color:clr.text3 }}>奇蹟商人本夜未授予技能，跳過</div>
                      )}
                      {luckyNum && !luckyIsWolf && (
                        <NightPickBtn stateKey="lucky" multi={false}
                          label={`幸運兒使用技能目標（${GRANT_SKILLS.find(g=>g.key===room.night?.grantSkill?.[0])?.label||"技能"}）`}
                          opts={aliveNums} na={na} setNightActions={setNightActions} />
                      )}
                    </div>
                  );
                })()}

                {/* 守衛：選目標 + 空放選項 */}
                {act.isGuard && (
                  <div>
                    <NightPickBtn stateKey="guard" multi={false} label="請選擇守護目標（可空放）" opts={aliveNums} na={na} setNightActions={setNightActions} />
                    <button
                      onClick={()=>setNightActions(prev=>({...prev, guard:[]}))}
                      style={{ marginTop:8, ...btn((!na.guard||na.guard.length===0)?"warn":"default"), fontSize:12, padding:"5px 12px" }}>
                      空放（不守護任何人）
                    </button>
                    {na.guard?.length===0 && (
                      <div style={{ fontSize:12, color:clr.warn, marginTop:6 }}>✓ 守衛選擇空放</div>
                    )}
                  </div>
                )}

                {/* 一般目標 */}
                {!act.isWitch && !act.isSwap && !act.isGrant && !act.isGuard && (
                  <div>
                    <NightPickBtn stateKey={act.key} multi={act.multi||false} label={act.label} opts={aliveNums} na={na} setNightActions={setNightActions} />

                    {/* 預言家：選完目標後即時顯示查驗結果 */}
                    {currentStep.roleId==="seer" && na.check?.[0] && (() => {
                      // swap 來源：魔術師先行動，swap 已存入 room.night；首夜亦同
                      const swap = room.night?.swap?.length===2 ? room.night.swap : null;
                      const checkTarget = na.check[0];
                      const realTarget  = swapTarget(checkTarget, swap);

                      // 判斷陣營：優先從 room.roles 讀；首夜若尚未寫入，從 na["id_*"] 推算
                      let roleId = room.roles?.[`p${realTarget}`];
                      if (!roleId && isFirstNight) {
                        // 首夜：從本步驟前已填入的 na 識別資訊推算
                        const wolf2List = na["id_wolf2"]||[];
                        const wolfList  = na["id_wolf"]||[];
                        // 其他角色的 id_* key
                        const allRoleIds = Object.keys(ROLE_MAP).filter(r=>r!=="wolf"&&r!=="wolf2");
                        if (wolf2List.includes(realTarget)) roleId = "wolf2";
                        else if (wolfList.includes(realTarget)) roleId = "wolf";
                        else {
                          for (const rid of allRoleIds) {
                            if ((na[`id_${rid}`]||[]).includes(realTarget)) { roleId = rid; break; }
                          }
                        }
                      }

                      const camp    = ROLE_MAP[roleId]?.camp;
                      const isWolf  = camp === "wolf";
                      // 非狼陣營（包含 camp 未知）一律顯示好人
                      const unknown = !roleId;  // 完全沒有角色資訊才顯示待確認
                      const swapped = realTarget !== checkTarget;

                      return (
                        <div style={{ marginTop:10, padding:"8px 12px", borderRadius:"var(--border-radius-md)",
                          background: unknown ? clr.bg3 : isWolf ? clr.dangerBg : clr.successBg,
                          border: `0.5px solid ${unknown ? clr.border : isWolf ? clr.danger : clr.success}` }}>
                          <div style={{ fontSize:13, fontWeight:500,
                            color: unknown ? clr.text2 : isWolf ? clr.danger : clr.success }}>
                            🔮 查驗 {checkTarget} 號
                            {swapped && (
                              <span style={{ fontSize:12, fontWeight:400, marginLeft:6 }}>
                                （魔術師互換 → 實際看 {realTarget} 號）
                              </span>
                            )}
                            {!unknown && <>：{isWolf ? "⚠ 狼人陣營" : "✓ 好人陣營"}</>}
                            {unknown && "：陣營待確認（請先填入角色號碼）"}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* 無行動（獵人等），首夜仍顯示號碼輸入完即可 */}
            {!act && !isFirstNight && (() => {
              if (currentStep.roleId !== "hunter") {
                return <div style={{ fontSize:12, color:clr.text3, fontStyle:"italic" }}>此角色夜晚無行動，請閉眼</div>;
              }
              // 獵人：判斷是否能開槍
              // 獵人被女巫毒藥命中（考慮魔術師 swap）→ 不能開槍
              const swap = room.night?.swap?.length===2 ? room.night.swap : null;
              // 女巫毒藥目標（原始，未 swap）
              const poisonRaw = room.night?.witchPoison?.[0];
              // 毒藥實際作用目標（經 swap）
              const poisonReal = swapTarget(poisonRaw, swap);
              // 獵人號碼
              const hunterNum = isFirstNight
                ? (na["id_hunter"]||[])[0]
                : roleOwners("hunter")[0];
              // 獵人被毒殺：毒藥實際打到獵人
              const hunterPoisoned = hunterNum && poisonReal === hunterNum;
              const canShoot = !hunterPoisoned;
              return (
                <div style={{ padding:"8px 12px", borderRadius:"var(--border-radius-md)",
                  background: canShoot ? clr.successBg : clr.dangerBg,
                  border: `0.5px solid ${canShoot ? clr.success : clr.danger}` }}>
                  <div style={{ fontSize:13, fontWeight:500,
                    color: canShoot ? clr.success : clr.danger }}>
                    🏹 獵人開槍狀態：{canShoot ? "✓ 可以開槍" : "✗ 被毒殺，不能開槍"}
                  </div>
                  {hunterPoisoned && (
                    <div style={{ fontSize:12, color:clr.danger, marginTop:4 }}>
                      女巫毒藥命中獵人（{hunterNum} 號）{swap && poisonRaw !== poisonReal ? `，經魔術師互換（原目標 ${poisonRaw} 號）` : ""}
                    </div>
                  )}
                  {!hunterNum && (
                    <div style={{ fontSize:12, color:clr.text3, marginTop:4 }}>（獵人號碼未確認，請於下一夜首先確認）</div>
                  )}
                </div>
              );
            })()}

            <div style={{ marginTop:14, display:"flex", gap:8, alignItems:"center" }}>
              <button disabled={isSaving} onClick={advanceStep} style={{ ...btn("primary", isSaving) }}>
                {isSaving ? "儲存中..." : stepIdx>=order.length-1?"完成最後一步 →":"下一步 →"}
              </button>
              {stepIdx>0 && (
                <button disabled={isSaving} onClick={goBack} style={{ ...btn("default", isSaving), fontSize:13 }}>
                  ← 上一步
                </button>
              )}
            </div>
          </div>
        );
      } catch(e) { return <div style={{ color:clr.danger, fontSize:13, padding:8 }}>渲染錯誤：{e.message}</div>; }
      })() : (
        /* 全部完成 */
        <div style={{ padding:"12px 14px", borderRadius:"var(--border-radius-md)", background:clr.successBg, marginBottom:14 }}>
          <div style={{ fontSize:13, color:clr.success, fontWeight:500, marginBottom:10 }}>✓ 所有角色行動完畢</div>
          <div style={{ fontSize:12, color:clr.text2, marginBottom:12, display:"flex", flexDirection:"column", gap:3 }}>
            {night.kill?.[0]        && <div>🐺 狼殺目標：{night.kill[0]} 號</div>}
            {night.guard?.[0]       && <div>🛡 守衛守護：{night.guard[0]} 號</div>}
            {night.dream?.[0]       && <div>🌙 攝夢目標：{night.dream[0]} 號</div>}
            {night.witchSave?.[0]   && <div>💊 女巫救人：{night.witchSave[0]} 號</div>}
            {night.witchPoison?.[0] && <div>☠ 女巫毒殺：{night.witchPoison[0]} 號</div>}
            {night.swap?.length===2 && <div>🎩 魔術師互換：{night.swap[0]} 號 ↔ {night.swap[1]} 號</div>}
            {night.grant?.[0]       && <div>🛒 商人授予 {night.grant[0]} 號：{GRANT_SKILLS.find(g=>g.key===night.grantSkill?.[0])?.label||"技能"}</div>}
            {night.idol?.[0]        && <div>💘 偶像：{night.idol[0]} 號</div>}
            {room.lonegirlTransformed && room.lonegirlNewRole && (() => {
              const lonegirlNum = Object.entries(room.roles||{})
                .find(([,v])=>v===room.lonegirlNewRole && room.lonegirlNewRole!=="lonegirl")?.[0]?.replace("p","");
              return (
                <div style={{ padding:"4px 8px", borderRadius:"var(--border-radius-md)",
                  background: room.lonegirlNewRole==="wolf"?clr.dangerBg:clr.infoBg,
                  color: room.lonegirlNewRole==="wolf"?clr.danger:clr.info, fontSize:12 }}>
                  🌟 孤獨少女已轉變為 {ROLE_MAP[room.lonegirlNewRole]?.label||room.lonegirlNewRole}
                  {room.lonegirlNewRole==="wolf" && "（狼人陣營）"}
                </div>
              );
            })()}
            {night.check?.[0] && (() => {
              const sr = getSeerResult(night.check[0], night.swap?.length===2?night.swap:null, room.roles||{});
              return (
                <div style={{ padding:"6px 10px", borderRadius:"var(--border-radius-md)",
                  background: sr.isWolf ? clr.dangerBg : clr.successBg }}>
                  <span style={{ fontSize:13, fontWeight:500,
                    color: sr.isWolf ? clr.danger : clr.success }}>
                    🔮 預言家查驗 {sr.checkTarget} 號
                    {sr.swapped && <span style={{ fontSize:12 }}>（魔術師互換 → 實際看 {sr.realTarget} 號）</span>}
                    ：{sr.camp ? (sr.isWolf ? "⚠ 狼人陣營" : "✓ 好人陣營") : "（陣營未知）"}
                  </span>
                </div>
              );
            })()}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button disabled={isSaving}
              onClick={async()=>{ setIsSaving(true); try{ await godAction("resolveNight"); setNa({}); }finally{setIsSaving(false);} }}
              style={{ ...btn("success", isSaving) }}>
              {isSaving?"儲存中...":"結算夜晚・公布死訊"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════
// Main App
// ══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen,     setScreen]     = useState("home");
  const [roomCode,   setRoomCode]   = useState("");
  const [inputCode,  setInputCode]  = useState("");
  const [myNum,      setMyNum]      = useState(null);
  const [isGod,      setIsGod]      = useState(false);
  const [room,       setRoom]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [godInput,   setGodInput]   = useState({});
  const [myVote,     setMyVote]     = useState(null);
  const [voted,      setVoted]      = useState(false);
  const pollRef     = useRef(null);
  const prevPhaseRef= useRef(null);

  const poll = useCallback(async () => {
    if (!roomCode) return;
    const r = await loadRoom(roomCode);
    if (r) setRoom(prev => prev?.updatedAt===r.updatedAt ? prev : r);
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [roomCode, poll]);

  useEffect(() => {
    if (!room) return;
    if (prevPhaseRef.current !== room.phase) {
      setMyVote(null); setVoted(false);
      prevPhaseRef.current = room.phase;
    }
  }, [room?.phase]);

  // ── Create / Join ───────────────────────────────────────────────────────
  async function createRoom() {
    setLoading(true); setError("");
    const code   = genRoomCode();
    const presetId = godInput.selectedPreset || "std";
    const preset = PRESETS.find(p=>p.id===presetId)||PRESETS[0];
    const r      = defaultRoom(code, presetId);
    r.log.push(`建立對局，版型：${preset.label}`);
    await saveRoom(r);
    setRoomCode(code); setIsGod(true); setRoom(r); setScreen("god");
    setLoading(false);
  }

  async function joinRoom() {
    setError("");
    if (!inputCode.trim()) return setError("請輸入房號");
    const code = inputCode.toUpperCase().trim();
    const r    = await loadRoom(code);
    if (!r) return setError("找不到房間，請確認房號");
    setRoomCode(code); setRoom(r); setScreen("join");
  }

  async function selectSeat(n) {
    const r = await loadRoom(roomCode);
    if (!r.players[`p${n}`]) {
      r.players[`p${n}`] = { num:n, dead:false };
      r.log.push(`玩家選擇了 ${n} 號座位`);
      await saveRoom(r);
    }
    setMyNum(n); setRoom(r); setScreen("player");
  }

  async function rejoinAsGod() { setIsGod(true); setScreen("god"); }

  // ── God actions ─────────────────────────────────────────────────────────
  async function godAction(action, payload={}) {
    setError(""); setLoading(true);
    try {
      const r = await loadRoom(roomCode);
      if (!r) {
        setError("無法載入房間資料，請確認 Firebase URL 設定正確，或重新整理後再試");
        return;
      }
      const aliveNums = () => Array.from({length:12},(_,i)=>i+1)
        .filter(n=>!Object.values(r.players||{}).find(p=>p.num===n)?.dead);

      // Ensure all nested objects exist (Firebase may omit empty objects)
      if (!r.roles)       r.roles       = {};
      if (!r.swapHistory)     r.swapHistory     = [];
      if (r.witchSaveUsed   === undefined) r.witchSaveUsed   = false;
      if (r.witchPoisonUsed === undefined) r.witchPoisonUsed = false;
      if (r.idiotRevealed      === undefined) r.idiotRevealed      = false;
      if (r.lonegirlIdol       === undefined) r.lonegirlIdol       = null;
      if (r.lonegirlTransformed=== undefined) r.lonegirlTransformed= false;
      if (r.lonegirlNewRole    === undefined) r.lonegirlNewRole    = null;
      if (!r.players)  r.players  = {};
      if (!r.night)    r.night    = { kill:[], guard:[], check:[], witchSave:[], witchPoison:[], hunter:[] };
      if (!r.campaign) r.campaign = { candidates:[], speakers:[], speakerDir:null, currentSpeaker:null, finalCandidates:[], votes:{}, pkRound:false, pkCandidates:[], result:null, votesPublished:false };
      if (!r.exile)    r.exile    = { targetOptions:[], votes:{}, result:null, published:false };
      if (!r.voteHistory)  r.voteHistory  = [];
      if (!r.nightHistory) r.nightHistory = [];
      if (!r.log)      r.log      = [];
      if (r.wolfBoomCount   === undefined) r.wolfBoomCount   = 0;
      if (r.campaignPaused  === undefined) r.campaignPaused  = false;
      if (r.campaignResuming=== undefined) r.campaignResuming= false;

      switch (action) {

        case "startCampaign": {
          const cands = payload.candidates;
          if (!cands?.length) return setError("請選擇上警玩家");
          const shuffled=shuffle(cands), starter=shuffled[0], dir=Math.random()>.5?"順時針":"逆時針";
          r.campaign.candidates=cands; r.campaign.speakers=shuffled;
          r.campaign.currentSpeaker=starter; r.campaign.speakerDir=dir;
          r.phase="campaign";
          r.log.push(`上警：${cands.join("、")} 號，首發：${starter} 號，方向：${dir}`);
          break;
        }

        case "finalizeCandidates": {
          const finals=payload.finals;
          if (!finals?.length) return setError("請選擇最終競選玩家");
          r.campaign.finalCandidates=finals; r.campaign.votes={}; r.phase="campaignVote";
          r.log.push(`最終競選：${finals.join("、")} 號，開始投票`);
          break;
        }

        case "tallyVotes": {
          const votes=r.campaign.votes;
          const finals=r.campaign.pkRound?r.campaign.pkCandidates:r.campaign.finalCandidates;
          const tally={}; finals.forEach(n=>tally[n]=0); tally[0]=0;
          Object.entries(votes||{}).forEach(([voter,target]) => {
            const w=Number(voter)===r.sheriff?1.5:1;
            if (tally[target]!==undefined) tally[target]+=w; else tally[target]=w;
          });
          const maxV=Math.max(...finals.map(n=>tally[n]||0));
          const winners=finals.filter(n=>(tally[n]||0)===maxV);
          const lbl=r.campaign.pkRound?"警長競選 PK":"警長競選";
          if (winners.length===1) {
            r.sheriff=winners[0];
            r.campaign.result={ winner:winners[0], tally };
            r.campaign.votesPublished=true;
            r.voteHistory.push({ type:"campaign", label:lbl, candidates:finals, votes:{...votes}, tally, winner:winners[0] });
            r.phase="campaignVote";
            r.log.push(`${winners[0]} 號當選警長！`);
          } else if (r.campaign.pkRound) {
            r.sheriff=null; r.sheriffBadgeLost=true;
            r.campaign.result={ winner:null, tally, pkLost:true };
            r.campaign.votesPublished=true;
            r.voteHistory.push({ type:"campaign", label:lbl, candidates:finals, votes:{...votes}, tally, winner:null, pkLost:true });
            const fp=shuffle(aliveNums())[0], fd=Math.random()>.5?"順時針":"逆時針";
            r.firstSpeaker=fp; r.firstSpeakerDir=fd;
            r.phase="campaignVote";
            r.log.push(`再次平票，警徽流失！首發：${fp} 號，方向：${fd}`);
          } else {
            r.campaign.pkRound=true; r.campaign.pkCandidates=winners; r.campaign.votes={};
            r.campaign.result=null; r.campaign.votesPublished=true;
            r.voteHistory.push({ type:"campaign", label:"警長競選（首輪）", candidates:finals, votes:{...votes}, tally, pk:true, pkCandidates:winners });
            r.phase="campaignPK";
            r.log.push(`平票！PK：${winners.join("、")} 號`);
          }
          break;
        }

        case "startPK": {
          r.campaign.votes={}; r.campaign.votesPublished=false;
          r.log.push(`PK 開始：${r.campaign.pkCandidates.join("、")} 號`);
          break;
        }

        case "resumeFinalizeCandidates": {
          const finals = payload.finals;
          if (!finals?.length) return setError("請選擇繼續競選的玩家");
          r.campaign.finalCandidates = finals;
          r.campaign.votes = {}; r.campaign.pkRound = false;
          r.campaign.pkCandidates = []; r.campaign.result = null;
          r.campaign.votesPublished = false;
          r.campaignPaused = false; r.campaignResuming = false;
          r.phase = "campaignVote";
          r.log.push(`繼續警長競選，最終名單：${finals.join("、")} 號，開始投票`);
          break;
        }

        case "setRoles": {
          r.roles=payload.roles; r.log.push("角色設定完畢"); break;
        }

        case "startNight": {
          r.phase="night"; r.nightStep=0;
          r.night={ kill:[], guard:[], check:[], witchSave:[], witchPoison:[], hunter:[] };
          r.log.push(`第 ${r.dayCount} 夜開始`); break;
        }

        case "saveNightStep": {
          console.log("saveNightStep payload:", JSON.stringify(payload));
          if (!r.night) r.night={ kill:[], guard:[], check:[], witchSave:[], witchPoison:[], hunter:[] };
          if (!r.roles) r.roles={};
          const d = payload.data||{};
          // Handle wolf identity split
          if (d._wolfIdentify) {
            const wi = d._wolfIdentify;
            wi.wolf2.forEach(n => { r.roles[`p${n}`]="wolf2"; });
            wi.wolf.forEach(n  => { r.roles[`p${n}`]="wolf";  });
            const cleaned = { ...d };
            delete cleaned._wolfIdentify;
            Object.entries(cleaned).forEach(([k,v]) => r.night[k]=v);
          } else {
            Object.entries(d).forEach(([k,v]) => r.night[k]=v);
            if (payload.roleId && payload.nums?.length) {
              payload.nums.forEach(n => { r.roles[`p${n}`]=payload.roleId; });
            }
          }
          // Save lonegirl idol selection to room level
          if (r.night?.idol?.[0] && !r.lonegirlIdol) {
            r.lonegirlIdol = r.night.idol[0];
          }
          r.nightStep = payload.nextStep ?? 0;
          console.log("nightStep set to:", r.nightStep);
          break;
        }

        case "resolveNight": {
          const deaths=computeNightDeaths(r.night, r.lastDreamTarget||null);
          // Update lastDreamTarget for next night's consecutive-dream check
          r.lastDreamTarget = r.night?.dream?.[0] || null;
          // Save magician swap to history (used numbers cannot be reused)
          if (r.night?.swap?.length===2) {
            if (!r.swapHistory) r.swapHistory=[];
            r.swapHistory.push(...r.night.swap);
          }
          // Mark witch potions as used if they were used this night
          if (r.night?.witchSave?.[0])   r.witchSaveUsed   = true;
          if (r.night?.witchPoison?.[0]) r.witchPoisonUsed = true;
          deaths.forEach(d => {
            if (!r.players[`p${d.num}`]) r.players[`p${d.num}`]={ num:d.num, dead:false };
            r.players[`p${d.num}`].dead=true;
          });
          const wasFirstNight = !r.rolesRevealed;
          // fill unassigned as village (only on first night)
          if (wasFirstNight) {
            Array.from({length:12},(_,i)=>i+1).forEach(n => { if (!r.roles[`p${n}`]) r.roles[`p${n}`]="village"; });
            r.rolesRevealed=true;
          }
          r.night.resolved=true; r.night.deaths=deaths;
          // Save night snapshot to persistent history
          if (!r.nightHistory) r.nightHistory=[];
          r.nightHistory.push({
            label: `第 ${r.dayCount} 夜`,
            deaths,
            kill:         r.night.kill?.[0]        || null,
            guard:        r.night.guard?.[0]        || null,
            dream:        r.night.dream?.[0]        || null,
            witchSave:    r.night.witchSave?.[0]    || null,
            witchPoison:  r.night.witchPoison?.[0]  || null,
            swap:         r.night.swap?.length===2  ? r.night.swap : null,
            grant:        r.night.grant?.[0]        || null,
            grantSkill:   r.night.grantSkill?.[0]   || null,
            lucky:        r.night.lucky?.[0]        || null,
            idol:         r.night.idol?.[0]         || null,
            check:        r.night.check?.[0]        || null,
            lonegirlTransformed: r.lonegirlTransformed || false,
            lonegirlNewRole:     r.lonegirlNewRole     || null,
            roles: { ...r.roles },  // snapshot of roles at time of resolution
          });

          // 覺醒孤獨少女：偶像夜晚死亡 → 繼承偶像角色（下一夜生效）
          if (r.lonegirlIdol && !r.lonegirlTransformed) {
            const idolDied = deaths.find(d=>d.num===Number(r.lonegirlIdol));
            if (idolDied) {
              const idolRoleId = r.roles?.[`p${r.lonegirlIdol}`];
              const lonegirlNum = Object.entries(r.roles||{})
                .find(([,v])=>v==="lonegirl")?.[0]?.replace("p","");
              const lonegirlAlive = lonegirlNum &&
                !deaths.find(d=>d.num===Number(lonegirlNum)) &&
                !Object.values(r.players||{}).find(p=>p.num===Number(lonegirlNum))?.dead;
              if (lonegirlNum && lonegirlAlive && idolRoleId) {
                r.lonegirlTransformed = true;
                r.lonegirlNewRole = idolRoleId;
                r.roles[`p${lonegirlNum}`] = idolRoleId;

                if (idolRoleId === "witch") {
                  // 繼承女巫：解藥未用則繼承全套；已用則只有毒藥
                  if (r.witchSaveUsed) {
                    r.log.push(`覺醒孤獨少女（${lonegirlNum} 號）繼承偶像女巫身份，獲得毒藥技能（解藥已耗盡）`);
                  } else {
                    r.witchSaveUsed = false;
                    r.log.push(`覺醒孤獨少女（${lonegirlNum} 號）繼承偶像女巫身份，獲得解藥與毒藥技能`);
                  }
                } else if (idolRoleId === "seer") {
                  // 繼承預言家：直接繼承查驗能力，無特殊狀態
                  r.log.push(`覺醒孤獨少女（${lonegirlNum} 號）繼承偶像預言家身份，獲得查驗技能`);
                } else if (idolRoleId === "hunter") {
                  // 繼承獵人：擁有開槍能力（被毒殺才失效，邏輯已在 GodNightPanel 處理）
                  r.log.push(`覺醒孤獨少女（${lonegirlNum} 號）繼承偶像獵人身份，獲得開槍技能`);
                } else if (idolRoleId === "dreamer") {
                  // 繼承攝夢人：重置 lastDreamTarget（換人攝夢，連續攝夢計數歸零）
                  r.lastDreamTarget = null;
                  r.log.push(`覺醒孤獨少女（${lonegirlNum} 號）繼承偶像攝夢人身份，連續攝夢計數重置`);
                } else {
                  r.log.push(`覺醒孤獨少女（${lonegirlNum} 號）繼承偶像（${r.lonegirlIdol} 號）${ROLE_MAP[idolRoleId]?.label||idolRoleId}身份`);
                }
              }
            }
          }

          r.log.push(deaths.length===0?"夜晚平安，無人出局":`夜晚出局：${deaths.map(d=>d.num+"號("+d.reason+")").join("、")}`);
          if (wasFirstNight) {
            r.phase="lobby";
            r.log.push("首夜結束，開始警長競選");
          } else if (r.campaignPaused) {
            // Wolf boomed during campaign → resume campaign next day
            r.phase="lobby";  // reuse lobby phase for campaign resumption
            r.campaignResuming = true;
            r.log.push(`第 ${r.dayCount} 天白天，繼續警長競選`);
          } else {
            r.phase="day"; r.exile.votes={}; r.exile.result=null; r.exile.published=false;
            r.exile.targetOptions=aliveNums();
            r.log.push(`第 ${r.dayCount} 天白天開始`);
          }
          break;
        }

        case "tallyExile": {
          const votes=r.exile.votes, targets=r.exile.targetOptions;
          const tally={}; targets.forEach(n=>tally[n]=0); tally[0]=0;
          Object.entries(votes||{}).forEach(([voter,target]) => {
            const w=Number(voter)===r.sheriff?1.5:1;
            if (tally[target]!==undefined) tally[target]+=w; else tally[target]=w;
          });
          const maxV=Math.max(...targets.map(n=>tally[n]||0));
          const tied=targets.filter(n=>(tally[n]||0)===maxV);
          const dayLabel=`第 ${r.dayCount} 天放逐`;
          if (tied.length===1) {
            const exiled=tied[0];
            const exiledRoleId = r.roles?.[`p${exiled}`];
            const exiledIsIdiot = exiledRoleId==="idiot" && !r.idiotRevealed;

            // 覺醒孤獨少女：偶像白天被放逐 → 孤獨少女轉為狼人
            const lonegirlNum = Object.entries(r.roles||{})
              .find(([,v])=>v==="lonegirl")?.[0]?.replace("p","");
            const lonegirlAlive = lonegirlNum &&
              !Object.values(r.players||{}).find(p=>p.num===Number(lonegirlNum))?.dead;
            if (r.lonegirlIdol && Number(r.lonegirlIdol)===exiled &&
                !r.lonegirlTransformed && lonegirlNum && lonegirlAlive) {
              r.lonegirlTransformed = true;
              r.lonegirlNewRole = "wolf";
              r.roles[`p${lonegirlNum}`] = "wolf";
              r.log.push(`覺醒孤獨少女（${lonegirlNum} 號）的偶像（${exiled} 號）被放逐，孤獨少女轉變為狼人！`);
            }

            if (exiledIsIdiot) {
              // 白癡首次被放逐：亮出身份，不出局，失去投票權
              r.idiotRevealed = true;
              r.exile.result={ exiled, tally, idiotSaved:true }; r.exile.published=true;
              r.voteHistory.push({ type:"exile", label:dayLabel, candidates:targets, votes:{...votes}, tally, exiled, idiotSaved:true });
              r.phase="result"; r.log.push(`${exiled} 號（白癡）被放逐，亮出身份！白癡不出局，但失去投票權`);
            } else {
              if (r.players[`p${exiled}`]) r.players[`p${exiled}`].dead=true;
              r.exile.result={ exiled, tally }; r.exile.published=true;
              r.voteHistory.push({ type:"exile", label:dayLabel, candidates:targets, votes:{...votes}, tally, exiled });
              r.phase="result"; r.log.push(`${exiled} 號被放逐出局`);
            }
          } else {
            r.exile.result={ tied, tally }; r.exile.published=true;
            r.voteHistory.push({ type:"exile", label:dayLabel, candidates:targets, votes:{...votes}, tally, tied });
            r.phase="result"; r.log.push(`平票！${tied.join("、")} 號無人被放逐`);
          }
          r.dayCount++; break;
        }

        case "transferSheriff": {
          r.sheriff=payload.to;
          r.log.push(payload.to?`警徽移交給 ${payload.to} 號`:"警徽銷毀"); break;
        }

        case "startDay": {
          r.phase="day"; r.exile.votes={}; r.exile.result=null; r.exile.published=false;
          r.exile.targetOptions=aliveNums();
          r.log.push(`第 ${r.dayCount} 天白天，開始放逐投票`); break;
        }

        case "startNightNext": {
          r.phase="night"; r.nightStep=0;
          r.night={ kill:[], guard:[], check:[], witchSave:[], witchPoison:[], hunter:[] };
          r.log.push(`第 ${r.dayCount} 夜開始`); break;
        }

        case "skipToNight": {
          const skipFromCampaign = ["campaign","campaignVote","campaignPK","lobby"].includes(r.phase);
          const skipFromDay      = r.phase === "day";
          if (skipFromCampaign || skipFromDay) r.dayCount++;
          // Wolf self-destruct: mark as dead, count booms
          if (payload.wolfBoom) {
            if (!r.players[`p${payload.wolfBoom}`]) r.players[`p${payload.wolfBoom}`]={ num:payload.wolfBoom, dead:false };
            r.players[`p${payload.wolfBoom}`].dead=true;
            r.wolfBoomCount = (r.wolfBoomCount||0) + 1;
            r.log.push(`⚡ ${payload.wolfBoom} 號狼人自爆出局（累計 ${r.wolfBoomCount} 次）`);
          }
          // If campaign was ongoing (not finished) and wolf boomed, mark paused
          // so next day resumes campaign instead of starting fresh
          const campaignOngoing = skipFromCampaign && !r.sheriff && !r.sheriffBadgeLost;
          if (campaignOngoing && payload.wolfBoom) {
            r.campaignPaused = true;
          }
          // Two wolf booms total → badge lost, assign random first speaker
          if (r.wolfBoomCount >= 2 && !r.sheriff && !r.sheriffBadgeLost) {
            r.sheriff = null;
            r.sheriffBadgeLost = true;
            r.campaignPaused = false;
            const alive2 = aliveNums();
            const fp = shuffle(alive2)[0], fd = Math.random()>.5?"順時針":"逆時針";
            r.firstSpeaker = fp; r.firstSpeakerDir = fd;
            r.log.push(`連續兩次狼人自爆，警徽流失！首發：${fp} 號，方向：${fd}`);
          }
          r.phase="night"; r.nightStep=0;
          r.night={ kill:[], guard:[], check:[], witchSave:[], witchPoison:[], hunter:[] };
          r.exile.votes={}; r.exile.result=null; r.exile.published=false;
          r.exile.targetOptions=aliveNums();
          r.log.push(`⚡ 直接進入第 ${r.dayCount} 夜`); break;
        }
      }

      await saveRoom(r); setRoom(r);
    } catch(e) {
      console.error("godAction error:", action, e);
      setError("操作失敗：" + e.message);
    } finally { setLoading(false); }
  }

  async function castVote(target) {
    if (voted) return;
    const r=await loadRoom(roomCode);
    if (!r) return setError("無法載入房間資料，請重新整理");
    // 白癡亮牌後不能投票
    if (r.idiotRevealed) {
      const idiotKey = Object.entries(r.roles||{}).find(([,v])=>v==="idiot")?.[0];
      if (idiotKey && Number(idiotKey.replace("p",""))===myNum) return;
    }
    const voter=myNum;
    if (r.phase==="campaignVote"||r.phase==="campaignPK") {
      r.campaign.votes[voter]=target;
      r.log.push(`${voter} 號投給 ${target===0?"棄票":target+" 號"}`);
    } else if (r.phase==="day") {
      r.exile.votes[voter]=target;
      r.log.push(`${voter} 號放逐票投給 ${target===0?"棄票":target+" 號"}`);
    }
    await saveRoom(r); setRoom(r); setMyVote(target); setVoted(true);
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  const inputStyle = { padding:"10px 14px", borderRadius:"var(--border-radius-md)",
    border:`0.5px solid ${clr.border2}`, background:clr.bg, color:clr.text,
    fontSize:16, width:"100%", boxSizing:"border-box", outline:"none", marginBottom:10 };

  // ── HOME ─────────────────────────────────────────────────────────────────
  if (screen==="home") return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"2rem 1rem" }}>
      <h2 style={{ color:clr.text, marginBottom:4 }}>🐺 狼人殺投票系統</h2>
      <p style={{ color:clr.text2, marginBottom:16, fontSize:14 }}>12人局 · 線下輔助工具</p>

      {!FIREBASE_CONFIGURED && (
        <div style={{ marginBottom:16, padding:"10px 14px", borderRadius:"var(--border-radius-md)",
          background:clr.dangerBg, border:`0.5px solid ${clr.danger}` }}>
          <div style={{ fontSize:13, fontWeight:500, color:clr.danger, marginBottom:4 }}>⚠ Firebase 未設定</div>
          <div style={{ fontSize:12, color:clr.danger }}>
            請在程式碼頂部將 <code>FIREBASE_URL</code> 換成你的 Firebase Realtime Database URL，
            否則所有操作將無法儲存。
          </div>
        </div>
      )}
      <div style={card}>
        <div style={{ fontSize:13, fontWeight:500, color:clr.text, marginBottom:10 }}>選擇版型（上帝建立房間）</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => setGodInput(prev=>({...prev,selectedPreset:p.id}))}
              style={{ textAlign:"left", padding:"10px 14px", borderRadius:"var(--border-radius-md)",
                border:godInput.selectedPreset===p.id?`1.5px solid ${clr.info}`:`0.5px solid ${clr.border2}`,
                background:godInput.selectedPreset===p.id?clr.infoBg:"transparent",
                color:clr.text, cursor:"pointer" }}>
              <div style={{ fontWeight:500, fontSize:14, color:godInput.selectedPreset===p.id?clr.info:clr.text }}>{p.label}</div>
              <div style={{ fontSize:12, color:clr.text3, marginTop:2 }}>{p.desc}</div>
            </button>
          ))}
        </div>
        <button onClick={createRoom} disabled={loading||!godInput.selectedPreset}
          style={{ ...btn("primary",!godInput.selectedPreset), width:"100%", marginBottom:14, padding:12, fontSize:15 }}>
          {loading?"建立中...":"建立新對局（上帝）"}
        </button>
        <div style={{ borderTop:`0.5px solid ${clr.border}`, paddingTop:14 }}>
          <div style={{ fontSize:13, color:clr.text2, marginBottom:8 }}>加入現有對局</div>
          <div style={{ display:"flex", gap:8 }}>
            <input placeholder="輸入房號" value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              style={{ ...inputStyle, marginBottom:0, flex:1 }} />
            <button onClick={joinRoom} style={{ ...btn("default"), whiteSpace:"nowrap" }}>加入</button>
          </div>
        </div>
        {error && <div style={{ color:clr.danger, fontSize:13, marginTop:8 }}>{error}</div>}
      </div>
    </div>
  );

  // ── JOIN ─────────────────────────────────────────────────────────────────
  if (screen==="join" && room) return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"2rem 1rem" }}>
      <h2 style={{ color:clr.text }}>選擇你的號碼</h2>
      <p style={{ color:clr.text2, fontSize:13 }}>房號：<strong>{room.code}</strong></p>
      <div style={card}>
        <button onClick={rejoinAsGod} style={{ ...btn("warn"), width:"100%", padding:"10px 0", fontSize:14, marginBottom:14 }}>
          以上帝身份進入
        </button>
        <div style={{ fontSize:12, color:clr.text3, marginBottom:10, textAlign:"center" }}>— 或選擇玩家號碼 —</div>
        <PlayerGrid room={room} myNum={myNum} onSelect={selectSeat} />
        {error && <div style={{ color:clr.danger, fontSize:13, marginTop:8 }}>{error}</div>}
      </div>
    </div>
  );

  if (!room) return <div style={{ padding:32, color:clr.text2 }}>載入中...</div>;

  const phase=room.phase, campaign=room.campaign, exile=room.exile, sheriff=room.sheriff;

  // ══════════════════════════════════════════════════════════════════════
  // GOD VIEW
  // ══════════════════════════════════════════════════════════════════════
  if (isGod) return (
    <ErrorBoundary>
      <GodView
        room={room} phase={phase} campaign={campaign} exile={exile} sheriff={sheriff}
        loading={loading} error={error} godInput={godInput} setGodInput={setGodInput}
        godAction={godAction}
      />
    </ErrorBoundary>
  );

  // ══════════════════════════════════════════════════════════════════════
  // PLAYER VIEW
  // ══════════════════════════════════════════════════════════════════════
  const isAlive  = !Object.values(room.players||{}).find(p=>p.num===myNum)?.dead;
  const isSheriff= myNum===sheriff;

  return (
    <div style={{ maxWidth:440, margin:"0 auto", padding:"1.5rem 1rem" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <h2 style={{ margin:0, color:clr.text }}>{myNum} 號玩家 {isSheriff&&"⭐"}</h2>
          <span style={{ fontSize:13, color:clr.text2 }}>房號：{room.code}</span>
        </div>
        <span style={tag(phase==="lobby"?"gray":"info")}>{PHASES[phase]||phase}</span>
      </div>

      {/* LOBBY */}
      {phase==="lobby" && !room.rolesRevealed && (
        <div style={card}>
          <div style={{ fontSize:14, color:clr.text2 }}>等待上帝開始遊戲...</div>
          <div style={{ marginTop:12, fontSize:13, color:clr.text3 }}>玩家人數：{Object.keys(room.players||{}).length}/12</div>
        </div>
      )}
      {phase==="lobby" && room.rolesRevealed && (
        <div style={card}>
          {room.sheriffBadgeLost ? (
            <div>
              <div style={{ fontSize:14, fontWeight:500, color:clr.danger }}>⚠ 警徽流失</div>
              <div style={{ fontSize:13, color:clr.text3, marginTop:4 }}>連續兩次狼人自爆，警徽流失</div>
              {room.firstSpeaker && (
                <div style={{ fontSize:13, color:clr.info, marginTop:6 }}>
                  首發：{room.firstSpeaker} 號，方向：{room.firstSpeakerDir}
                </div>
              )}
            </div>
          ) : room.campaignResuming ? (
            <div>
              <div style={{ fontSize:14, fontWeight:500, color:clr.warn }}>⚡ 狼人自爆，繼續警長競選</div>
              <div style={{ fontSize:13, color:clr.text3, marginTop:6 }}>等待警長投票結果...</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:14, fontWeight:500, color:clr.text }}>☀ 第一天・警長競選</div>
              <div style={{ fontSize:13, color:clr.text3, marginTop:6 }}>等待警長競選結果...</div>
              <div style={{ fontSize:12, color:clr.text3, marginTop:4 }}>首夜死訊將於警長選出後公布</div>
            </div>
          )}
        </div>
      )}

      {/* NIGHT */}
      {phase==="night" && (
        <div style={card}>
          <div style={{ fontSize:14, fontWeight:500, color:clr.text }}>🌙 夜晚</div>
          <div style={{ fontSize:13, color:clr.text3, marginTop:6 }}>請閉眼，等待上帝指引...</div>
        </div>
      )}

      {/* Night death banner: shown after sheriff elected (campaign+) and on day phases */}
      {["campaign","campaignVote","campaignPK","day","result"].includes(phase) && room.night?.deaths!=null && room.rolesRevealed && (
        <div style={{ padding:"10px 14px", borderRadius:"var(--border-radius-md)", marginBottom:12,
          background:room.night.deaths.length===0?clr.successBg:clr.dangerBg }}>
          <span style={{ fontSize:13, fontWeight:500, color:room.night.deaths.length===0?clr.success:clr.danger }}>
            {room.night.deaths.length===0?"🌙 首夜平安，無人出局":`🌙 首夜出局：${room.night.deaths.map(d=>d.num+" 號").join("、")}`}
          </span>
        </div>
      )}

      {/* CAMPAIGN INFO */}
      {phase==="campaign" && (
        <div style={card}>
          <div style={{ fontSize:14, fontWeight:500, color:clr.text, marginBottom:8 }}>警長競選·發言環節</div>
          <div style={{ fontSize:13, color:clr.text2 }}>競選玩家：{campaign.candidates.join("、")} 號</div>
          <div style={{ marginTop:6, fontSize:13, color:clr.info }}>首發：{campaign.currentSpeaker} 號，方向：{campaign.speakerDir}</div>
          <div style={{ marginTop:8, fontSize:12, color:clr.text3 }}>等待上帝宣布最終競選名單...</div>
        </div>
      )}

      {/* CAMPAIGN VOTE */}
      {(phase==="campaignVote"||phase==="campaignPK") && !campaign.result && (() => {
        const isPK     = phase==="campaignPK";
        const actCands = isPK?campaign.pkCandidates:campaign.finalCandidates;
        const inelig   = isPK?campaign.pkCandidates:campaign.finalCandidates;
        // 白癡亮牌後失去投票權
        const idiotNum_ = Object.entries(room.roles||{}).find(([,v])=>v==="idiot")?.[0]?.replace("p","");
        const isIdiotLost = room.idiotRevealed && idiotNum_ && Number(idiotNum_)===myNum;
        const isInelig = inelig.includes(myNum) || isIdiotLost;
        const canVote  = isAlive && !isInelig;
        const announcing= isPK && !campaign.votesPublished && Object.keys(campaign?.votes||{}).length===0;
        return (
          <div style={card}>
            <div style={{ fontSize:14, fontWeight:500, color:clr.text, marginBottom:8 }}>
              {isPK?"⚡ 平票 PK 重新投票":"投票選出警長"}
            </div>
            <div style={{ fontSize:13, color:clr.text2, marginBottom:12 }}>
              競選玩家：{actCands.join("、")} 號
              {isInelig && <span style={{ fontSize:12, color:clr.danger, display:"block", marginTop:4 }}>
                {isPK?"你是 PK 玩家，不可投票":"你是警上玩家，不可投票"}</span>}
            </div>
            {announcing ? (
              <div style={{ fontSize:13, color:clr.warn }}>等待上帝宣布 PK 開始...</div>
            ) : canVote && !voted ? (
              <VoteButtons options={[...actCands,0]} onVote={castVote} label="選擇你支持的玩家" />
            ) : canVote && voted ? (
              <div style={{ fontSize:13, color:clr.success }}>✓ 已投票 → {myVote===0?"棄票":myVote+" 號"}</div>
            ) : !isAlive ? (
              <div style={{ fontSize:13, color:clr.text3 }}>你已出局，無法投票</div>
            ) : null}
            {!announcing && (campaign.votesPublished ? (
              <div style={{ marginTop:12 }}>
                <div style={{ fontSize:13, fontWeight:500, color:clr.text, marginBottom:8 }}>票型公布</div>
                <PlayerVoteMatrix votes={campaign.votes} candidates={actCands} />
              </div>
            ) : (
              <div style={{ marginTop:12, fontSize:12, color:clr.text3 }}>等待上帝公布票型...</div>
            ))}
          </div>
        );
      })()}

      {/* CAMPAIGN RESULT */}
      {(phase==="campaignVote"||phase==="campaignPK") && campaign.result && (
        <div style={card}><CampaignResult result={campaign.result} /></div>
      )}

      {/* DAY VOTE */}
      {phase==="day" && (
        <div style={card}>
          <div style={{ fontSize:14, fontWeight:500, color:clr.text, marginBottom:8 }}>第 {room.dayCount} 天·放逐投票</div>
          {isSheriff && <div style={{ fontSize:12, color:clr.warn, marginBottom:8 }}>⭐ 你是警長，票數 ×1.5</div>}
          {(() => {
            // 白癡亮牌後失去投票權
            const idiotNum = Object.entries(room.roles||{}).find(([,v])=>v==="idiot")?.[0]?.replace("p","");
            const isIdiotRevealed = room.idiotRevealed && idiotNum && Number(idiotNum)===myNum;
            if (isIdiotRevealed) return (
              <div style={{ fontSize:13, color:clr.warn }}>🃏 白癡身份已揭露，你已失去投票權</div>
            );
            return isAlive && !voted ? (
              <VoteButtons options={[...exile.targetOptions,0]} onVote={castVote} label="選擇放逐的玩家" isDanger />
            ) : (
              <div style={{ fontSize:13, color:clr.success }}>
                {voted?`已投票 → ${myVote===0?"棄票":myVote+" 號"}`:"你已出局，無法投票"}
              </div>
            );
          })()}
          <div style={{ marginTop:10, fontSize:12, color:clr.text3 }}>等待上帝公布票型...</div>
        </div>
      )}

      {/* EXILE RESULT */}
      {phase==="result" && exile.result && exile.published && (
        <div style={card}><ExileResult result={exile.result} /></div>
      )}
      {phase==="result" && exile.result && !exile.published && (
        <div style={card}><div style={{ fontSize:13, color:clr.text3 }}>等待上帝公布放逐結果...</div></div>
      )}

      <PlayerVoteHistory voteHistory={room.voteHistory||[]} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ── Error Boundary ────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ maxWidth:480, margin:"2rem auto", padding:"1.5rem",
        background:"var(--color-background-danger)", borderRadius:"var(--border-radius-lg)" }}>
        <div style={{ fontSize:14, fontWeight:500, color:"var(--color-text-danger)", marginBottom:8 }}>
          ⚠ 畫面渲染錯誤
        </div>
        <div style={{ fontSize:12, color:"var(--color-text-danger)", marginBottom:12 }}>
          {this.state.error.message}
        </div>
        <button onClick={()=>this.setState({error:null})}
          style={{ padding:"6px 14px", borderRadius:"var(--border-radius-md)",
            border:"none", background:"var(--color-text-danger)", color:"#fff", cursor:"pointer" }}>
          重試
        </button>
      </div>
    );
    return this.props.children;
  }
}

// ── GodView Component ──────────────────────────────────────────────────────
function GodView({ room, phase, campaign: campaignProp, exile: exileProp, sheriff, loading, error, godInput, setGodInput, godAction }) {
  const campaign = campaignProp || { candidates:[], speakers:[], speakerDir:null, currentSpeaker:null, finalCandidates:[], votes:{}, pkRound:false, pkCandidates:[], result:null, votesPublished:false };
  const exile    = exileProp    || { targetOptions:[], votes:{}, result:null, published:false };
  const [tab, setTab] = useState(room.phase==="night"?"night":"day");
  // Auto-switch tab when room.phase changes
  useEffect(() => {
    if (room.phase==="night") setTab("night");
  }, [room.phase]);

  const preset   = PRESETS.find(p=>p.id===room.preset)||PRESETS[0];
  const aliveNums= Array.from({length:12},(_,i)=>i+1)
    .filter(n=>!Object.values(room.players||{}).find(p=>p.num===n)?.dead);

  // Which tab is currently "active" based on game room.phase
  const nightPhases = ["night"];
  const dayPhases   = ["lobby","campaign","campaignVote","campaignPK","day","result"];
  const activeByPhase = nightPhases.includes(room.phase) ? "night" : "day";

  return (
    <div style={{ maxWidth:560, margin:"0 auto", padding:"1.5rem 1rem" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div>
          <h2 style={{ margin:0, color:clr.text }}>上帝視角</h2>
          <span style={{ fontSize:13, color:clr.text2 }}>
            房號：<strong>{room.code}</strong>
            <span style={tag("gray")}>{preset.label}</span>
          </span>
        </div>
        <span style={tag(room.phase==="lobby"?"gray":room.phase==="night"?"info":"warn")}>
          {PHASES[room.phase]||room.phase}
        </span>
      </div>

      {/* ── Player grid (always visible) ── */}
      <div style={card}>
        <div style={{ fontSize:13, color:clr.text2, marginBottom:8 }}>
          玩家狀態（{Object.keys(room.players||{}).length}/12）
        </div>
        <PlayerGridGod room={room} />
        {sheriff && <div style={{ marginTop:8, fontSize:13, color:clr.warn }}>⭐ 警長：{sheriff} 號（計票 ×1.5）</div>}
        {room.sheriffBadgeLost && <div style={{ fontSize:13, color:clr.danger }}>⚠ 警徽流失</div>}
        {room.firstSpeaker && !sheriff && (
          <div style={{ fontSize:13, color:clr.info, marginTop:4 }}>
            首發：{room.firstSpeaker} 號，方向：{room.firstSpeakerDir}
          </div>
        )}
      </div>

      {/* ── Tab bar (skip pre-game lobby; show after first night and all other phases) ── */}
      {(room.phase !== "lobby" || room.rolesRevealed) && (
        <div style={{ display:"flex", gap:0, marginBottom:16, borderRadius:"var(--border-radius-md)", overflow:"hidden", border:`0.5px solid ${clr.border2}` }}>
          {[["night","🌙 夜間環節"],["day","☀ 白天環節"]].map(([t,lbl],i) => {
            const active = tab===t;
            const isCurrent = activeByPhase===t;
            return (
              <button key={t} onClick={()=>setTab(t)} style={{
                flex:1, padding:"10px 0", fontSize:14, fontWeight:500, cursor:"pointer",
                border:"none", borderLeft: i>0 ? `0.5px solid ${clr.border2}` : "none",
                background: active ? clr.infoBg : "transparent",
                color: active ? clr.info : clr.text2,
              }}>
                {lbl}
                {isCurrent && !active && (
                  <span style={{ marginLeft:5, fontSize:10, color:clr.warn }}>●</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════
          LOBBY (no tab bar when pre-game; tab bar shown after first night)
      ══════════════════════════════════════════ */}
      {room.phase==="lobby" && !room.rolesRevealed && (
        <div style={card}>
          <div style={{ fontSize:14, fontWeight:500, color:clr.text, marginBottom:10 }}>🌙 夜間行動順序</div>
          <div style={{ fontSize:12, color:clr.text3, marginBottom:12 }}>{preset.desc}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
            {preset.nightOrder.map((s,i) => {
              const role=ROLE_MAP[s.roleId], rc=ROLE_COLORS[s.roleId];
              return (
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10,
                  padding:"8px 12px", borderRadius:"var(--border-radius-md)",
                  background:rc?.bg||clr.bg2, border:`0.5px solid ${clr.border}` }}>
                  <div style={{ fontSize:13, fontWeight:700, color:rc?.text||clr.text2, minWidth:20 }}>{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:rc?.text||clr.text }}>
                      {role?.emoji} {role?.label}
                      {s.firstNightOnly && (
                        <span style={{ marginLeft:6, fontSize:11, color:clr.warn,
                          background:clr.warnBg, padding:"1px 6px", borderRadius:"var(--border-radius-md)" }}>
                          僅首夜
                        </span>
                      )}
                    </div>
                    {s.action && (
                      <div style={{ fontSize:12, color:rc?.text||clr.text2, opacity:0.8, marginTop:2 }}>
                        {s.action.isWitch?"救人 / 毒人":s.action.isSwap?"互換兩名玩家":s.action.isGrant?"授予技能":s.action.label}
                      </div>
                    )}
                    {!s.action && <div style={{ fontSize:12, color:rc?.text||clr.text2, opacity:0.7, marginTop:2 }}>確認狀態</div>}
                    {s.note && <div style={{ fontSize:11, color:clr.text3, marginTop:2 }}>📌 {s.note}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ borderTop:`0.5px solid ${clr.border}`, paddingTop:14 }}>
            <button disabled={loading}
              onClick={()=>{ godAction("startNight"); setTab("night"); }}
              style={{ ...btn("primary"), width:"100%" }}>
              🌙 開始第一夜行動
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          NIGHT TAB
      ══════════════════════════════════════════ */}
      {tab==="night" && (room.phase!=="lobby" || room.rolesRevealed) && (
        <div>
          <NightHistory nightHistory={room.nightHistory||[]} roles={room.roles||{}} />
          {room.phase==="night"
            ? <GodNightPanel room={room} godAction={godAction} loading={loading} />
          : <div style={card}>
              <div style={{ fontSize:13, color:clr.text3, textAlign:"center", padding:"8px 0" }}>
                {room.phase==="lobby" ? "首夜已結束，目前為警長競選階段" : "目前為白天階段"}
              </div>
              {room.night?.deaths!=null && (
                <div style={{ marginTop:8, padding:"8px 12px", borderRadius:"var(--border-radius-md)",
                  background:room.night.deaths.length===0?clr.successBg:clr.dangerBg }}>
                  <span style={{ fontSize:13, fontWeight:500,
                    color:room.night.deaths.length===0?clr.success:clr.danger }}>
                    {room.night.deaths.length===0
                      ?"🌙 昨夜平安，無人出局"
                      :`🌙 昨夜出局：${room.night.deaths.map(d=>d.num+"號("+d.reason+")").join("、")}`}
                  </span>
                </div>
              )}
              {(room.phase==="day"||room.phase==="result") && (
                <button disabled={loading} style={{ ...btn("warn"), marginTop:10, width:"100%" }}
                  onClick={()=>{ godAction("skipToNight",{wolfBoom:godInput.wolfBoomNum||null}); setGodInput(p=>({...p,wolfBoomNum:null})); setTab("night"); }}>
                  ⚡ 略過白天，直接進入夜晚
                </button>
              )}
            </div>
          }
        </div>
      )}

      {/* ══════════════════════════════════════════
          DAY TAB
      ══════════════════════════════════════════ */}
      {/* Post-first-night campaign (room.phase=lobby but roles revealed) */}
      {tab==="day" && room.phase==="lobby" && room.rolesRevealed && (
        <div style={card}>
          {room.night?.deaths!=null && (
            <div style={{ marginBottom:12, padding:"8px 10px", borderRadius:"var(--border-radius-md)",
              background:room.night.deaths.length===0?clr.successBg:clr.dangerBg }}>
              <span style={{ fontSize:13, fontWeight:500,
                color:room.night.deaths.length===0?clr.success:clr.danger }}>
                {room.night.deaths.length===0
                  ?"🌙 首夜平安，無人出局"
                  :`🌙 首夜出局：${room.night.deaths.map(d=>d.num+"號("+d.reason+")").join("、")}`}
              </span>
            </div>
          )}

          {/* Badge lost → show random first speaker */}
          {room.sheriffBadgeLost && (
            <div style={{ marginBottom:12, padding:"8px 12px", borderRadius:"var(--border-radius-md)",
              background:clr.dangerBg }}>
              <div style={{ fontSize:13, fontWeight:500, color:clr.danger }}>⚠ 警徽流失（連續兩次狼人自爆）</div>
              {room.firstSpeaker && (
                <div style={{ fontSize:13, color:clr.info, marginTop:4 }}>
                  首發：{room.firstSpeaker} 號，方向：{room.firstSpeakerDir}
                </div>
              )}
            </div>
          )}

          {/* Campaign resuming (wolf boomed once) */}
          {room.campaignResuming && !room.sheriffBadgeLost && (
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:clr.warn, marginBottom:4 }}>
                ⚡ 狼人自爆，繼續警長競選
              </div>
              <div style={{ fontSize:12, color:clr.text3, marginBottom:10 }}>
                原警上玩家：{room.campaign.candidates?.join("、") || "—"} 號，選擇仍留在警上的玩家進行投票
              </div>
              <MultiNumberSelect
                label="留在警上繼續競選的玩家"
                value={godInput.resumeFinals||[]}
                onChange={v=>setGodInput(p=>({...p,resumeFinals:v}))}
              />
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:4 }}>
                <button disabled={loading||!godInput.resumeFinals?.length}
                  onClick={()=>{ godAction("resumeFinalizeCandidates",{finals:godInput.resumeFinals}); setGodInput(p=>({...p,resumeFinals:[]})); }}
                  style={{ ...btn("primary") }}>
                  確認，開始投票
                </button>
                <button disabled={loading}
                  onClick={()=>{ godAction("skipToNight",{wolfBoom:godInput.wolfBoomNum||null}); setGodInput(p=>({...p,wolfBoomNum:null})); setTab("night"); }}
                  style={{ ...btn("warn") }}>
                  {godInput.wolfBoomNum?`⚡ ${godInput.wolfBoomNum} 號自爆，進入夜晚`:"⚡ 略過，直接進夜晚"}
                </button>
              </div>
              {/* Wolf boom selector for second boom */}
              <div style={{ marginTop:10, borderTop:`0.5px solid ${clr.border}`, paddingTop:10 }}>
                <div style={{ fontSize:12, color:clr.warn, marginBottom:6, fontWeight:500 }}>⚡ 狼人自爆（第二次將導致警徽流失）</div>
                {(() => {
                  const wolfNums = Array.from({length:12},(_,i)=>i+1).filter(n=>{
                    const roleId=room.roles?.[`p${n}`];
                    return roleId && ROLE_MAP[roleId]?.camp==="wolf" &&
                      !Object.values(room.players||{}).find(p=>p.num===n)?.dead;
                  });
                  return wolfNums.length ? (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                      {wolfNums.map(n=>{
                        const sel=godInput.wolfBoomNum===n;
                        return (
                          <button key={n} onClick={()=>setGodInput(p=>({...p,wolfBoomNum:sel?null:n}))} style={{
                            padding:sel?"4px 8px 4px 6px":"4px 10px",
                            borderRadius:"var(--border-radius-md)", fontSize:13,
                            border:sel?`1.5px solid ${clr.warn}`:`0.5px solid ${clr.border2}`,
                            background:sel?clr.warnBg:"transparent", color:sel?clr.warn:clr.text,
                            cursor:"pointer", display:"flex", alignItems:"center", gap:3,
                          }}>
                            {sel&&<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  ) : <div style={{ fontSize:12, color:clr.text3 }}>（無存活狼人）</div>;
                })()}
              </div>
            </div>
          )}

          {/* Normal first-time campaign start */}
          {!room.campaignResuming && !room.sheriffBadgeLost && (
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:clr.text, marginBottom:10 }}>開始警長競選</div>
              <MultiNumberSelect label="選擇上警玩家" value={godInput.candidates||[]}
                onChange={v=>setGodInput(p=>({...p,candidates:v}))} />
              <button disabled={loading||!godInput.candidates?.length}
                onClick={()=>godAction("startCampaign",{candidates:godInput.candidates})}
                style={{ ...btn("primary"), marginTop:4 }}>
                開始競選
              </button>
            </div>
          )}

          {/* Badge lost → just go to night */}
          {room.sheriffBadgeLost && (
            <button disabled={loading}
              onClick={()=>{ godAction("startNight"); setTab("night"); }}
              style={{ ...btn("primary"), marginTop:8 }}>
              進入夜晚行動
            </button>
          )}
        </div>
      )}

      {tab==="day" && room.phase!=="lobby" && (
        <div>

          {/* CAMPAIGN step 2 */}
          {room.phase==="campaign" && (
            <div style={card}>
              <div style={{ fontSize:14, fontWeight:500, color:clr.text, marginBottom:8 }}>步驟二：選出繼續競選玩家</div>
              <div style={{ fontSize:13, color:clr.text2, marginBottom:8 }}>
                首發：<strong>{campaign.currentSpeaker} 號</strong>，方向：{campaign.speakerDir}
              </div>
              <MultiNumberSelect label="最終留下競選的玩家" value={godInput.finals||[]}
                onChange={v=>setGodInput(p=>({...p,finals:v}))} />
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:4 }}>
                <button disabled={loading||!godInput.finals?.length}
                  onClick={()=>godAction("finalizeCandidates",{finals:godInput.finals})}
                  style={{ ...btn("primary") }}>
                  確認 → 開始投票
                </button>
                <div style={{ borderTop:`0.5px solid ${clr.border}`, marginTop:8, paddingTop:8, width:"100%" }}>
                  <div style={{ fontSize:12, color:clr.warn, marginBottom:6, fontWeight:500 }}>⚡ 狼人自爆</div>
                  <div style={{ fontSize:12, color:clr.text3, marginBottom:6 }}>選擇自爆的狼人號碼（可空白略過）</div>
                  {(() => {
                    // 顯示狼陣營號碼（存活）＋ 第一天警長競選時已被毒殺但死訊未公布的狼人
                    const isFirstDayCampaign = room.dayCount===1 && room.rolesRevealed &&
                      ["lobby","campaign","campaignVote","campaignPK"].includes(room.phase);
                    const wolfNums = Array.from({length:12},(_,i)=>i+1).filter(n=>{
                      const roleId = room.roles?.[`p${n}`];
                      const isWolf = roleId && ROLE_MAP[roleId]?.camp==="wolf";
                      if (!isWolf) return false;
                      const isDead = Object.values(room.players||{}).find(p=>p.num===n)?.dead;
                      // 第一天警長競選：允許已被毒殺但死訊未公布的狼人（上帝知道他們已死）
                      if (isDead && isFirstDayCampaign) return true;
                      return !isDead;
                    });
                    if (!wolfNums.length) return (
                      <div style={{ fontSize:12, color:clr.text3 }}>（無存活的狼陣營玩家）</div>
                    );
                    return (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
                        {wolfNums.map(n=>{
                          const sel=godInput.wolfBoomNum===n;
                          const isDead=Object.values(room.players||{}).find(p=>p.num===n)?.dead;
                          return (
                            <button key={n} onClick={()=>setGodInput(p=>({...p,wolfBoomNum:sel?null:n}))} style={{
                              padding:sel?"4px 8px 4px 6px":"4px 10px",
                              borderRadius:"var(--border-radius-md)", fontSize:13,
                              border:sel?`1.5px solid ${clr.warn}`:`0.5px solid ${clr.border2}`,
                              background:sel?clr.warnBg:"transparent", color:sel?clr.warn:clr.text,
                              cursor:"pointer", display:"flex", alignItems:"center", gap:3, transition:"all .1s",
                            }}>
                              {sel&&<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              {n}{isDead?" (毒)":""}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <button disabled={loading}
                    onClick={()=>{ godAction("skipToNight",{wolfBoom:godInput.wolfBoomNum||null}); setGodInput(p=>({...p,wolfBoomNum:null})); setTab("night"); }}
                    style={{ ...btn("warn") }}>
                    {godInput.wolfBoomNum?`確認 ${godInput.wolfBoomNum} 號自爆，進入夜晚`:"直接進入夜晚（無自爆）"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CAMPAIGN VOTE */}
          {room.phase==="campaignVote" && !campaign.result && (
            <div style={card}>
              <div style={{ fontSize:14, fontWeight:500, color:clr.text, marginBottom:8 }}>警長投票進行中</div>
              <div style={{ fontSize:13, color:clr.text2, marginBottom:12 }}>
                競選玩家：{campaign.finalCandidates.join("、")} 號
                <span style={{ marginLeft:8, color:clr.danger, fontSize:12 }}>（警上玩家不可投票）</span>
              </div>
              <GodVoteMatrix votes={campaign.votes} candidates={campaign.finalCandidates} />
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:12 }}>
                <button disabled={loading} onClick={()=>godAction("tallyVotes")}
                  style={{ ...btn("success") }}>
                  結算並發送票型給玩家
                </button>
                <div style={{ borderTop:`0.5px solid ${clr.border}`, marginTop:8, paddingTop:8, width:"100%" }}>
                  <div style={{ fontSize:12, color:clr.warn, marginBottom:6, fontWeight:500 }}>⚡ 狼人自爆</div>
                  <div style={{ fontSize:12, color:clr.text3, marginBottom:6 }}>選擇自爆的狼人號碼（可空白略過）</div>
                  {(() => {
                    // 顯示狼陣營號碼（存活）＋ 第一天警長競選時已被毒殺但死訊未公布的狼人
                    const isFirstDayCampaign = room.dayCount===1 && room.rolesRevealed &&
                      ["lobby","campaign","campaignVote","campaignPK"].includes(room.phase);
                    const wolfNums = Array.from({length:12},(_,i)=>i+1).filter(n=>{
                      const roleId = room.roles?.[`p${n}`];
                      const isWolf = roleId && ROLE_MAP[roleId]?.camp==="wolf";
                      if (!isWolf) return false;
                      const isDead = Object.values(room.players||{}).find(p=>p.num===n)?.dead;
                      // 第一天警長競選：允許已被毒殺但死訊未公布的狼人（上帝知道他們已死）
                      if (isDead && isFirstDayCampaign) return true;
                      return !isDead;
                    });
                    if (!wolfNums.length) return (
                      <div style={{ fontSize:12, color:clr.text3 }}>（無存活的狼陣營玩家）</div>
                    );
                    return (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
                        {wolfNums.map(n=>{
                          const sel=godInput.wolfBoomNum===n;
                          const isDead=Object.values(room.players||{}).find(p=>p.num===n)?.dead;
                          return (
                            <button key={n} onClick={()=>setGodInput(p=>({...p,wolfBoomNum:sel?null:n}))} style={{
                              padding:sel?"4px 8px 4px 6px":"4px 10px",
                              borderRadius:"var(--border-radius-md)", fontSize:13,
                              border:sel?`1.5px solid ${clr.warn}`:`0.5px solid ${clr.border2}`,
                              background:sel?clr.warnBg:"transparent", color:sel?clr.warn:clr.text,
                              cursor:"pointer", display:"flex", alignItems:"center", gap:3, transition:"all .1s",
                            }}>
                              {sel&&<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              {n}{isDead?" (毒)":""}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <button disabled={loading}
                    onClick={()=>{ godAction("skipToNight",{wolfBoom:godInput.wolfBoomNum||null}); setGodInput(p=>({...p,wolfBoomNum:null})); setTab("night"); }}
                    style={{ ...btn("warn") }}>
                    {godInput.wolfBoomNum?`確認 ${godInput.wolfBoomNum} 號自爆，進入夜晚`:"直接進入夜晚（無自爆）"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PK ANNOUNCE */}
          {room.phase==="campaignPK" && !campaign.result && !campaign.votesPublished && Object.keys(campaign?.votes||{}).length===0 && (
            <div style={card}>
              <div style={{ fontSize:14, fontWeight:500, color:clr.warn, marginBottom:8 }}>⚡ 首輪平票</div>
              <div style={{ fontSize:13, color:clr.text2, marginBottom:4 }}>PK 玩家：{campaign.pkCandidates.join("、")} 號</div>
              <div style={{ fontSize:12, color:clr.text3, marginBottom:12 }}>PK 輪所有非 PK 玩家皆可投票（包含原警上玩家）</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <button disabled={loading} onClick={()=>godAction("startPK")} style={{ ...btn("warn") }}>
                  宣布開始 PK 投票
                </button>
                <button disabled={loading}
                  onClick={()=>{ godAction("skipToNight",{wolfBoom:godInput.wolfBoomNum||null}); setGodInput(p=>({...p,wolfBoomNum:null})); setTab("night"); }}
                  style={{ ...btn("default") }}>
                  ⚡ 狼人自爆，直接進夜晚
                </button>
              </div>
            </div>
          )}

          {/* PK VOTING */}
          {room.phase==="campaignPK" && !campaign.result && (campaign.votesPublished||Object.keys(campaign?.votes||{}).length>0) && (
            <div style={card}>
              <div style={{ fontSize:14, fontWeight:500, color:clr.text, marginBottom:8 }}>⚡ PK 投票進行中</div>
              <div style={{ fontSize:13, color:clr.text2, marginBottom:12 }}>
                PK 玩家：{campaign.pkCandidates.join("、")} 號
                <span style={{ marginLeft:8, color:clr.danger, fontSize:12 }}>（PK 玩家不可投票）</span>
              </div>
              <GodVoteMatrix votes={campaign.votes} candidates={campaign.pkCandidates} />
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:12 }}>
                <button disabled={loading} onClick={()=>godAction("tallyVotes")}
                  style={{ ...btn("success") }}>
                  結算並發送票型給玩家
                </button>
                <div style={{ borderTop:`0.5px solid ${clr.border}`, marginTop:8, paddingTop:8, width:"100%" }}>
                  <div style={{ fontSize:12, color:clr.warn, marginBottom:6, fontWeight:500 }}>⚡ 狼人自爆</div>
                  <div style={{ fontSize:12, color:clr.text3, marginBottom:6 }}>選擇自爆的狼人號碼（可空白略過）</div>
                  {(() => {
                    // 顯示狼陣營號碼（存活）＋ 第一天警長競選時已被毒殺但死訊未公布的狼人
                    const isFirstDayCampaign = room.dayCount===1 && room.rolesRevealed &&
                      ["lobby","campaign","campaignVote","campaignPK"].includes(room.phase);
                    const wolfNums = Array.from({length:12},(_,i)=>i+1).filter(n=>{
                      const roleId = room.roles?.[`p${n}`];
                      const isWolf = roleId && ROLE_MAP[roleId]?.camp==="wolf";
                      if (!isWolf) return false;
                      const isDead = Object.values(room.players||{}).find(p=>p.num===n)?.dead;
                      // 第一天警長競選：允許已被毒殺但死訊未公布的狼人（上帝知道他們已死）
                      if (isDead && isFirstDayCampaign) return true;
                      return !isDead;
                    });
                    if (!wolfNums.length) return (
                      <div style={{ fontSize:12, color:clr.text3 }}>（無存活的狼陣營玩家）</div>
                    );
                    return (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
                        {wolfNums.map(n=>{
                          const sel=godInput.wolfBoomNum===n;
                          const isDead=Object.values(room.players||{}).find(p=>p.num===n)?.dead;
                          return (
                            <button key={n} onClick={()=>setGodInput(p=>({...p,wolfBoomNum:sel?null:n}))} style={{
                              padding:sel?"4px 8px 4px 6px":"4px 10px",
                              borderRadius:"var(--border-radius-md)", fontSize:13,
                              border:sel?`1.5px solid ${clr.warn}`:`0.5px solid ${clr.border2}`,
                              background:sel?clr.warnBg:"transparent", color:sel?clr.warn:clr.text,
                              cursor:"pointer", display:"flex", alignItems:"center", gap:3, transition:"all .1s",
                            }}>
                              {sel&&<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              {n}{isDead?" (毒)":""}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <button disabled={loading}
                    onClick={()=>{ godAction("skipToNight",{wolfBoom:godInput.wolfBoomNum||null}); setGodInput(p=>({...p,wolfBoomNum:null})); setTab("night"); }}
                    style={{ ...btn("warn") }}>
                    {godInput.wolfBoomNum?`確認 ${godInput.wolfBoomNum} 號自爆，進入夜晚`:"直接進入夜晚（無自爆）"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CAMPAIGN RESULT */}
          {(room.phase==="campaignVote"||room.phase==="campaignPK") && campaign.result && (
            <div style={card}>
              <CampaignResult result={campaign.result} />
              <div style={{ borderTop:`0.5px solid ${clr.border}`, marginTop:16, paddingTop:14 }}>
                <button disabled={loading}
                  onClick={()=>godAction("startDay")}
                  style={{ ...btn("primary"), width:"100%" }}>
                  ☀ 進入第一天放逐投票
                </button>
              </div>
            </div>
          )}

          {/* DAY VOTE */}
          {room.phase==="day" && (
            <div style={card}>
              <div style={{ fontSize:14, fontWeight:500, color:clr.text, marginBottom:8 }}>
                第 {room.dayCount} 天·放逐投票
              </div>
              {room.night?.deaths && (
                <div style={{ marginBottom:12, padding:"8px 12px", borderRadius:"var(--border-radius-md)",
                  background:room.night.deaths.length===0?clr.successBg:clr.dangerBg }}>
                  <span style={{ fontSize:13, fontWeight:500,
                    color:room.night.deaths.length===0?clr.success:clr.danger }}>
                    {room.night.deaths.length===0
                      ?"🌙 昨夜平安夜，無人出局"
                      :`🌙 昨夜出局：${room.night.deaths.map(d=>d.num+"號("+d.reason+")").join("、")}`}
                  </span>
                </div>
              )}
              <GodVoteMatrix votes={exile.votes} candidates={exile.targetOptions||[]} />
              <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                <button disabled={loading} onClick={()=>godAction("tallyExile")}
                  style={{ ...btn("danger") }}>
                  結算並發送票型給玩家
                </button>
                <button disabled={loading}
                  onClick={()=>{ godAction("skipToNight",{wolfBoom:godInput.wolfBoomNum||null}); setGodInput(p=>({...p,wolfBoomNum:null})); setTab("night"); }}
                  style={{ ...btn("warn") }}>
                  ⚡ 略過放逐，直接進入夜晚
                </button>
              </div>
            </div>
          )}

          {/* RESULT + sheriff transfer + go to night */}
          {room.phase==="result" && exile.result && (() => {
            const exiledNum    = exile.result.exiled;
            const sheriffExiled= exiledNum && exiledNum===sheriff;
            const alive2       = aliveNums.filter(n=>n!==exiledNum);
            return (
              <div style={card}>
                <ExileResult result={exile.result} />
                {sheriffExiled && (
                  <div style={{ borderTop:`0.5px solid ${clr.border}`, marginTop:14, paddingTop:14 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:clr.warn, marginBottom:6 }}>⭐ 警長出局・警徽移交</div>
                    <div style={{ fontSize:12, color:clr.text3, marginBottom:8 }}>選擇新警長，不移交則警徽消失</div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                      {alive2.map(n=>(
                        <button key={n}
                          onClick={()=>{ godAction("transferSheriff",{to:n}); setGodInput(p=>({...p,sheriffTransferred:n})); }}
                          style={{ ...btn(godInput.sheriffTransferred===n?"warn":"default"), padding:"6px 14px" }}>
                          {n} 號
                        </button>
                      ))}
                      <button
                        onClick={()=>{ godAction("transferSheriff",{to:null}); setGodInput(p=>({...p,sheriffTransferred:-1})); }}
                        style={{ ...btn(godInput.sheriffTransferred===-1?"danger":"default"), padding:"6px 14px" }}>
                        不移交
                      </button>
                    </div>
                    {godInput.sheriffTransferred!==undefined && (
                      <div style={{ fontSize:12, color:clr.success }}>
                        {godInput.sheriffTransferred===-1?"警徽已銷毀":`警徽已移交給 ${godInput.sheriffTransferred} 號`}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ borderTop:`0.5px solid ${clr.border}`, marginTop:16, paddingTop:14, display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button disabled={loading}
                    onClick={()=>{ godAction("startNightNext"); setGodInput(p=>({...p,sheriffTransferred:undefined})); setTab("night"); }}
                    style={{ ...btn("primary") }}>
                    進入夜晚行動
                  </button>
                  <button disabled={loading}
                    onClick={()=>{ godAction("skipToNight",{wolfBoom:godInput.wolfBoomNum||null}); setGodInput(p=>({...p,wolfBoomNum:null,sheriffTransferred:undefined})); setTab("night"); }}
                    style={{ ...btn("warn") }}>
                    ⚡ 略過放逐，直接進入夜晚
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Night room.phase shown in day tab */}
          {room.phase==="night" && (
            <div style={card}>
              <div style={{ fontSize:13, color:clr.text3, textAlign:"center", padding:"8px 0" }}>
                目前為夜晚行動階段，請切換至夜間環節
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Log (always visible) ── */}
      <div style={card}>
        <div style={{ fontSize:13, color:clr.text2, marginBottom:6 }}>遊戲日誌</div>
        <Log entries={room.log} />
      </div>
    </div>
  );
}
