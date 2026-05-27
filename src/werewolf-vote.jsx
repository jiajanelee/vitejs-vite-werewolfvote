import { useState, useEffect, useCallback, useRef } from 'react';

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

// ── Storage ──────────────────────────────────────────────────────────────
async function loadRoom(code) {
  try {
    const r = localStorage.getItem(`room:${code}`);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}
async function saveRoom(room) {
  room.updatedAt = Date.now();
  localStorage.setItem(`room:${room.code}`, JSON.stringify(room));
}

// ── Role catalogue ────────────────────────────────────────────────────────
const ROLE_MAP = {
  wolf: { id: 'wolf', label: '狼人', emoji: '🐺', camp: 'wolf' },
  wolf2: { id: 'wolf2', label: '狼王', emoji: '👑', camp: 'wolf' },
  seer: { id: 'seer', label: '預言家', emoji: '🔮', camp: 'good' },
  witch: { id: 'witch', label: '女巫', emoji: '🧙', camp: 'good' },
  hunter: { id: 'hunter', label: '獵人', emoji: '🏹', camp: 'good' },
  guard: { id: 'guard', label: '守衛', emoji: '🛡', camp: 'good' },
  magician: { id: 'magician', label: '魔術師', emoji: '🎩', camp: 'good' },
  merchant: { id: 'merchant', label: '奇蹟商人', emoji: '🛒', camp: 'good' },
  secretlove: { id: 'secretlove', label: '暗戀者', emoji: '💘', camp: 'good' },
  dreamer: { id: 'dreamer', label: '攝夢人', emoji: '🌙', camp: 'good' },
  lonegirl: {
    id: 'lonegirl',
    label: '覺醒孤獨少女',
    emoji: '🌟',
    camp: 'good',
  },
  lucky: { id: 'lucky', label: '幸運兒', emoji: '🍀', camp: 'good' },
  village: { id: 'village', label: '村民', emoji: '👤', camp: 'good' },
};
const ROLE_COLORS = {
  wolf: {
    bg: 'var(--color-background-danger)',
    text: 'var(--color-text-danger)',
  },
  wolf2: {
    bg: 'var(--color-background-danger)',
    text: 'var(--color-text-danger)',
  },
  seer: { bg: 'var(--color-background-info)', text: 'var(--color-text-info)' },
  witch: {
    bg: 'var(--color-background-warning)',
    text: 'var(--color-text-warning)',
  },
  hunter: {
    bg: 'var(--color-background-warning)',
    text: 'var(--color-text-warning)',
  },
  guard: {
    bg: 'var(--color-background-success)',
    text: 'var(--color-text-success)',
  },
  magician: {
    bg: 'var(--color-background-info)',
    text: 'var(--color-text-info)',
  },
  merchant: {
    bg: 'var(--color-background-success)',
    text: 'var(--color-text-success)',
  },
  secretlove: {
    bg: 'var(--color-background-warning)',
    text: 'var(--color-text-warning)',
  },
  dreamer: {
    bg: 'var(--color-background-info)',
    text: 'var(--color-text-info)',
  },
  lonegirl: {
    bg: 'var(--color-background-warning)',
    text: 'var(--color-text-warning)',
  },
  lucky: {
    bg: 'var(--color-background-success)',
    text: 'var(--color-text-success)',
  },
  village: {
    bg: 'var(--color-background-tertiary)',
    text: 'var(--color-text-tertiary)',
  },
};

// ── Presets ───────────────────────────────────────────────────────────────
// nightOrder step shape:
//   { roleId, label, firstNightOnly?, identifyPlayers?, note?,
//     action?:{ key, label, multi?, isWitch?, isSwap?, isGrant? } }
const PRESETS = [
  {
    id: 'wolfking_magician',
    label: '狼王魔術師',
    desc: '狼王 狼人×3 預言家 女巫 獵人 魔術師 村民×4',
    roles: [
      'wolf2',
      'wolf',
      'wolf',
      'wolf',
      'seer',
      'witch',
      'hunter',
      'magician',
      'village',
      'village',
      'village',
      'village',
    ],
    nightOrder: [
      {
        roleId: 'magician',
        label: '魔術師行動',
        identifyPlayers: false,
        action: {
          key: 'swap',
          label: '選擇要互換的兩名玩家',
          multi: true,
          isSwap: true,
        },
      },
      {
        roleId: 'wolf2',
        label: '狼王 & 狼人睜眼',
        identifyPlayers: true,
        action: { key: 'kill', label: '請選擇殺人目標', multi: false },
      },
      {
        roleId: 'witch',
        label: '女巫睜眼',
        identifyPlayers: false,
        action: {
          key: 'witch',
          label: '女巫行動',
          multi: false,
          isWitch: true,
        },
      },
      {
        roleId: 'seer',
        label: '預言家睜眼',
        identifyPlayers: false,
        action: { key: 'check', label: '請選擇查驗目標', multi: false },
      },
      {
        roleId: 'hunter',
        label: '獵人睜眼（確認開槍狀態）',
        identifyPlayers: false,
        note: '首夜確認獵人是否開槍',
        action: null,
      },
    ],
  },
  {
    id: 'wolfking_merchant',
    label: '狼王奇蹟商人',
    desc: '狼王 狼人×3 預言家 女巫 守衛 奇蹟商人 村民×4',
    roles: [
      'wolf2',
      'wolf',
      'wolf',
      'wolf',
      'seer',
      'witch',
      'guard',
      'merchant',
      'village',
      'village',
      'village',
      'village',
    ],
    nightOrder: [
      {
        roleId: 'merchant',
        label: '奇蹟商人行動',
        identifyPlayers: false,
        action: {
          key: 'grant',
          label: '選擇授予技能的玩家',
          multi: false,
          isGrant: true,
        },
      },
      {
        roleId: 'guard',
        label: '守衛睜眼',
        identifyPlayers: false,
        action: { key: 'guard', label: '請選擇守護目標', multi: false },
      },
      {
        roleId: 'wolf2',
        label: '狼王 & 狼人睜眼',
        identifyPlayers: true,
        action: { key: 'kill', label: '請選擇殺人目標', multi: false },
      },
      {
        roleId: 'witch',
        label: '女巫睜眼',
        identifyPlayers: false,
        action: {
          key: 'witch',
          label: '女巫行動',
          multi: false,
          isWitch: true,
        },
      },
      {
        roleId: 'seer',
        label: '預言家睜眼',
        identifyPlayers: false,
        action: { key: 'check', label: '請選擇查驗目標', multi: false },
      },
      {
        roleId: 'lucky',
        label: '幸運兒行動（若已獲得技能）',
        identifyPlayers: false,
        note: '僅在奇蹟商人授予技能後行動',
        action: { key: 'lucky', label: '幸運兒使用技能目標', multi: false },
      },
    ],
  },
  {
    id: 'wolfking_guard',
    label: '狼王守衛',
    desc: '狼王 狼人×3 預言家 女巫 獵人 守衛 村民×4',
    roles: [
      'wolf2',
      'wolf',
      'wolf',
      'wolf',
      'seer',
      'witch',
      'hunter',
      'guard',
      'village',
      'village',
      'village',
      'village',
    ],
    nightOrder: [
      {
        roleId: 'guard',
        label: '守衛睜眼',
        identifyPlayers: false,
        action: { key: 'guard', label: '請選擇守護目標', multi: false },
      },
      {
        roleId: 'wolf2',
        label: '狼王 & 狼人睜眼',
        identifyPlayers: true,
        action: { key: 'kill', label: '請選擇殺人目標', multi: false },
      },
      {
        roleId: 'witch',
        label: '女巫睜眼',
        identifyPlayers: false,
        action: {
          key: 'witch',
          label: '女巫行動',
          multi: false,
          isWitch: true,
        },
      },
      {
        roleId: 'seer',
        label: '預言家睜眼',
        identifyPlayers: false,
        action: { key: 'check', label: '請選擇查驗目標', multi: false },
      },
      {
        roleId: 'hunter',
        label: '獵人睜眼（確認開槍狀態）',
        identifyPlayers: false,
        note: '首夜確認獵人是否開槍',
        action: null,
      },
    ],
  },
  {
    id: 'secretlove',
    label: '暗戀者',
    desc: '狼人×4 預言家 女巫 獵人 暗戀者 村民×4',
    roles: [
      'wolf',
      'wolf',
      'wolf',
      'wolf',
      'seer',
      'witch',
      'hunter',
      'secretlove',
      'village',
      'village',
      'village',
      'village',
    ],
    nightOrder: [
      {
        roleId: 'secretlove',
        label: '暗戀者選擇偶像（僅首夜）',
        identifyPlayers: false,
        firstNightOnly: true,
        action: { key: 'idol', label: '請選擇你的偶像', multi: false },
      },
      {
        roleId: 'guard',
        label: '守衛睜眼',
        identifyPlayers: false,
        action: { key: 'guard', label: '請選擇守護目標', multi: false },
      },
      {
        roleId: 'wolf',
        label: '狼人睜眼',
        identifyPlayers: true,
        action: { key: 'kill', label: '請選擇殺人目標', multi: false },
      },
      {
        roleId: 'witch',
        label: '女巫睜眼',
        identifyPlayers: false,
        action: {
          key: 'witch',
          label: '女巫行動',
          multi: false,
          isWitch: true,
        },
      },
      {
        roleId: 'seer',
        label: '預言家睜眼',
        identifyPlayers: false,
        action: { key: 'check', label: '請選擇查驗目標', multi: false },
      },
      {
        roleId: 'hunter',
        label: '獵人睜眼（確認開槍狀態）',
        identifyPlayers: false,
        note: '首夜確認獵人是否開槍',
        action: null,
      },
    ],
  },
  {
    id: 'lonegirl',
    label: '覺醒孤獨少女',
    desc: '狼人×4 預言家 女巫 獵人 攝夢人 覺醒孤獨少女 村民×3',
    roles: [
      'wolf',
      'wolf',
      'wolf',
      'wolf',
      'seer',
      'witch',
      'hunter',
      'dreamer',
      'lonegirl',
      'village',
      'village',
      'village',
    ],
    nightOrder: [
      {
        roleId: 'lonegirl',
        label: '覺醒孤獨少女選擇偶像（僅首夜）',
        identifyPlayers: false,
        firstNightOnly: true,
        action: { key: 'idol', label: '請選擇你的偶像', multi: false },
      },
      {
        roleId: 'dreamer',
        label: '攝夢人行動',
        identifyPlayers: false,
        action: {
          key: 'dream',
          label: '請選擇攝夢目標（保護並轉移傷害）',
          multi: false,
        },
      },
      {
        roleId: 'wolf',
        label: '狼人睜眼',
        identifyPlayers: true,
        action: { key: 'kill', label: '請選擇殺人目標', multi: false },
      },
      {
        roleId: 'witch',
        label: '女巫睜眼',
        identifyPlayers: false,
        action: {
          key: 'witch',
          label: '女巫行動',
          multi: false,
          isWitch: true,
        },
      },
      {
        roleId: 'seer',
        label: '預言家睜眼',
        identifyPlayers: false,
        action: { key: 'check', label: '請選擇查驗目標', multi: false },
      },
      {
        roleId: 'hunter',
        label: '獵人睜眼（確認開槍狀態）',
        identifyPlayers: false,
        note: '首夜確認獵人是否開槍',
        action: null,
      },
    ],
  },
];

function computeNightDeaths(night) {
  const wolfTarget = night.kill?.[0];
  const guardTarget = night.guard?.[0];
  const dreamTarget = night.dream?.[0]; // 攝夢人保護目標（傷害轉移到攝夢人）
  const witchSave = night.witchSave?.[0];
  const witchPoison = night.witchPoison?.[0];
  const killed = [];

  if (wolfTarget) {
    // 攝夢人：若狼人殺攝夢目標，傷害轉移至攝夢人；守衛守護或女巫救人可擋下攝夢人
    const dreamTarget_ = dreamTarget;
    if (dreamTarget_ && wolfTarget === dreamTarget_) {
      // 狼殺攝夢目標 → 攝夢人替死
      const dreamerSaved =
        witchSave === dreamTarget_ || guardTarget === dreamTarget_;
      // 攝夢目標不死（被保護了），攝夢人替死（除非攝夢人自己被保護）
      if (!dreamerSaved) {
        // find dreamer num via night.dreamerNum (set by god in identifyPlayers step)
        if (night.dreamerNum)
          killed.push({ num: night.dreamerNum, reason: '攝夢人替死' });
        else
          killed.push({
            num: wolfTarget,
            reason: '攝夢人替死（攝夢人號碼未設定）',
          });
      }
      // 原目標不死
    } else {
      const saved = wolfTarget === guardTarget || wolfTarget === witchSave;
      if (!saved) killed.push({ num: wolfTarget, reason: '狼人擊殺' });
    }
  }
  if (witchPoison) killed.push({ num: witchPoison, reason: '女巫毒殺' });
  return killed;
}

const defaultRoom = (code, presetId = 'std') => ({
  code,
  phase: 'lobby',
  preset: presetId,
  players: {},
  roles: {},
  rolesRevealed: false,
  sheriff: null,
  sheriffBadgeLost: false,
  campaign: {
    candidates: [],
    speakers: [],
    speakerDir: null,
    currentSpeaker: null,
    finalCandidates: [],
    votes: {},
    pkRound: false,
    pkCandidates: [],
    result: null,
  },
  exile: { targetOptions: [], votes: {}, result: null, published: false },
  night: null,
  nightStep: 0,
  dayCount: 1,
  log: [],
  voteHistory: [],
  firstSpeaker: null,
  firstSpeakerDir: null,
  updatedAt: Date.now(),
});

// ── Design tokens ─────────────────────────────────────────────────────────
const clr = {
  bg: 'var(--color-background-primary)',
  bg2: 'var(--color-background-secondary)',
  bg3: 'var(--color-background-tertiary)',
  text: 'var(--color-text-primary)',
  text2: 'var(--color-text-secondary)',
  text3: 'var(--color-text-tertiary)',
  border: 'var(--color-border-tertiary)',
  border2: 'var(--color-border-secondary)',
  danger: 'var(--color-text-danger)',
  dangerBg: 'var(--color-background-danger)',
  success: 'var(--color-text-success)',
  successBg: 'var(--color-background-success)',
  info: 'var(--color-text-info)',
  infoBg: 'var(--color-background-info)',
  warn: 'var(--color-text-warning)',
  warnBg: 'var(--color-background-warning)',
};
const card = {
  background: clr.bg,
  border: `0.5px solid ${clr.border}`,
  borderRadius: 'var(--border-radius-lg)',
  padding: '1.25rem',
  marginBottom: '1rem',
};
const btn = (variant = 'default', disabled = false) => {
  const map = {
    default: {
      bg: 'transparent',
      color: clr.text,
      border: `0.5px solid ${clr.border2}`,
    },
    primary: {
      bg: clr.infoBg,
      color: clr.info,
      border: `0.5px solid ${clr.info}`,
    },
    danger: {
      bg: clr.dangerBg,
      color: clr.danger,
      border: `0.5px solid ${clr.danger}`,
    },
    success: {
      bg: clr.successBg,
      color: clr.success,
      border: `0.5px solid ${clr.success}`,
    },
    warn: {
      bg: clr.warnBg,
      color: clr.warn,
      border: `0.5px solid ${clr.warn}`,
    },
  };
  const v = map[variant] || map.default;
  return {
    padding: '8px 16px',
    borderRadius: 'var(--border-radius-md)',
    fontSize: 14,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    border: v.border,
    background: v.bg,
    color: v.color,
    transition: 'opacity .15s',
  };
};
const tag = (color = 'info') => {
  const map = {
    info: { bg: clr.infoBg, color: clr.info },
    success: { bg: clr.successBg, color: clr.success },
    warn: { bg: clr.warnBg, color: clr.warn },
    danger: { bg: clr.dangerBg, color: clr.danger },
    gray: { bg: clr.bg3, color: clr.text2 },
  };
  const v = map[color] || map.gray;
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 'var(--border-radius-md)',
    fontSize: 12,
    fontWeight: 500,
    background: v.bg,
    color: v.color,
    marginLeft: 6,
  };
};

const PHASES = {
  lobby: '等待加入',
  campaign: '警長競選',
  campaignVote: '投票選警長',
  campaignPK: '平票 PK',
  night: '夜晚行動',
  day: '白天放逐投票',
  result: '放逐結果',
};

// ── Shared small components ───────────────────────────────────────────────
function Log({ entries }) {
  return (
    <div
      style={{
        maxHeight: 160,
        overflowY: 'auto',
        fontSize: 13,
        color: clr.text2,
      }}
    >
      {[...entries].reverse().map((e, i) => (
        <div
          key={i}
          style={{
            padding: '4px 0',
            borderBottom: `0.5px solid ${clr.border}`,
          }}
        >
          {e}
        </div>
      ))}
    </div>
  );
}

function MultiNumberSelect({
  label,
  max = 12,
  value = [],
  onChange,
  exclude = [],
}) {
  const nums = Array.from({ length: max }, (_, i) => i + 1).filter(
    (n) => !exclude.includes(n)
  );
  const toggle = (n) =>
    value.includes(n)
      ? onChange(value.filter((x) => x !== n))
      : onChange([...value, n]);
  return (
    <div style={{ marginBottom: 12 }}>
      {label ? (
        <div style={{ fontSize: 13, color: clr.text2, marginBottom: 6 }}>
          {label}
        </div>
      ) : null}
      {value.length > 0 && (
        <div style={{ fontSize: 12, color: clr.info, marginBottom: 8 }}>
          已選：{[...value].sort((a, b) => a - b).join('、')} 號
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {nums.map((n) => {
          const sel = value.includes(n);
          return (
            <button
              key={n}
              onClick={() => toggle(n)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: sel ? '5px 10px 5px 8px' : '5px 12px',
                minWidth: 44,
                borderRadius: 'var(--border-radius-md)',
                fontSize: 14,
                fontWeight: sel ? 500 : 400,
                cursor: 'pointer',
                border: sel
                  ? `1.5px solid ${clr.info}`
                  : `0.5px solid ${clr.border2}`,
                background: sel ? clr.infoBg : 'transparent',
                color: sel ? clr.info : clr.text,
                transform: sel ? 'scale(1.06)' : 'scale(1)',
                transition: 'all .12s ease',
                boxShadow: sel ? `0 0 0 3px ${clr.infoBg}` : 'none',
              }}
            >
              {sel && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
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
function NightPickBtn({
  stateKey,
  multi = false,
  opts,
  label,
  na,
  setNightActions,
}) {
  const val = na[stateKey] || [];
  const toggle = (n) => {
    const next = multi
      ? val.includes(n)
        ? val.filter((x) => x !== n)
        : [...val, n]
      : val.includes(n)
      ? []
      : [n];
    setNightActions((prev) => ({ ...prev, [stateKey]: next }));
  };
  return (
    <div style={{ marginTop: 6 }}>
      {label && (
        <div style={{ fontSize: 12, color: clr.text2, marginBottom: 5 }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {(opts || []).map((n) => {
          const sel = val.includes(n);
          return (
            <button
              key={n}
              onClick={() => toggle(n)}
              style={{
                padding: sel ? '5px 9px 5px 7px' : '5px 11px',
                borderRadius: 'var(--border-radius-md)',
                fontSize: 13,
                border: sel
                  ? `1.5px solid ${clr.info}`
                  : `0.5px solid ${clr.border2}`,
                background: sel ? clr.infoBg : 'transparent',
                color: sel ? clr.info : clr.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                transition: 'all .1s',
              }}
            >
              {sel && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {n}
            </button>
          );
        })}
      </div>
      {val.length > 0 && (
        <div style={{ fontSize: 12, color: clr.info, marginTop: 5 }}>
          已選：{val.join('、')} 號
        </div>
      )}
    </div>
  );
}

function NightChoiceBtn({ stateKey, choices, na, setNightActions }) {
  const sel = na[stateKey];
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}
    >
      {choices.map((c) => (
        <button
          key={c.key}
          onClick={() =>
            setNightActions((prev) => ({ ...prev, [stateKey]: c.key }))
          }
          style={{
            textAlign: 'left',
            padding: '8px 12px',
            borderRadius: 'var(--border-radius-md)',
            fontSize: 13,
            border:
              sel === c.key
                ? `1.5px solid ${clr.info}`
                : `0.5px solid ${clr.border2}`,
            background: sel === c.key ? clr.infoBg : 'transparent',
            color: sel === c.key ? clr.info : clr.text,
            cursor: 'pointer',
            transition: 'all .1s',
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function VoteButtons({ options, onVote, label, isDanger }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: clr.text2, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((n) => (
          <button
            key={n}
            onClick={() => onVote(n)}
            style={{
              ...btn(n === 0 ? 'warn' : isDanger ? 'danger' : 'primary'),
              minWidth: 52,
              padding: '8px 12px',
            }}
          >
            {n === 0 ? '棄票' : `${n} 號`}
          </button>
        ))}
      </div>
    </div>
  );
}

function GodVoteMatrix({ votes, candidates }) {
  const grouped = {};
  candidates.forEach((c) => (grouped[c] = []));
  grouped[0] = [];
  Object.entries(votes).forEach(([voter, target]) => {
    const t = Number(target);
    if (grouped[t] !== undefined) grouped[t].push(Number(voter));
    else grouped[t] = [Number(voter)];
  });
  return (
    <div>
      <div style={{ fontSize: 12, color: clr.text2, marginBottom: 8 }}>
        即時票型（已投 {Object.keys(votes).length} 票）
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(grouped).map(([target, voters]) => {
          const t = Number(target);
          if (t !== 0 && !candidates.includes(t)) return null;
          return (
            <div
              key={target}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 28,
              }}
            >
              <div
                style={{
                  minWidth: 52,
                  padding: '3px 8px',
                  borderRadius: 'var(--border-radius-md)',
                  background: t === 0 ? clr.warnBg : clr.infoBg,
                  color: t === 0 ? clr.warn : clr.info,
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: 'center',
                  flexShrink: 0,
                }}
              >
                {t === 0 ? '棄票' : `${t} 號`}
              </div>
              <div style={{ fontSize: 13, color: clr.text2, flexShrink: 0 }}>
                ：
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {voters.length === 0 ? (
                  <span style={{ fontSize: 12, color: clr.text3 }}>尚無</span>
                ) : (
                  voters
                    .sort((a, b) => a - b)
                    .map((v) => (
                      <span
                        key={v}
                        style={{
                          background: clr.bg2,
                          borderRadius: 'var(--border-radius-md)',
                          padding: '2px 8px',
                          fontSize: 12,
                          color: clr.text2,
                        }}
                      >
                        {v} 號
                      </span>
                    ))
                )}
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
  candidates.forEach((c) => (grouped[c] = []));
  grouped[0] = [];
  Object.entries(votes).forEach(([voter, target]) => {
    const t = Number(target);
    if (grouped[t] !== undefined) grouped[t].push(Number(voter));
    else grouped[t] = [Number(voter)];
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Object.entries(grouped).map(([target, voters]) => {
        const t = Number(target);
        if (t !== 0 && !candidates.includes(t)) return null;
        if (voters.length === 0) return null;
        return (
          <div
            key={target}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
          >
            <div
              style={{
                minWidth: 52,
                padding: '4px 8px',
                borderRadius: 'var(--border-radius-md)',
                background: t === 0 ? clr.warnBg : clr.infoBg,
                color: t === 0 ? clr.warn : clr.info,
                fontSize: 13,
                fontWeight: 500,
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {t === 0 ? '棄票' : `${t} 號`}
            </div>
            <div
              style={{
                fontSize: 13,
                color: clr.text2,
                paddingTop: 4,
                flexShrink: 0,
              }}
            >
              ：
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
                paddingTop: 2,
              }}
            >
              {voters
                .sort((a, b) => a - b)
                .map((v) => (
                  <span
                    key={v}
                    style={{
                      background: clr.bg2,
                      borderRadius: 'var(--border-radius-md)',
                      padding: '3px 8px',
                      fontSize: 12,
                      color: clr.text2,
                    }}
                  >
                    {v} 號
                  </span>
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
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
        {winner
          ? `🎉 ${winner} 號當選警長！`
          : pkLost
          ? '⚠ 警徽流失'
          : `⚡ 平票 PK：${pkCandidates?.join('、')} 號`}
      </div>
      {tally && (
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}
        >
          {Object.entries(tally).map(
            ([n, v]) =>
              Number(v) > 0 && (
                <span
                  key={n}
                  style={{
                    background: Number(n) === winner ? clr.successBg : clr.bg2,
                    color: Number(n) === winner ? clr.success : clr.text2,
                    borderRadius: 'var(--border-radius-md)',
                    padding: '3px 10px',
                    fontSize: 13,
                  }}
                >
                  {n == 0 ? '棄票' : `${n}號`} {Number(v).toFixed(1)}票
                </span>
              )
          )}
        </div>
      )}
    </div>
  );
}

function ExileResult({ result }) {
  const { exiled, tied, tally } = result;
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
        {exiled
          ? `🔨 ${exiled} 號被放逐出局`
          : `平票！${tied?.join('、')} 號均未被放逐`}
      </div>
      {tally && (
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}
        >
          {Object.entries(tally).map(
            ([n, v]) =>
              Number(v) > 0 && (
                <span
                  key={n}
                  style={{
                    background: Number(n) === exiled ? clr.dangerBg : clr.bg2,
                    color: Number(n) === exiled ? clr.danger : clr.text2,
                    borderRadius: 'var(--border-radius-md)',
                    padding: '3px 10px',
                    fontSize: 13,
                  }}
                >
                  {n == 0 ? '棄票' : `${n}號`} {Number(v).toFixed(1)}票
                </span>
              )
          )}
        </div>
      )}
    </div>
  );
}

function PlayerVoteHistory({ voteHistory }) {
  const [open, setOpen] = useState(false);
  if (!voteHistory?.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          ...btn('default'),
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 3.5h10M2 7h10M2 10.5h6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        查看票型紀錄（{voteHistory.length} 輪）
      </button>
      {open && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {voteHistory.map((entry, i) => (
            <div key={i} style={{ ...card, marginBottom: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: clr.text,
                  marginBottom: 10,
                }}
              >
                {entry.label}
                {entry.winner && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 12,
                      color: clr.success,
                      background: clr.successBg,
                      padding: '2px 8px',
                      borderRadius: 'var(--border-radius-md)',
                    }}
                  >
                    當選 {entry.winner} 號
                  </span>
                )}
                {entry.exiled && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 12,
                      color: clr.danger,
                      background: clr.dangerBg,
                      padding: '2px 8px',
                      borderRadius: 'var(--border-radius-md)',
                    }}
                  >
                    放逐 {entry.exiled} 號
                  </span>
                )}
                {entry.pkLost && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 12,
                      color: clr.warn,
                      background: clr.warnBg,
                      padding: '2px 8px',
                      borderRadius: 'var(--border-radius-md)',
                    }}
                  >
                    警徽流失
                  </span>
                )}
                {entry.tied && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 12,
                      color: clr.text2,
                      background: clr.bg2,
                      padding: '2px 8px',
                      borderRadius: 'var(--border-radius-md)',
                    }}
                  >
                    平票
                  </span>
                )}
              </div>
              <PlayerVoteMatrix
                votes={entry.votes}
                candidates={entry.candidates}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PlayerGridGod: shows roles + dead status ──────────────────────────────
function PlayerGridGod({ room }) {
  const nums = Array.from({ length: PLAYER_COUNT }, (_, i) => i + 1);
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}
    >
      {nums.map((n) => {
        const roleId = room.roles?.[`p${n}`];
        const role = roleId ? ROLE_MAP[roleId] : null;
        const rc = roleId ? ROLE_COLORS[roleId] : null;
        const isDead = Object.values(room.players || {}).find(
          (p) => p.num === n
        )?.dead;
        const isSheriff = room.sheriff === n;
        return (
          <div
            key={n}
            style={{
              borderRadius: 'var(--border-radius-md)',
              border: `0.5px solid ${clr.border}`,
              padding: '8px 4px',
              textAlign: 'center',
              opacity: isDead ? 0.35 : 1,
              background: rc ? rc.bg : 'transparent',
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 500,
                color: rc ? rc.text : clr.text,
              }}
            >
              {n}
            </div>
            {isSheriff && (
              <div style={{ fontSize: 10, color: clr.warn }}>⭐ 警長</div>
            )}
            {role && (
              <div style={{ fontSize: 10, color: rc?.text || clr.text3 }}>
                {role.emoji}
                {role.label}
              </div>
            )}
            {isDead && (
              <div style={{ fontSize: 10, color: clr.danger }}>出局</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── PlayerGrid: for seat selection ───────────────────────────────────────
function PlayerGrid({ room, myNum, onSelect }) {
  const nums = Array.from({ length: PLAYER_COUNT }, (_, i) => i + 1);
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}
    >
      {nums.map((n) => {
        const isMe = myNum === n;
        const isSheriff = room.sheriff === n;
        const isDead = Object.values(room.players || {}).find(
          (p) => p.num === n
        )?.dead;
        return (
          <button
            key={n}
            onClick={() => onSelect && onSelect(n)}
            style={{
              ...btn(isMe ? 'primary' : 'default'),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '10px 4px',
              opacity: isDead ? 0.38 : 1,
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 500, lineHeight: 1 }}>
              {n}
            </span>
            {isSheriff && (
              <span style={{ fontSize: 10, color: clr.warn }}>⭐</span>
            )}
            {isDead && (
              <span style={{ fontSize: 10, color: clr.danger }}>出局</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── RoleAssigner ─────────────────────────────────────────────────────────
function RoleAssigner({ roles, preset, onChange }) {
  const nums = Array.from({ length: 12 }, (_, i) => i + 1);
  const suggested = {};
  if (preset?.roles?.length) {
    preset.roles.forEach((rid, i) => {
      if (nums[i]) suggested[`p${nums[i]}`] = rid;
    });
  }
  const setRole = (n, rid) => {
    const k = `p${n}`,
      next = { ...roles };
    if (next[k] === rid) delete next[k];
    else next[k] = rid;
    onChange(next);
  };
  return (
    <div style={{ marginBottom: 10 }}>
      {preset?.roles?.length > 0 && (
        <button
          onClick={() => onChange({ ...suggested })}
          style={{ ...btn('default'), fontSize: 12, marginBottom: 10 }}
        >
          套用版型預設排列
        </button>
      )}
      {nums.map((n) => {
        const assigned = roles[`p${n}`];
        return (
          <div
            key={n}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                minWidth: 36,
                fontSize: 13,
                fontWeight: 500,
                color: clr.text2,
              }}
            >
              {n} 號
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Object.keys(ROLE_MAP).map((rid) => {
                const r = ROLE_MAP[rid],
                  sel = assigned === rid,
                  rc2 = ROLE_COLORS[rid];
                return (
                  <button
                    key={rid}
                    onClick={() => setRole(n, rid)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 'var(--border-radius-md)',
                      fontSize: 12,
                      border: sel
                        ? `1.5px solid ${rc2.text}`
                        : `0.5px solid ${clr.border}`,
                      background: sel ? rc2.bg : 'transparent',
                      color: sel ? rc2.text : clr.text3,
                      cursor: 'pointer',
                      transition: 'all .1s',
                    }}
                  >
                    {r.emoji} {r.label}
                  </button>
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
  { key: 'grant_check', label: '查驗技能', emoji: '🔮' },
  { key: 'grant_poison', label: '毒藥技能', emoji: '☠' },
  { key: 'grant_gun', label: '獵槍技能', emoji: '🏹' },
];
const WITCH_SKILLS = [
  { key: 'save', label: '💊 使用解藥（救人）' },
  { key: 'poison', label: '☠ 使用毒藥（毒人）' },
  { key: 'skip', label: '跳過（不用藥）' },
];

function GodNightPanel({ room, godAction, loading }) {
  // Own internal state — fully isolated from parent polling re-renders
  const [na, setNa] = useState({});
  const stepIdx = room.nightStep || 0;
  // Reset local state only when nightStep changes (god moved to next step)
  const prevStepRef = useRef(stepIdx);
  useEffect(() => {
    if (prevStepRef.current !== stepIdx) {
      prevStepRef.current = stepIdx;
      setNa({});
    }
  }, [stepIdx]);

  const preset = PRESETS.find((p) => p.id === room.preset) || PRESETS[0];
  const fullOrder = preset.nightOrder;
  const isFirstNight = room.dayCount === 1;
  const order = fullOrder.filter((s) => isFirstNight || !s.firstNightOnly);
  const aliveNums = Array.from({ length: 12 }, (_, i) => i + 1).filter(
    (n) => !Object.values(room.players || {}).find((p) => p.num === n)?.dead
  );
  const night = room.night || {};
  const currentStep = order[stepIdx];
  // setNightActions shim for child components
  const setNightActions = setNa;

  // Players who hold a given roleId (from room.roles, filtered to alive)
  const roleOwners = (rid) =>
    Object.entries(room.roles || {})
      .filter(([, v]) => v === rid)
      .map(([k]) => Number(k.replace('p', '')))
      .filter((n) => aliveNums.includes(n));

  const dreamerNums = roleOwners('dreamer');
  const wolfKill = night.kill?.[0] || na.kill?.[0];

  // ── Build stepData and advance ───────────────────────────────────────────
  const advanceStep = async () => {
    const step = order[stepIdx];
    const act = step?.action;
    const stepData = {};
    if (act?.isWitch) {
      const choice = na.witchChoice;
      if (choice === 'save') stepData.witchSave = na.witchTarget || [];
      if (choice === 'poison') stepData.witchPoison = na.witchTarget || [];
    } else if (act?.isSwap) {
      stepData.swap = na.swap || [];
    } else if (act?.isGrant) {
      stepData.grant = na.grant || [];
      stepData.grantSkill = na.grantSkill_choice ? [na.grantSkill_choice] : [];
    } else if (act) {
      stepData[act.key] = na[act.key] || [];
    }
    if (dreamerNums.length) stepData.dreamerNum = dreamerNums[0];
    const identifyNums =
      isFirstNight && step?.identifyPlayers
        ? na[`id_${step.roleId}`] || []
        : [];
    await godAction('saveNightStep', {
      data: stepData,
      roleId: isFirstNight && step?.identifyPlayers ? step.roleId : null,
      nums: identifyNums,
      nextStep: stepIdx + 1,
    });
    setNa({});
  };

  const goBack = async () => {
    await godAction('saveNightStep', {
      data: {},
      roleId: null,
      nums: [],
      nextStep: stepIdx - 1,
    });
    setNa({});
  };

  const swapSel = na.swap || [];
  const swapPreview =
    swapSel.length === 2
      ? `${swapSel[0]} 號 ↔ ${swapSel[1]} 號`
      : swapSel.length === 1
      ? `${swapSel[0]} 號 ↔ ?`
      : null;

  return (
    <div style={card}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: clr.text,
          marginBottom: 4,
        }}
      >
        🌙 夜晚行動
      </div>
      <div style={{ fontSize: 12, color: clr.text3, marginBottom: 12 }}>
        第 {room.dayCount} 夜　
        {isFirstNight ? '首夜' : '（首夜限定步驟已略過）'}
      </div>

      {/* Progress bar */}
      <div
        style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}
      >
        {order.map((s, i) => {
          const r = ROLE_MAP[s.roleId],
            done = i < stepIdx,
            active = i === stepIdx;
          return (
            <div
              key={i}
              style={{
                padding: '3px 10px',
                borderRadius: 'var(--border-radius-md)',
                fontSize: 12,
                border: active
                  ? `1.5px solid ${clr.info}`
                  : `0.5px solid ${clr.border}`,
                background: done
                  ? clr.bg3
                  : active
                  ? clr.infoBg
                  : 'transparent',
                color: done ? clr.text3 : active ? clr.info : clr.text2,
                fontWeight: active ? 500 : 400,
              }}
            >
              {r?.emoji} {r?.label} {done && '✓'}
            </div>
          );
        })}
      </div>

      {currentStep ? (
        (() => {
          const role = ROLE_MAP[currentStep.roleId];
          const act = currentStep.action;
          const rc = ROLE_COLORS[currentStep.roleId];
          const knownOwners = roleOwners(currentStep.roleId);
          const witchChoice = na.witchChoice;

          return (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--border-radius-md)',
                border: `1.5px solid ${rc?.text || clr.info}`,
                background: rc?.bg || clr.infoBg,
                marginBottom: 14,
              }}
            >
              {/* Header */}
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: rc?.text || clr.info,
                  marginBottom: 4,
                }}
              >
                {role?.emoji} {currentStep.label}
              </div>
              {currentStep.firstNightOnly && (
                <div style={{ fontSize: 11, color: clr.warn, marginBottom: 6 }}>
                  ★ 僅首夜行動
                </div>
              )}
              {currentStep.note && (
                <div
                  style={{
                    fontSize: 12,
                    color: clr.text2,
                    marginBottom: 8,
                    padding: '4px 8px',
                    borderRadius: 'var(--border-radius-md)',
                    background: 'rgba(0,0,0,0.04)',
                  }}
                >
                  📌 {currentStep.note}
                </div>
              )}

              {/* ① 首夜：輸入角色玩家號碼 */}
              {isFirstNight && currentStep.identifyPlayers && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: '8px 10px',
                    borderRadius: 'var(--border-radius-md)',
                    background: 'rgba(0,0,0,0.05)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: clr.text,
                      marginBottom: 4,
                    }}
                  >
                    ① {role?.label} 是幾號玩家？
                  </div>
                  <NightPickBtn
                    stateKey={`id_${currentStep.roleId}`}
                    multi={true}
                    label="請選擇（可多選）"
                    opts={aliveNums}
                    na={na}
                    setNightActions={setNightActions}
                  />
                </div>
              )}

              {/* 非首夜：顯示已知號碼 */}
              {!isFirstNight && knownOwners.length > 0 && (
                <div
                  style={{
                    marginBottom: 10,
                    padding: '6px 10px',
                    borderRadius: 'var(--border-radius-md)',
                    background: 'rgba(0,0,0,0.05)',
                    fontSize: 13,
                    color: rc?.text || clr.info,
                  }}
                >
                  {role?.label}：{knownOwners.join('、')} 號
                </div>
              )}

              {/* ② 技能施放 */}
              {act && (
                <div
                  style={{
                    borderTop:
                      isFirstNight && currentStep.identifyPlayers
                        ? `0.5px solid rgba(0,0,0,0.08)`
                        : 'none',
                    paddingTop:
                      isFirstNight && currentStep.identifyPlayers ? 10 : 0,
                  }}
                >
                  {isFirstNight && currentStep.identifyPlayers && (
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: clr.text,
                        marginBottom: 6,
                      }}
                    >
                      ② 技能施放目標
                    </div>
                  )}

                  {/* WITCH：擇一技能再選目標 */}
                  {act.isWitch && (
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: clr.text2,
                          marginBottom: 4,
                        }}
                      >
                        今晚被殺：
                        <strong>
                          {wolfKill ? `${wolfKill} 號` : '無（平安夜）'}
                        </strong>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: clr.text2,
                          marginBottom: 2,
                        }}
                      >
                        請選擇使用哪項技能
                      </div>
                      <NightChoiceBtn
                        choices={WITCH_SKILLS}
                        stateKey="witchChoice"
                        na={na}
                        setNightActions={setNightActions}
                      />
                      {witchChoice && witchChoice !== 'skip' && (
                        <div style={{ marginTop: 10 }}>
                          <NightPickBtn
                            stateKey="witchTarget"
                            multi={false}
                            label={
                              witchChoice === 'save'
                                ? '選擇救人目標'
                                : '選擇毒殺目標'
                            }
                            opts={aliveNums}
                            na={na}
                            setNightActions={setNightActions}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* SWAP（魔術師）：選兩人 */}
                  {act.isSwap && (
                    <div>
                      <NightPickBtn
                        stateKey="swap"
                        multi={true}
                        label="選擇互換的兩名玩家（點選兩人）"
                        opts={aliveNums}
                        na={na}
                        setNightActions={setNightActions}
                      />
                      {swapPreview && (
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 13,
                            fontWeight: 500,
                            color: rc?.text || clr.info,
                            padding: '6px 10px',
                            borderRadius: 'var(--border-radius-md)',
                            background: 'rgba(0,0,0,0.06)',
                          }}
                        >
                          🎩 互換預覽：{swapPreview}
                        </div>
                      )}
                      {swapSel.length > 2 && (
                        <div
                          style={{
                            fontSize: 12,
                            color: clr.danger,
                            marginTop: 4,
                          }}
                        >
                          只能選兩人，請重新選擇
                        </div>
                      )}
                    </div>
                  )}

                  {/* GRANT（奇蹟商人）：先選技能種類，再選授予目標 */}
                  {act.isGrant && (
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: clr.text2,
                          marginBottom: 2,
                        }}
                      >
                        選擇授予的技能種類
                      </div>
                      <NightChoiceBtn
                        choices={GRANT_SKILLS.map((g) => ({
                          key: g.key,
                          label: `${g.emoji} ${g.label}`,
                        }))}
                        stateKey="grantSkill_choice"
                        na={na}
                        setNightActions={setNightActions}
                      />
                      {na.grantSkill_choice && (
                        <div style={{ marginTop: 10 }}>
                          <NightPickBtn
                            stateKey="grant"
                            multi={false}
                            label="選擇授予的玩家"
                            opts={aliveNums}
                            na={na}
                            setNightActions={setNightActions}
                          />
                        </div>
                      )}
                      {na.grant?.[0] && na.grantSkill_choice && (
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 13,
                            color: clr.success,
                          }}
                        >
                          ✓ {na.grant[0]} 號 獲得{' '}
                          {
                            GRANT_SKILLS.find(
                              (g) => g.key === na.grantSkill_choice
                            )?.label
                          }
                        </div>
                      )}
                    </div>
                  )}

                  {/* 一般目標 */}
                  {!act.isWitch && !act.isSwap && !act.isGrant && (
                    <NightPickBtn
                      stateKey={act.key}
                      multi={act.multi || false}
                      label={act.label}
                      opts={aliveNums}
                      na={na}
                      setNightActions={setNightActions}
                    />
                  )}
                </div>
              )}

              {/* 無行動 */}
              {!act && (
                <div
                  style={{
                    fontSize: 12,
                    color: clr.text3,
                    fontStyle: 'italic',
                  }}
                >
                  此角色夜晚無行動，請閉眼
                </div>
              )}

              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <button
                  disabled={loading}
                  onClick={advanceStep}
                  style={{ ...btn('primary') }}
                >
                  {stepIdx >= order.length - 1 ? '完成最後一步 →' : '下一步 →'}
                </button>
                {stepIdx > 0 && (
                  <button
                    disabled={loading}
                    onClick={goBack}
                    style={{ ...btn('default'), fontSize: 13 }}
                  >
                    ← 上一步
                  </button>
                )}
              </div>
            </div>
          );
        })()
      ) : (
        /* 全部完成 */
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--border-radius-md)',
            background: clr.successBg,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: clr.success,
              fontWeight: 500,
              marginBottom: 10,
            }}
          >
            ✓ 所有角色行動完畢
          </div>
          <div
            style={{
              fontSize: 12,
              color: clr.text2,
              marginBottom: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            {night.kill?.[0] && <div>🐺 狼殺目標：{night.kill[0]} 號</div>}
            {night.guard?.[0] && <div>🛡 守衛守護：{night.guard[0]} 號</div>}
            {night.dream?.[0] && <div>🌙 攝夢目標：{night.dream[0]} 號</div>}
            {night.witchSave?.[0] && (
              <div>💊 女巫救人：{night.witchSave[0]} 號</div>
            )}
            {night.witchPoison?.[0] && (
              <div>☠ 女巫毒殺：{night.witchPoison[0]} 號</div>
            )}
            {night.swap?.length === 2 && (
              <div>
                🎩 魔術師互換：{night.swap[0]} 號 ↔ {night.swap[1]} 號
              </div>
            )}
            {night.grant?.[0] && (
              <div>
                🛒 商人授予 {night.grant[0]} 號：
                {GRANT_SKILLS.find((g) => g.key === night.grantSkill?.[0])
                  ?.label || '技能'}
              </div>
            )}
            {night.idol?.[0] && <div>💘 偶像：{night.idol[0]} 號</div>}
            {night.check?.[0] && <div>🔮 預言家查驗：{night.check[0]} 號</div>}
          </div>
          <button
            disabled={loading}
            onClick={async () => {
              await godAction('resolveNight');
              setNa({});
            }}
            style={{ ...btn('success') }}
          >
            結算夜晚・公布死訊
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Main App
// ══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState('home');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [myNum, setMyNum] = useState(null);
  const [isGod, setIsGod] = useState(false);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [godInput, setGodInput] = useState({});
  const [myVote, setMyVote] = useState(null);
  const [voted, setVoted] = useState(false);
  const pollRef = useRef(null);
  const prevPhaseRef = useRef(null);

  const poll = useCallback(async () => {
    if (!roomCode) return;
    const r = await loadRoom(roomCode);
    if (r) setRoom((prev) => (prev?.updatedAt === r.updatedAt ? prev : r));
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
      setMyVote(null);
      setVoted(false);
      prevPhaseRef.current = room.phase;
    }
  }, [room?.phase]);

  // ── Create / Join ───────────────────────────────────────────────────────
  async function createRoom() {
    setLoading(true);
    setError('');
    const code = genRoomCode();
    const presetId = godInput.selectedPreset || 'std';
    const preset = PRESETS.find((p) => p.id === presetId) || PRESETS[0];
    const r = defaultRoom(code, presetId);
    r.log.push(`建立對局，版型：${preset.label}`);
    await saveRoom(r);
    setRoomCode(code);
    setIsGod(true);
    setRoom(r);
    setScreen('god');
    setLoading(false);
  }

  async function joinRoom() {
    setError('');
    if (!inputCode.trim()) return setError('請輸入房號');
    const code = inputCode.toUpperCase().trim();
    const r = await loadRoom(code);
    if (!r) return setError('找不到房間，請確認房號');
    setRoomCode(code);
    setRoom(r);
    setScreen('join');
  }

  async function selectSeat(n) {
    const r = await loadRoom(roomCode);
    if (!r.players[`p${n}`]) {
      r.players[`p${n}`] = { num: n, dead: false };
      r.log.push(`玩家選擇了 ${n} 號座位`);
      await saveRoom(r);
    }
    setMyNum(n);
    setRoom(r);
    setScreen('player');
  }

  async function rejoinAsGod() {
    setIsGod(true);
    setScreen('god');
  }

  // ── God actions ─────────────────────────────────────────────────────────
  async function godAction(action, payload = {}) {
    setError('');
    setLoading(true);
    try {
      const r = await loadRoom(roomCode);
      const aliveNums = () =>
        Array.from({ length: 12 }, (_, i) => i + 1).filter(
          (n) => !Object.values(r.players).find((p) => p.num === n)?.dead
        );

      switch (action) {
        case 'startCampaign': {
          const cands = payload.candidates;
          if (!cands?.length) return setError('請選擇上警玩家');
          const shuffled = shuffle(cands),
            starter = shuffled[0],
            dir = Math.random() > 0.5 ? '順時針' : '逆時針';
          r.campaign.candidates = cands;
          r.campaign.speakers = shuffled;
          r.campaign.currentSpeaker = starter;
          r.campaign.speakerDir = dir;
          r.phase = 'campaign';
          r.log.push(
            `上警：${cands.join('、')} 號，首發：${starter} 號，方向：${dir}`
          );
          break;
        }

        case 'finalizeCandidates': {
          const finals = payload.finals;
          if (!finals?.length) return setError('請選擇最終競選玩家');
          r.campaign.finalCandidates = finals;
          r.campaign.votes = {};
          r.phase = 'campaignVote';
          r.log.push(`最終競選：${finals.join('、')} 號，開始投票`);
          break;
        }

        case 'tallyVotes': {
          const votes = r.campaign.votes;
          const finals = r.campaign.pkRound
            ? r.campaign.pkCandidates
            : r.campaign.finalCandidates;
          const tally = {};
          finals.forEach((n) => (tally[n] = 0));
          tally[0] = 0;
          Object.entries(votes).forEach(([voter, target]) => {
            const w = Number(voter) === r.sheriff ? 1.5 : 1;
            if (tally[target] !== undefined) tally[target] += w;
            else tally[target] = w;
          });
          const maxV = Math.max(...finals.map((n) => tally[n] || 0));
          const winners = finals.filter((n) => (tally[n] || 0) === maxV);
          const lbl = r.campaign.pkRound ? '警長競選 PK' : '警長競選';
          if (winners.length === 1) {
            r.sheriff = winners[0];
            r.campaign.result = { winner: winners[0], tally };
            r.campaign.votesPublished = true;
            r.voteHistory.push({
              type: 'campaign',
              label: lbl,
              candidates: finals,
              votes: { ...votes },
              tally,
              winner: winners[0],
            });
            r.phase = 'campaignVote';
            r.log.push(`${winners[0]} 號當選警長！`);
          } else if (r.campaign.pkRound) {
            r.sheriff = null;
            r.sheriffBadgeLost = true;
            r.campaign.result = { winner: null, tally, pkLost: true };
            r.campaign.votesPublished = true;
            r.voteHistory.push({
              type: 'campaign',
              label: lbl,
              candidates: finals,
              votes: { ...votes },
              tally,
              winner: null,
              pkLost: true,
            });
            const fp = shuffle(aliveNums())[0],
              fd = Math.random() > 0.5 ? '順時針' : '逆時針';
            r.firstSpeaker = fp;
            r.firstSpeakerDir = fd;
            r.phase = 'campaignVote';
            r.log.push(`再次平票，警徽流失！首發：${fp} 號，方向：${fd}`);
          } else {
            r.campaign.pkRound = true;
            r.campaign.pkCandidates = winners;
            r.campaign.votes = {};
            r.campaign.result = null;
            r.campaign.votesPublished = true;
            r.voteHistory.push({
              type: 'campaign',
              label: '警長競選（首輪）',
              candidates: finals,
              votes: { ...votes },
              tally,
              pk: true,
              pkCandidates: winners,
            });
            r.phase = 'campaignPK';
            r.log.push(`平票！PK：${winners.join('、')} 號`);
          }
          break;
        }

        case 'startPK': {
          r.campaign.votes = {};
          r.campaign.votesPublished = false;
          r.log.push(`PK 開始：${r.campaign.pkCandidates.join('、')} 號`);
          break;
        }

        case 'setRoles': {
          r.roles = payload.roles;
          r.log.push('角色設定完畢');
          break;
        }

        case 'startNight': {
          r.phase = 'night';
          r.nightStep = 0;
          r.night = {
            kill: [],
            guard: [],
            check: [],
            witchSave: [],
            witchPoison: [],
            hunter: [],
          };
          r.log.push(`第 ${r.dayCount} 夜開始`);
          break;
        }

        case 'saveNightStep': {
          if (!r.night)
            r.night = {
              kill: [],
              guard: [],
              check: [],
              witchSave: [],
              witchPoison: [],
              hunter: [],
            };
          Object.entries(payload.data || {}).forEach(
            ([k, v]) => (r.night[k] = v)
          );
          if (payload.roleId && payload.nums?.length) {
            payload.nums.forEach((n) => {
              r.roles[`p${n}`] = payload.roleId;
            });
          }
          r.nightStep = payload.nextStep || 0;
          break;
        }

        case 'resolveNight': {
          const deaths = computeNightDeaths(r.night);
          deaths.forEach((d) => {
            if (!r.players[`p${d.num}`])
              r.players[`p${d.num}`] = { num: d.num, dead: false };
            r.players[`p${d.num}`].dead = true;
          });
          // fill unassigned as village
          if (!r.rolesRevealed) {
            Array.from({ length: 12 }, (_, i) => i + 1).forEach((n) => {
              if (!r.roles[`p${n}`]) r.roles[`p${n}`] = 'village';
            });
            r.rolesRevealed = true;
          }
          r.night.resolved = true;
          r.night.deaths = deaths;
          r.phase = 'day';
          r.exile.votes = {};
          r.exile.result = null;
          r.exile.published = false;
          r.exile.targetOptions = aliveNums();
          r.log.push(
            deaths.length === 0
              ? '夜晚平安，無人出局'
              : `夜晚出局：${deaths
                  .map((d) => d.num + '號(' + d.reason + ')')
                  .join('、')}`
          );
          r.log.push(`第 ${r.dayCount} 天白天開始`);
          break;
        }

        case 'tallyExile': {
          const votes = r.exile.votes,
            targets = r.exile.targetOptions;
          const tally = {};
          targets.forEach((n) => (tally[n] = 0));
          tally[0] = 0;
          Object.entries(votes).forEach(([voter, target]) => {
            const w = Number(voter) === r.sheriff ? 1.5 : 1;
            if (tally[target] !== undefined) tally[target] += w;
            else tally[target] = w;
          });
          const maxV = Math.max(...targets.map((n) => tally[n] || 0));
          const tied = targets.filter((n) => (tally[n] || 0) === maxV);
          const dayLabel = `第 ${r.dayCount} 天放逐`;
          if (tied.length === 1) {
            const exiled = tied[0];
            if (r.players[`p${exiled}`]) r.players[`p${exiled}`].dead = true;
            r.exile.result = { exiled, tally };
            r.exile.published = true;
            r.voteHistory.push({
              type: 'exile',
              label: dayLabel,
              candidates: targets,
              votes: { ...votes },
              tally,
              exiled,
            });
            r.phase = 'result';
            r.log.push(`${exiled} 號被放逐出局`);
          } else {
            r.exile.result = { tied, tally };
            r.exile.published = true;
            r.voteHistory.push({
              type: 'exile',
              label: dayLabel,
              candidates: targets,
              votes: { ...votes },
              tally,
              tied,
            });
            r.phase = 'result';
            r.log.push(`平票！${tied.join('、')} 號無人被放逐`);
          }
          r.dayCount++;
          break;
        }

        case 'transferSheriff': {
          r.sheriff = payload.to;
          r.log.push(payload.to ? `警徽移交給 ${payload.to} 號` : '警徽銷毀');
          break;
        }

        case 'startNightNext': {
          r.phase = 'night';
          r.nightStep = 0;
          r.night = {
            kill: [],
            guard: [],
            check: [],
            witchSave: [],
            witchPoison: [],
            hunter: [],
          };
          r.log.push(`第 ${r.dayCount} 夜開始`);
          break;
        }
      }

      await saveRoom(r);
      setRoom(r);
    } catch (e) {
      setError('操作失敗：' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function castVote(target) {
    if (voted) return;
    const r = await loadRoom(roomCode),
      voter = myNum;
    if (r.phase === 'campaignVote' || r.phase === 'campaignPK') {
      r.campaign.votes[voter] = target;
      r.log.push(`${voter} 號投給 ${target === 0 ? '棄票' : target + ' 號'}`);
    } else if (r.phase === 'day') {
      r.exile.votes[voter] = target;
      r.log.push(
        `${voter} 號放逐票投給 ${target === 0 ? '棄票' : target + ' 號'}`
      );
    }
    await saveRoom(r);
    setRoom(r);
    setMyVote(target);
    setVoted(true);
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  const inputStyle = {
    padding: '10px 14px',
    borderRadius: 'var(--border-radius-md)',
    border: `0.5px solid ${clr.border2}`,
    background: clr.bg,
    color: clr.text,
    fontSize: 16,
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    marginBottom: 10,
  };

  // ── HOME ─────────────────────────────────────────────────────────────────
  if (screen === 'home')
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1rem' }}>
        <h2 style={{ color: clr.text, marginBottom: 4 }}>🐺 狼人殺投票系統</h2>
        <p style={{ color: clr.text2, marginBottom: 24, fontSize: 14 }}>
          12人局 · 線下輔助工具
        </p>
        <div style={card}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: clr.text,
              marginBottom: 10,
            }}
          >
            選擇版型（上帝建立房間）
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginBottom: 14,
            }}
          >
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  setGodInput((prev) => ({ ...prev, selectedPreset: p.id }))
                }
                style={{
                  textAlign: 'left',
                  padding: '10px 14px',
                  borderRadius: 'var(--border-radius-md)',
                  border:
                    godInput.selectedPreset === p.id
                      ? `1.5px solid ${clr.info}`
                      : `0.5px solid ${clr.border2}`,
                  background:
                    godInput.selectedPreset === p.id
                      ? clr.infoBg
                      : 'transparent',
                  color: clr.text,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: 14,
                    color:
                      godInput.selectedPreset === p.id ? clr.info : clr.text,
                  }}
                >
                  {p.label}
                </div>
                <div style={{ fontSize: 12, color: clr.text3, marginTop: 2 }}>
                  {p.desc}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={createRoom}
            disabled={loading || !godInput.selectedPreset}
            style={{
              ...btn('primary', !godInput.selectedPreset),
              width: '100%',
              marginBottom: 14,
              padding: 12,
              fontSize: 15,
            }}
          >
            {loading ? '建立中...' : '建立新對局（上帝）'}
          </button>
          <div
            style={{ borderTop: `0.5px solid ${clr.border}`, paddingTop: 14 }}
          >
            <div style={{ fontSize: 13, color: clr.text2, marginBottom: 8 }}>
              加入現有對局
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="輸入房號"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
              />
              <button
                onClick={joinRoom}
                style={{ ...btn('default'), whiteSpace: 'nowrap' }}
              >
                加入
              </button>
            </div>
          </div>
          {error && (
            <div style={{ color: clr.danger, fontSize: 13, marginTop: 8 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    );

  // ── JOIN ─────────────────────────────────────────────────────────────────
  if (screen === 'join' && room)
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1rem' }}>
        <h2 style={{ color: clr.text }}>選擇你的號碼</h2>
        <p style={{ color: clr.text2, fontSize: 13 }}>
          房號：<strong>{room.code}</strong>
        </p>
        <div style={card}>
          <button
            onClick={rejoinAsGod}
            style={{
              ...btn('warn'),
              width: '100%',
              padding: '10px 0',
              fontSize: 14,
              marginBottom: 14,
            }}
          >
            以上帝身份進入
          </button>
          <div
            style={{
              fontSize: 12,
              color: clr.text3,
              marginBottom: 10,
              textAlign: 'center',
            }}
          >
            — 或選擇玩家號碼 —
          </div>
          <PlayerGrid room={room} myNum={myNum} onSelect={selectSeat} />
          {error && (
            <div style={{ color: clr.danger, fontSize: 13, marginTop: 8 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    );

  if (!room)
    return <div style={{ padding: 32, color: clr.text2 }}>載入中...</div>;

  const phase = room.phase,
    campaign = room.campaign,
    exile = room.exile,
    sheriff = room.sheriff;

  // ══════════════════════════════════════════════════════════════════════
  // GOD VIEW
  // ══════════════════════════════════════════════════════════════════════
  if (isGod)
    return (
      <GodView
        room={room}
        phase={phase}
        campaign={campaign}
        exile={exile}
        sheriff={sheriff}
        loading={loading}
        error={error}
        godInput={godInput}
        setGodInput={setGodInput}
        godAction={godAction}
      />
    );

  // ══════════════════════════════════════════════════════════════════════
  // PLAYER VIEW
  // ══════════════════════════════════════════════════════════════════════
  const isAlive = !Object.values(room.players).find((p) => p.num === myNum)
    ?.dead;
  const isSheriff = myNum === sheriff;

  return (
    <div style={{ maxWidth: 440, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: clr.text }}>
            {myNum} 號玩家 {isSheriff && '⭐'}
          </h2>
          <span style={{ fontSize: 13, color: clr.text2 }}>
            房號：{room.code}
          </span>
        </div>
        <span style={tag(phase === 'lobby' ? 'gray' : 'info')}>
          {PHASES[phase] || phase}
        </span>
      </div>

      {/* LOBBY */}
      {phase === 'lobby' && (
        <div style={card}>
          <div style={{ fontSize: 14, color: clr.text2 }}>
            等待上帝開始遊戲...
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: clr.text3 }}>
            玩家人數：{Object.keys(room.players).length}/12
          </div>
        </div>
      )}

      {/* NIGHT */}
      {phase === 'night' && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 500, color: clr.text }}>
            🌙 夜晚
          </div>
          <div style={{ fontSize: 13, color: clr.text3, marginTop: 6 }}>
            請閉眼，等待上帝指引...
          </div>
        </div>
      )}

      {/* DAY: night death banner */}
      {phase === 'day' && room.night?.deaths && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--border-radius-md)',
            marginBottom: 12,
            background:
              room.night.deaths.length === 0 ? clr.successBg : clr.dangerBg,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: room.night.deaths.length === 0 ? clr.success : clr.danger,
            }}
          >
            {room.night.deaths.length === 0
              ? '🌙 昨夜平安，無人出局'
              : `🌙 昨夜出局：${room.night.deaths
                  .map((d) => d.num + ' 號')
                  .join('、')}`}
          </span>
        </div>
      )}

      {/* CAMPAIGN INFO */}
      {phase === 'campaign' && (
        <div style={card}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: clr.text,
              marginBottom: 8,
            }}
          >
            警長競選·發言環節
          </div>
          <div style={{ fontSize: 13, color: clr.text2 }}>
            競選玩家：{campaign.candidates.join('、')} 號
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: clr.info }}>
            首發：{campaign.currentSpeaker} 號，方向：{campaign.speakerDir}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: clr.text3 }}>
            等待上帝宣布最終競選名單...
          </div>
        </div>
      )}

      {/* CAMPAIGN VOTE */}
      {(phase === 'campaignVote' || phase === 'campaignPK') &&
        !campaign.result &&
        (() => {
          const isPK = phase === 'campaignPK';
          const actCands = isPK
            ? campaign.pkCandidates
            : campaign.finalCandidates;
          const inelig = isPK
            ? campaign.pkCandidates
            : campaign.finalCandidates;
          const isInelig = inelig.includes(myNum);
          const canVote = isAlive && !isInelig;
          const announcing =
            isPK &&
            !campaign.votesPublished &&
            Object.keys(campaign.votes).length === 0;
          return (
            <div style={card}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: clr.text,
                  marginBottom: 8,
                }}
              >
                {isPK ? '⚡ 平票 PK 重新投票' : '投票選出警長'}
              </div>
              <div style={{ fontSize: 13, color: clr.text2, marginBottom: 12 }}>
                競選玩家：{actCands.join('、')} 號
                {isInelig && (
                  <span
                    style={{
                      fontSize: 12,
                      color: clr.danger,
                      display: 'block',
                      marginTop: 4,
                    }}
                  >
                    {isPK ? '你是 PK 玩家，不可投票' : '你是警上玩家，不可投票'}
                  </span>
                )}
              </div>
              {announcing ? (
                <div style={{ fontSize: 13, color: clr.warn }}>
                  等待上帝宣布 PK 開始...
                </div>
              ) : canVote && !voted ? (
                <VoteButtons
                  options={[...actCands, 0]}
                  onVote={castVote}
                  label="選擇你支持的玩家"
                />
              ) : canVote && voted ? (
                <div style={{ fontSize: 13, color: clr.success }}>
                  ✓ 已投票 → {myVote === 0 ? '棄票' : myVote + ' 號'}
                </div>
              ) : !isAlive ? (
                <div style={{ fontSize: 13, color: clr.text3 }}>
                  你已出局，無法投票
                </div>
              ) : null}
              {!announcing &&
                (campaign.votesPublished ? (
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: clr.text,
                        marginBottom: 8,
                      }}
                    >
                      票型公布
                    </div>
                    <PlayerVoteMatrix
                      votes={campaign.votes}
                      candidates={actCands}
                    />
                  </div>
                ) : (
                  <div
                    style={{ marginTop: 12, fontSize: 12, color: clr.text3 }}
                  >
                    等待上帝公布票型...
                  </div>
                ))}
            </div>
          );
        })()}

      {/* CAMPAIGN RESULT */}
      {(phase === 'campaignVote' || phase === 'campaignPK') &&
        campaign.result && (
          <div style={card}>
            <CampaignResult result={campaign.result} />
          </div>
        )}

      {/* DAY VOTE */}
      {phase === 'day' && (
        <div style={card}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: clr.text,
              marginBottom: 8,
            }}
          >
            第 {room.dayCount} 天·放逐投票
          </div>
          {isSheriff && (
            <div style={{ fontSize: 12, color: clr.warn, marginBottom: 8 }}>
              ⭐ 你是警長，票數 ×1.5
            </div>
          )}
          {isAlive && !voted ? (
            <VoteButtons
              options={[...exile.targetOptions, 0]}
              onVote={castVote}
              label="選擇放逐的玩家"
              isDanger
            />
          ) : (
            <div style={{ fontSize: 13, color: clr.success }}>
              {voted
                ? `已投票 → ${myVote === 0 ? '棄票' : myVote + ' 號'}`
                : '你已出局，無法投票'}
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 12, color: clr.text3 }}>
            等待上帝公布票型...
          </div>
        </div>
      )}

      {/* EXILE RESULT */}
      {phase === 'result' && exile.result && exile.published && (
        <div style={card}>
          <ExileResult result={exile.result} />
        </div>
      )}
      {phase === 'result' && exile.result && !exile.published && (
        <div style={card}>
          <div style={{ fontSize: 13, color: clr.text3 }}>
            等待上帝公布放逐結果...
          </div>
        </div>
      )}

      <PlayerVoteHistory voteHistory={room.voteHistory || []} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// GodView Component
// ══════════════════════════════════════════════════════════════════════════
function GodView({
  room,
  phase,
  campaign,
  exile,
  sheriff,
  loading,
  error,
  godInput,
  setGodInput,
  godAction,
}) {
  const [tab, setTab] = useState(phase === 'night' ? 'night' : 'day');
  // Auto-switch tab when phase changes
  useEffect(() => {
    if (phase === 'night') setTab('night');
  }, [phase]);

  const preset = PRESETS.find((p) => p.id === room.preset) || PRESETS[0];
  const aliveNums = Array.from({ length: 12 }, (_, i) => i + 1).filter(
    (n) => !Object.values(room.players || {}).find((p) => p.num === n)?.dead
  );

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: clr.text }}>上帝視角</h2>
          <span style={{ fontSize: 13, color: clr.text2 }}>
            房號：<strong>{room.code}</strong>
            <span style={tag('gray')}>{preset.label}</span>
          </span>
        </div>
        <span style={tag(phase === 'lobby' ? 'gray' : 'info')}>
          {PHASES[phase] || phase}
        </span>
      </div>

      {/* Player status grid */}
      <div style={card}>
        <div style={{ fontSize: 13, color: clr.text2, marginBottom: 8 }}>
          玩家狀態（{Object.keys(room.players).length}/12）
        </div>
        <PlayerGridGod room={room} />
        {sheriff && (
          <div style={{ marginTop: 8, fontSize: 13, color: clr.warn }}>
            ⭐ 警長：{sheriff} 號（計票 ×1.5）
          </div>
        )}
        {room.sheriffBadgeLost && (
          <div style={{ fontSize: 13, color: clr.danger }}>⚠ 警徽流失</div>
        )}
        {room.firstSpeaker && !sheriff && (
          <div style={{ fontSize: 13, color: clr.info, marginTop: 4 }}>
            首發：{room.firstSpeaker} 號，方向：{room.firstSpeakerDir}
          </div>
        )}
      </div>

      {/* Tab bar (skip in lobby) */}
      {phase !== 'lobby' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[
            ['night', '🌙 夜間環節'],
            ['day', '☀ 白天環節'],
          ].map(([t, lbl]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 'var(--border-radius-md)',
                fontSize: 14,
                fontWeight: 500,
                border:
                  tab === t
                    ? `1.5px solid ${clr.info}`
                    : `0.5px solid ${clr.border2}`,
                background: tab === t ? clr.infoBg : 'transparent',
                color: tab === t ? clr.info : clr.text2,
                cursor: 'pointer',
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      )}

      {/* ── LOBBY ── */}
      {phase === 'lobby' && (
        <div style={card}>
          {/* Night order reference */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: clr.text,
              marginBottom: 10,
            }}
          >
            🌙 夜間行動順序
          </div>
          <div style={{ fontSize: 12, color: clr.text3, marginBottom: 12 }}>
            {preset.desc}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              marginBottom: 16,
            }}
          >
            {preset.nightOrder.map((s, i) => {
              const role = ROLE_MAP[s.roleId];
              const rc = ROLE_COLORS[s.roleId];
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 'var(--border-radius-md)',
                    background: rc?.bg || clr.bg2,
                    border: `0.5px solid ${clr.border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: rc?.text || clr.text2,
                      minWidth: 20,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: rc?.text || clr.text,
                      }}
                    >
                      {role?.emoji} {role?.label}
                      {s.firstNightOnly && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 11,
                            color: clr.warn,
                            background: clr.warnBg,
                            padding: '1px 6px',
                            borderRadius: 'var(--border-radius-md)',
                          }}
                        >
                          僅首夜
                        </span>
                      )}
                    </div>
                    {s.action && (
                      <div
                        style={{
                          fontSize: 12,
                          color: rc?.text || clr.text2,
                          opacity: 0.8,
                          marginTop: 2,
                        }}
                      >
                        {s.action.isWitch
                          ? '救人 / 毒人'
                          : s.action.isSwap
                          ? '互換兩名玩家'
                          : s.action.isGrant
                          ? '授予技能'
                          : s.action.label}
                      </div>
                    )}
                    {!s.action && (
                      <div
                        style={{
                          fontSize: 12,
                          color: rc?.text || clr.text2,
                          opacity: 0.7,
                          marginTop: 2,
                        }}
                      >
                        確認狀態
                      </div>
                    )}
                    {s.note && (
                      <div
                        style={{ fontSize: 11, color: clr.text3, marginTop: 2 }}
                      >
                        📌 {s.note}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Campaign start */}
          <div
            style={{ borderTop: `0.5px solid ${clr.border}`, paddingTop: 14 }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: clr.text,
                marginBottom: 10,
              }}
            >
              開始警長競選
            </div>
            <MultiNumberSelect
              label="選擇上警玩家"
              value={godInput.candidates || []}
              onChange={(v) => setGodInput((p) => ({ ...p, candidates: v }))}
            />
            <button
              disabled={loading || !godInput.candidates?.length}
              onClick={() =>
                godAction('startCampaign', { candidates: godInput.candidates })
              }
              style={{ ...btn('primary'), marginTop: 4 }}
            >
              開始競選
            </button>
          </div>
        </div>
      )}

      {/* ── NIGHT TAB ── */}
      {tab === 'night' && phase === 'night' && (
        <GodNightPanel room={room} godAction={godAction} loading={loading} />
      )}
      {tab === 'night' && phase !== 'night' && phase !== 'lobby' && (
        <div style={card}>
          <div style={{ fontSize: 13, color: clr.text3 }}>
            {phase === 'day' && room.night?.deaths != null ? (
              <span
                style={{
                  color:
                    room.night.deaths.length === 0 ? clr.success : clr.danger,
                }}
              >
                {room.night.deaths.length === 0
                  ? '🌙 昨夜平安，無人出局'
                  : `🌙 昨夜出局：${room.night.deaths
                      .map((d) => d.num + '號(' + d.reason + ')')
                      .join('、')}`}
              </span>
            ) : (
              '目前為白天階段，切換到白天環節進行操作'
            )}
          </div>
        </div>
      )}

      {/* ── DAY TAB ── */}
      {(tab === 'day' || phase === 'lobby') && (
        <>
          {/* CAMPAIGN */}
          {phase === 'campaign' && (
            <div style={card}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: clr.text,
                  marginBottom: 8,
                }}
              >
                步驟二：選出繼續競選玩家
              </div>
              <div style={{ fontSize: 13, color: clr.text2, marginBottom: 8 }}>
                首發：<strong>{campaign.currentSpeaker} 號</strong>，方向：
                {campaign.speakerDir}
              </div>
              <MultiNumberSelect
                label="最終留下競選的玩家"
                value={godInput.finals || []}
                onChange={(v) => setGodInput((p) => ({ ...p, finals: v }))}
              />
              <button
                disabled={loading || !godInput.finals?.length}
                onClick={() =>
                  godAction('finalizeCandidates', { finals: godInput.finals })
                }
                style={{ ...btn('primary') }}
              >
                確認 → 開始投票
              </button>
            </div>
          )}

          {/* CAMPAIGN VOTE */}
          {phase === 'campaignVote' && !campaign.result && (
            <div style={card}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: clr.text,
                  marginBottom: 8,
                }}
              >
                警長投票進行中
              </div>
              <div style={{ fontSize: 13, color: clr.text2, marginBottom: 12 }}>
                競選玩家：{campaign.finalCandidates.join('、')} 號
                <span
                  style={{ marginLeft: 8, color: clr.danger, fontSize: 12 }}
                >
                  （警上玩家不可投票）
                </span>
              </div>
              <GodVoteMatrix
                votes={campaign.votes}
                candidates={campaign.finalCandidates}
              />
              <button
                disabled={loading}
                onClick={() => godAction('tallyVotes')}
                style={{ ...btn('success'), marginTop: 12 }}
              >
                結算並發送票型給玩家
              </button>
            </div>
          )}

          {/* PK ANNOUNCE */}
          {phase === 'campaignPK' &&
            !campaign.result &&
            !campaign.votesPublished &&
            Object.keys(campaign.votes).length === 0 && (
              <div style={card}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: clr.warn,
                    marginBottom: 8,
                  }}
                >
                  ⚡ 首輪平票
                </div>
                <div
                  style={{ fontSize: 13, color: clr.text2, marginBottom: 4 }}
                >
                  PK 玩家：{campaign.pkCandidates.join('、')} 號
                </div>
                <div
                  style={{ fontSize: 12, color: clr.text3, marginBottom: 16 }}
                >
                  PK 輪所有非 PK 玩家皆可投票（包含原警上玩家）
                </div>
                <button
                  disabled={loading}
                  onClick={() => godAction('startPK')}
                  style={{ ...btn('warn') }}
                >
                  宣布開始 PK 投票
                </button>
              </div>
            )}

          {/* PK VOTING */}
          {phase === 'campaignPK' &&
            !campaign.result &&
            (campaign.votesPublished ||
              Object.keys(campaign.votes).length > 0) && (
              <div style={card}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: clr.text,
                    marginBottom: 8,
                  }}
                >
                  ⚡ PK 投票進行中
                </div>
                <div
                  style={{ fontSize: 13, color: clr.text2, marginBottom: 12 }}
                >
                  PK 玩家：{campaign.pkCandidates.join('、')} 號
                  <span
                    style={{ marginLeft: 8, color: clr.danger, fontSize: 12 }}
                  >
                    （PK 玩家不可投票）
                  </span>
                </div>
                <GodVoteMatrix
                  votes={campaign.votes}
                  candidates={campaign.pkCandidates}
                />
                <button
                  disabled={loading}
                  onClick={() => godAction('tallyVotes')}
                  style={{ ...btn('success'), marginTop: 12 }}
                >
                  結算並發送票型給玩家
                </button>
              </div>
            )}

          {/* CAMPAIGN RESULT → first night */}
          {(phase === 'campaignVote' || phase === 'campaignPK') &&
            campaign.result && (
              <div style={card}>
                <CampaignResult result={campaign.result} />
                <div
                  style={{
                    borderTop: `0.5px solid ${clr.border}`,
                    marginTop: 16,
                    paddingTop: 14,
                  }}
                >
                  <button
                    disabled={loading}
                    onClick={() => {
                      godAction('startNight');
                      setTab('night');
                    }}
                    style={{ ...btn('primary'), width: '100%' }}
                  >
                    進入第一夜行動
                  </button>
                </div>
              </div>
            )}

          {/* DAY VOTE */}
          {phase === 'day' && (
            <div style={card}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: clr.text,
                  marginBottom: 8,
                }}
              >
                第 {room.dayCount} 天·放逐投票
              </div>
              {room.night?.deaths && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: '8px 12px',
                    borderRadius: 'var(--border-radius-md)',
                    background:
                      room.night.deaths.length === 0
                        ? clr.successBg
                        : clr.dangerBg,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color:
                        room.night.deaths.length === 0
                          ? clr.success
                          : clr.danger,
                    }}
                  >
                    {room.night.deaths.length === 0
                      ? '🌙 昨夜平安夜，無人出局'
                      : `🌙 昨夜出局：${room.night.deaths
                          .map((d) => d.num + '號(' + d.reason + ')')
                          .join('、')}`}
                  </span>
                </div>
              )}
              <GodVoteMatrix
                votes={exile.votes}
                candidates={exile.targetOptions || []}
              />
              <button
                disabled={loading}
                onClick={() => godAction('tallyExile')}
                style={{ ...btn('danger'), marginTop: 12 }}
              >
                結算並發送票型給玩家
              </button>
            </div>
          )}

          {/* RESULT */}
          {phase === 'result' &&
            exile.result &&
            (() => {
              const exiledNum = exile.result.exiled;
              const sheriffExiled = exiledNum && exiledNum === sheriff;
              const alive2 = aliveNums.filter((n) => n !== exiledNum);
              return (
                <div style={card}>
                  <ExileResult result={exile.result} />
                  {sheriffExiled && (
                    <div
                      style={{
                        borderTop: `0.5px solid ${clr.border}`,
                        marginTop: 14,
                        paddingTop: 14,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: clr.warn,
                          marginBottom: 6,
                        }}
                      >
                        ⭐ 警長出局・警徽移交
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: clr.text3,
                          marginBottom: 8,
                        }}
                      >
                        選擇新警長，不移交則警徽消失
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                          marginBottom: 8,
                        }}
                      >
                        {alive2.map((n) => (
                          <button
                            key={n}
                            onClick={() => {
                              godAction('transferSheriff', { to: n });
                              setGodInput((p) => ({
                                ...p,
                                sheriffTransferred: n,
                              }));
                            }}
                            style={{
                              ...btn(
                                godInput.sheriffTransferred === n
                                  ? 'warn'
                                  : 'default'
                              ),
                              padding: '6px 14px',
                            }}
                          >
                            {n} 號
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            godAction('transferSheriff', { to: null });
                            setGodInput((p) => ({
                              ...p,
                              sheriffTransferred: -1,
                            }));
                          }}
                          style={{
                            ...btn(
                              godInput.sheriffTransferred === -1
                                ? 'danger'
                                : 'default'
                            ),
                            padding: '6px 14px',
                          }}
                        >
                          不移交
                        </button>
                      </div>
                      {godInput.sheriffTransferred !== undefined && (
                        <div style={{ fontSize: 12, color: clr.success }}>
                          {godInput.sheriffTransferred === -1
                            ? '警徽已銷毀'
                            : `警徽已移交給 ${godInput.sheriffTransferred} 號`}
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    style={{
                      borderTop: `0.5px solid ${clr.border}`,
                      marginTop: 16,
                      paddingTop: 14,
                    }}
                  >
                    <button
                      disabled={loading}
                      onClick={() => {
                        godAction('startNightNext');
                        setGodInput((p) => ({
                          ...p,
                          sheriffTransferred: undefined,
                        }));
                        setTab('night');
                      }}
                      style={{ ...btn('primary'), width: '100%' }}
                    >
                      進入夜晚行動
                    </button>
                  </div>
                </div>
              );
            })()}
        </>
      )}

      {/* Log */}
      <div style={card}>
        <div style={{ fontSize: 13, color: clr.text2, marginBottom: 6 }}>
          遊戲日誌
        </div>
        <Log entries={room.log} />
      </div>
    </div>
  );
}
