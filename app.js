// ============================================================================
//  app.js - TicTacToe Arena (online), Supabase edition
//  Vanilla JS + the Supabase JS client loaded from a CDN (no build step).
//
//  How the pieces fit:
//    * Auth      : anonymous sign-in (each browser gets a private user id).
//    * Reading   : the browser may only SELECT rooms it plays in (Row Level Security).
//    * Writing   : ONLY through five database functions (create_room, join_room,
//                  make_move, request_rematch, leave_room). The server checks turn
//                  order, empty cells, win/draw, scores and rematch. This file never
//                  decides a result; it just displays what the server stored.
//    * Live board: Realtime "Postgres Changes" on the rooms table (UPDATE events).
//    * Presence  : Realtime Presence on a PRIVATE channel  arena:<CODE>  (who is online).
//
//  Everything the server knows lives in supabase-setup.sql.
// ============================================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.1/+esm";
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  isSupabaseConfigured,
  keyLooksSecret
} from "./supabase-config.js";

// ---------------------------------------------------------------------------
// Constants and small helpers
// ---------------------------------------------------------------------------
const LS_KEY = "ticTacToeArena.lastRoom";
const RESYNC_MS = 20000;      // safety net: re-read the room every 20 s
const PRESENCE_GRACE_MS = 5000;
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const $ = (id) => document.getElementById(id);
const el = {
  netChip: $("netChip"), netText: $("netText"), setupBanner: $("setupBanner"),
  lobby: $("lobby"), game: $("game"),
  createBtn: $("createBtn"), joinForm: $("joinForm"), joinBtn: $("joinBtn"),
  codeInput: $("codeInput"), lobbyMsg: $("lobbyMsg"),
  roomCode: $("roomCode"), copyCodeBtn: $("copyCodeBtn"), copyLinkBtn: $("copyLinkBtn"),
  statusChip: $("statusChip"), statusText: $("statusText"),
  scoreMeBox: $("scoreMeBox"), scoreMeName: $("scoreMeName"), scoreMe: $("scoreMe"),
  scoreDraw: $("scoreDraw"),
  scoreOppBox: $("scoreOppBox"), scoreOppName: $("scoreOppName"), scoreOpp: $("scoreOpp"),
  turnLabel: $("turnLabel"), board: $("board"),
  result: $("result"), resultTitle: $("resultTitle"), resultSub: $("resultSub"),
  rematchNote: $("rematchNote"), rematchBtn: $("rematchBtn"), leaveBtn: $("leaveBtn"),
  toast: $("toast")
};

const S = {
  uid: null,            // my anonymous Supabase user id
  online: true,         // is my connection usable right now?
  code: null,           // current room code
  mark: null,           // "X" (host) or "O" (guest)
  room: null,           // latest room, in the shape produced by toRoom()
  dbState: "connecting",// state of the live-board channel: connecting | ready | down
  present: new Set(),   // user ids currently present in the room's presence channel
  presenceReady: false, // has the first presence sync arrived?
  graceUntil: 0,        // brief window after joining where "not present yet" is not an error
  lastOppOnline: null,  // for "opponent disconnected / reconnected" toasts
  dbCh: null,
  presCh: null,
  resyncTimer: null,
  resyncing: false,
  moving: false,        // a move request is in flight
  busy: false
};

let sb = null;          // Supabase client
let cells = [];
let toastTimer = null;

function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function lsGet() { try { return localStorage.getItem(LS_KEY); } catch { return null; } }
function lsSet(v) { try { localStorage.setItem(LS_KEY, v); } catch { /* private mode */ } }
function lsClear() { try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } }

function firstRow(data) { return Array.isArray(data) ? data[0] : data; }

function showToast(message, kind = "info") {
  el.toast.textContent = message;
  el.toast.dataset.kind = kind;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 3200);
}

function setLobbyMsg(message, kind = "") {
  el.lobbyMsg.textContent = message || "";
  el.lobbyMsg.dataset.kind = kind;
}

async function copyText(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove();
  }
  showToast(okMessage);
}

// Turns server error codes (raised by supabase-setup.sql) into friendly sentences.
const RPC_MESSAGES = {
  not_signed_in: "You're signed out. Reload the page.",
  room_not_found: "Room not found. Check the code and try again.",
  room_full: "That room already has two players.",
  waiting_for_opponent: "Wait for your opponent to join first.",
  round_over: "This round is over. Ask for a rematch.",
  invalid_cell: "That square doesn't exist.",
  not_your_turn: "It isn't your turn.",
  cell_taken: "That square is already taken.",
  too_many_rooms: "You already have 3 active rooms. Leave one first.",
  round_not_over: "The round isn't over yet.",
  code_generation_failed: "Couldn't generate a room code. Try again."
};

function explain(error) {
  if (!error) return "Something went wrong.";
  const msg = String(error.message || "");
  const code = String(error.code || "");
  if (RPC_MESSAGES[msg]) return RPC_MESSAGES[msg];
  if (code === "PGRST202" || code === "42883" || /could not find the function|schema cache/i.test(msg)) {
    return "The game database isn't set up yet. Run supabase-setup.sql in the Supabase SQL Editor (README step 3).";
  }
  if (code === "42501" || /permission denied/i.test(msg)) {
    return "The database refused the request (permissions). Re-run supabase-setup.sql.";
  }
  if (/jwt|token/i.test(msg)) return "Your session expired. Reload the page.";
  if (/fetch|network/i.test(msg)) return "Couldn't reach Supabase. Check your connection.";
  return `Unexpected error: ${msg || code || "unknown"}`;
}

// ---------------------------------------------------------------------------
// Pure game helpers (display only; the server is the referee)
// ---------------------------------------------------------------------------
// Converts a database row into the shape the UI code uses.
function toRoom(row) {
  return {
    code: row.code,
    version: Number(row.version) || 0,
    players: { X: row.host_id, O: row.guest_id || null },
    board: String(row.board || "---------"),
    turn: row.turn,
    round: Number(row.round) || 0,
    winner: row.winner || null,
    scores: { X: row.score_x || 0, O: row.score_o || 0, draw: row.score_draw || 0 },
    rematch: { X: Boolean(row.rematch_x), O: Boolean(row.rematch_o) }
  };
}

function readBoard(room) {
  return Array.from({ length: 9 }, (_, i) => {
    const c = room.board[i];
    return c === "X" || c === "O" ? c : "";
  });
}

// Used only to highlight the winning line; the winner itself comes from the server.
function winningLine(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return [a, b, c];
  }
  return [];
}

function oppIsOnline(room) {
  const opp = S.mark === "X" ? "O" : "X";
  const id = room.players[opp];
  if (!id) return false;
  if (!S.presenceReady) return true;          // unknown yet: do not cry wolf
  if (S.present.has(id)) return true;
  return Date.now() < S.graceUntil;            // just joined: give them a moment to appear
}

function derive(room) {
  const me = S.mark;
  const opp = me === "X" ? "O" : "X";
  const board = readBoard(room);
  const winner = room.winner || null;
  const hasOpp = Boolean(room.players[opp]);
  const oppOnline = hasOpp && oppIsOnline(room);
  const live = hasOpp && oppOnline && S.online && !winner;
  return {
    me, opp, board, winner, hasOpp, oppOnline, live,
    turn: room.turn,
    canPlay: live && room.turn === me && !S.moving
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function markSvg(mark) {
  return mark === "X"
    ? '<svg viewBox="0 0 100 100" aria-hidden="true"><path class="mk" pathLength="100" d="M24 24L76 76M76 24L24 76"/></svg>'
    : '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="mk" pathLength="100" cx="50" cy="50" r="27"/></svg>';
}

function buildBoard() {
  el.board.textContent = "";
  cells = [];
  for (let i = 0; i < 9; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cell";
    btn.dataset.index = String(i);
    btn.dataset.mark = "";
    btn.disabled = true;
    btn.addEventListener("click", () => onCellClick(i));
    el.board.appendChild(btn);
    cells.push(btn);
  }
}

function setView(view) {
  el.lobby.hidden = view !== "lobby";
  el.game.hidden = view !== "game";
}

function setNet(state) {
  el.netChip.dataset.state = state;
  el.netText.textContent = { online: "Online", offline: "Offline", connecting: "Connecting" }[state] || state;
}

function render() {
  const room = S.room;
  if (!room || !S.mark) return;
  const d = derive(room);

  // --- connection / opponent status chip
  let kind, text;
  if (!S.online)         { kind = "off";  text = "You're offline, reconnecting"; }
  else if (!d.hasOpp)    { kind = "wait"; text = "Waiting for opponent"; }
  else if (!d.oppOnline) { kind = "bad";  text = "Opponent disconnected"; }
  else                   { kind = "ok";   text = "Connected"; }
  el.statusChip.dataset.kind = kind;
  el.statusText.textContent = text;

  // --- scoreboard
  el.scoreMe.textContent = room.scores[d.me];
  el.scoreOpp.textContent = room.scores[d.opp];
  el.scoreDraw.textContent = room.scores.draw;
  el.scoreMeName.textContent = `You (${d.me})`;
  el.scoreOppName.textContent = `Opponent (${d.opp})`;
  el.scoreMeBox.dataset.mark = d.me;
  el.scoreOppBox.dataset.mark = d.opp;

  // --- whose turn
  let turnText = "";
  let mine = false;
  if (d.winner)              turnText = "Round over";
  else if (!d.hasOpp)        turnText = "Send the room code to a friend to start.";
  else if (!d.oppOnline)     turnText = "Game paused until they reconnect.";
  else if (!S.online)        turnText = "Play resumes when you're back online.";
  else if (d.turn === d.me)  { turnText = `Your turn (${d.me})`; mine = true; }
  else                       turnText = `Opponent's turn (${d.turn})`;
  el.turnLabel.textContent = turnText;
  el.turnLabel.dataset.mine = String(mine);
  el.turnLabel.dataset.mark = d.turn;

  // --- board
  const win = d.winner && d.winner !== "draw" ? winningLine(d.board) : [];
  el.board.dataset.me = d.me;
  el.board.classList.toggle("locked", !d.live && !d.winner);
  cells.forEach((btn, i) => {
    const m = d.board[i];
    if (btn.dataset.mark !== m) {
      btn.dataset.mark = m;
      btn.innerHTML = m ? markSvg(m) : "";
    }
    const playable = d.canPlay && !m;
    btn.disabled = !playable;
    btn.classList.toggle("playable", playable);
    btn.classList.toggle("win", win.includes(i));
    btn.setAttribute("aria-label", `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}, ${m || "empty"}`);
  });

  // --- result banner
  if (d.winner) {
    const res = d.winner === "draw" ? "draw" : d.winner === d.me ? "win" : "lose";
    el.result.hidden = false;
    el.result.dataset.result = res;
    el.resultTitle.textContent = { win: "You win", lose: "You lose", draw: "It's a draw" }[res];
    el.resultSub.textContent = {
      win: "Nice line. Ask for a rematch?",
      lose: "So close. Ask for a rematch?",
      draw: "Nobody wins this one."
    }[res];
  } else {
    el.result.hidden = true;
  }

  // --- rematch controls
  const iAsked = room.rematch[d.me];
  const theyAsked = room.rematch[d.opp];
  el.rematchBtn.hidden = !d.winner;
  if (d.winner) {
    el.rematchBtn.disabled = iAsked || !d.hasOpp || !d.oppOnline || !S.online;
    el.rematchBtn.textContent = iAsked ? "Rematch requested" : "Rematch";
    if (iAsked && !theyAsked) el.rematchNote.textContent = "Waiting for your opponent to accept the rematch.";
    else if (theyAsked && !iAsked) el.rematchNote.textContent = "Your opponent wants a rematch.";
    else if (!d.hasOpp || !d.oppOnline) el.rematchNote.textContent = "Your opponent is not connected right now.";
    else el.rematchNote.textContent = "";
  } else {
    el.rematchNote.textContent = "";
  }

  el.roomCode.textContent = S.code;
}

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------
function updateOnline() {
  S.online = navigator.onLine !== false && (!S.code || S.dbState !== "down");
  if (sb) setNet(S.online ? "online" : "offline");
  render();
}

// ---------------------------------------------------------------------------
// Applying server state
// ---------------------------------------------------------------------------
function applyRow(row) {
  if (!row || row.code !== S.code) return;
  if (S.room && (Number(row.version) || 0) <= S.room.version) return;   // stale or duplicate event

  if (row.host_id !== S.uid && row.guest_id !== S.uid) {
    exitToLobby("You are no longer in that room.", "error");
    return;
  }

  const prev = S.room;
  S.room = toRoom(row);
  S.mark = row.host_id === S.uid ? "X" : "O";

  if (prev) announceSeatChanges(prev, S.room);
  refreshOppOnline();
  render();
}

function announceSeatChanges(prev, next) {
  const opp = S.mark === "X" ? "O" : "X";
  const had = Boolean(prev.players[opp]);
  const has = Boolean(next.players[opp]);
  if (!had && has) {
    S.graceUntil = Date.now() + PRESENCE_GRACE_MS;
    showToast("Opponent joined. Game on!");
  } else if (had && !has) {
    showToast("Your opponent left the room.");
  }
}

// Shows "disconnected / reconnected" toasts when the opponent's online status flips.
function refreshOppOnline() {
  const room = S.room;
  if (!room) return;
  const opp = S.mark === "X" ? "O" : "X";
  const oppId = room.players[opp];
  if (!oppId) { S.lastOppOnline = null; return; }

  const now = oppIsOnline(room);
  if (S.lastOppOnline === true && !now) { showToast("Opponent disconnected.", "error"); resync(); }
  if (S.lastOppOnline === false && now) showToast("Opponent reconnected.");
  S.lastOppOnline = now;

  // While the post-join grace window is open, check again when it closes.
  if (S.presenceReady && !S.present.has(oppId) && Date.now() < S.graceUntil) {
    const code = S.code;
    setTimeout(() => { if (S.code === code) { refreshOppOnline(); render(); } },
      S.graceUntil - Date.now() + 50);
  }
}

// Re-reads the room from the database. Heals any missed event and detects "room closed".
async function resync() {
  if (!S.code || S.resyncing || !sb) return;
  const code = S.code;
  S.resyncing = true;
  try {
    const { data, error } = await sb.from("rooms").select("*").eq("code", code).maybeSingle();
    if (S.code !== code || error) return;               // moved on, or a transient error
    if (!data) {
      showToast("The room was closed.", "error");
      exitToLobby("That room was closed by the host. Create a new one or join another.");
      return;
    }
    applyRow(data);
  } catch (err) {
    console.warn("Resync failed:", err);
  } finally {
    S.resyncing = false;
  }
}

// ---------------------------------------------------------------------------
// Realtime: live board + presence
// ---------------------------------------------------------------------------
async function subscribeRoom(code) {
  // Private channels need the user's access token on the realtime socket.
  try { await sb.realtime.setAuth(); } catch (err) { console.warn("setAuth:", err); }
  if (S.code !== code) return;

  // 1) Live board: UPDATE events for this one room. Row Level Security decides who receives them.
  S.dbCh = sb
    .channel(`db:${code}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "rooms", filter: `code=eq.${code}` },
      (payload) => applyRow(payload.new)
    )
    .subscribe((status) => {
      if (S.code !== code) return;
      if (status === "SUBSCRIBED") {
        S.dbState = "ready";
        updateOnline();
        resync();                                   // catch anything missed while connecting
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        S.dbState = "down";
        updateOnline();
      }
    });

  // 2) Presence: private channel, only this room's two players are authorised (see supabase-setup.sql).
  const presCh = sb.channel(`arena:${code}`, {
    config: { private: true, presence: { key: S.uid } }
  });
  S.presCh = presCh;
  presCh
    .on("presence", { event: "sync" }, () => {
      if (S.code !== code) return;
      S.present = new Set(Object.keys(presCh.presenceState()));
      S.presenceReady = true;
      refreshOppOnline();
      render();
    })
    .subscribe(async (status, err) => {
      if (S.code !== code) return;
      if (status === "SUBSCRIBED") {
        try { await presCh.track({ mark: S.mark, at: Date.now() }); } catch (e) { console.warn(e); }
      } else if (status === "CHANNEL_ERROR") {
        // The game still works without presence; we just can't show "opponent disconnected".
        console.warn("Presence channel error:", err);
      }
    });
}

function teardownRoom() {
  clearInterval(S.resyncTimer);
  S.resyncTimer = null;
  for (const ch of [S.dbCh, S.presCh]) {
    if (ch && sb) {
      try { Promise.resolve(sb.removeChannel(ch)).catch(() => {}); } catch { /* ignore */ }
    }
  }
  S.dbCh = null;
  S.presCh = null;
}

// ---------------------------------------------------------------------------
// Rooms: create, join, enter, leave
// ---------------------------------------------------------------------------
function setBusy(flag) {
  S.busy = flag;
  const off = flag || !S.uid;
  el.createBtn.disabled = off;
  el.joinBtn.disabled = off;
  el.codeInput.disabled = !S.uid;
}

async function createRoom() {
  if (S.busy || !S.uid) return;
  setBusy(true);
  setLobbyMsg("Creating your room...");
  try {
    const { data, error } = await sb.rpc("create_room");
    if (error) { setLobbyMsg(explain(error), "error"); return; }
    enterRoom(firstRow(data));
    setLobbyMsg("");
  } catch (err) {
    console.error(err);
    setLobbyMsg("Couldn't reach Supabase. Check your connection and try again.", "error");
  } finally {
    setBusy(false);
  }
}

async function joinRoom(rawCode) {
  if (S.busy || !S.uid) return;
  const code = normalizeCode(rawCode);
  if (code.length !== 6) {
    setLobbyMsg("Enter the 6-character room code.", "error");
    return;
  }
  setBusy(true);
  setLobbyMsg("Joining...");
  try {
    const { data, error } = await sb.rpc("join_room", { p_code: code });
    if (error) { setLobbyMsg(explain(error), "error"); return; }
    enterRoom(firstRow(data));
    setLobbyMsg("");
  } catch (err) {
    console.error(err);
    setLobbyMsg("Couldn't reach Supabase. Check your connection and try again.", "error");
  } finally {
    setBusy(false);
  }
}

function enterRoom(row) {
  if (!row || !row.code) { setLobbyMsg("The server sent an unexpected reply.", "error"); return; }
  teardownRoom();
  S.code = row.code;
  S.mark = row.host_id === S.uid ? "X" : "O";
  S.room = null;
  S.present = new Set();
  S.presenceReady = false;
  S.lastOppOnline = null;
  S.moving = false;
  S.dbState = "connecting";
  S.graceUntil = Date.now() + PRESENCE_GRACE_MS;
  lsSet(S.code);
  el.roomCode.textContent = S.code;
  setView("game");
  applyRow(row);
  subscribeRoom(S.code);
  S.resyncTimer = setInterval(resync, RESYNC_MS);
}

function exitToLobby(message, kind = "") {
  teardownRoom();
  S.code = null; S.mark = null; S.room = null; S.moving = false;
  S.present = new Set(); S.presenceReady = false; S.lastOppOnline = null;
  S.dbState = "connecting";
  lsClear();
  setView("lobby");
  setLobbyMsg(message || "", kind);
  updateOnline();
}

async function leaveRoom() {
  if (!S.code) return;
  const code = S.code;
  const mark = S.mark;
  const hasOpp = Boolean(S.room && S.room.players[mark === "X" ? "O" : "X"]);
  if (mark === "X" && hasOpp && !confirm("Leaving closes the room for both players. Leave anyway?")) return;

  exitToLobby("You left the room.");
  try {
    const { error } = await sb.rpc("leave_room", { p_code: code });
    if (error) console.warn("leave_room:", error);
  } catch (err) {
    console.warn("leave_room failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Moves and rematch (the server validates; we only display the result)
// ---------------------------------------------------------------------------
async function onCellClick(i) {
  const room = S.room;
  if (!room) return;
  const d = derive(room);
  if (!d.canPlay || d.board[i]) return;

  S.moving = true;
  render();
  try {
    const { data, error } = await sb.rpc("make_move", { p_code: S.code, p_cell: i });
    if (error) {
      showToast(explain(error), "error");
      resync();
    } else {
      applyRow(firstRow(data));
      if (navigator.vibrate) navigator.vibrate(12);
    }
  } catch (err) {
    console.error(err);
    showToast("Couldn't reach the server. Your move was not sent.", "error");
  } finally {
    S.moving = false;
    render();
  }
}

async function requestRematch() {
  const room = S.room;
  if (!room || !room.winner) return;
  try {
    const { data, error } = await sb.rpc("request_rematch", { p_code: S.code });
    if (error) { showToast(explain(error), "error"); return; }
    applyRow(firstRow(data));
  } catch (err) {
    console.error(err);
    showToast("Couldn't send the rematch request.", "error");
  }
}

// ---------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------
function showSetupNeeded() {
  el.setupBanner.hidden = false;
  setNet("offline");
  el.netText.textContent = "Not set up";
  setLobbyMsg("");
}

function showSecretKeyError() {
  setNet("offline");
  el.netText.textContent = "Unsafe key";
  setLobbyMsg(
    "supabase-config.js contains a SECRET key. Remove it now and use the publishable (or anon) key instead. Never put secret keys in a website.",
    "error"
  );
}

function showAuthError(err) {
  console.error(err);
  setNet("offline");
  const code = String((err && err.code) || "");
  const msg = String((err && err.message) || "");
  if (code === "anonymous_provider_disabled" || /anonymous sign-ins are disabled/i.test(msg)) {
    setLobbyMsg("Sign-in failed. In Supabase, open Authentication > Sign In / Providers and turn on 'Allow anonymous sign-ins'.", "error");
  } else if (/invalid api key|apikey/i.test(msg) || code === "401") {
    setLobbyMsg("Supabase rejected the key in supabase-config.js. Re-copy the project URL and publishable key.", "error");
  } else if (/fetch|network/i.test(msg)) {
    setLobbyMsg("Couldn't reach Supabase. Check supabase-config.js and your connection.", "error");
  } else {
    setLobbyMsg(`Couldn't sign in${code ? ` (${code})` : ""}. ${msg}`.trim(), "error");
  }
}

async function resumeLastRoom() {
  const saved = normalizeCode(lsGet());
  if (saved.length !== 6) { lsClear(); return; }
  try {
    // Row Level Security returns the row only if I am its host or guest.
    const { data, error } = await sb.from("rooms").select("*").eq("code", saved).maybeSingle();
    if (!error && data && (data.host_id === S.uid || data.guest_id === S.uid)) {
      enterRoom(data);
      return;
    }
  } catch { /* fall through and forget the room */ }
  lsClear();
}

function bindUi() {
  el.createBtn.addEventListener("click", createRoom);
  el.joinForm.addEventListener("submit", (e) => { e.preventDefault(); joinRoom(el.codeInput.value); });
  el.codeInput.addEventListener("input", () => {
    const clean = normalizeCode(el.codeInput.value);
    if (clean !== el.codeInput.value) el.codeInput.value = clean;
  });
  el.copyCodeBtn.addEventListener("click", () => S.code && copyText(S.code, "Room code copied."));
  el.copyLinkBtn.addEventListener("click", () => {
    if (!S.code) return;
    const url = new URL(location.href);
    url.search = `?room=${S.code}`;
    url.hash = "";
    copyText(url.toString(), "Invite link copied.");
  });
  el.rematchBtn.addEventListener("click", requestRematch);
  el.leaveBtn.addEventListener("click", leaveRoom);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resync();
  });
  window.addEventListener("online", () => { updateOnline(); resync(); });
  window.addEventListener("offline", updateOnline);
}

function prefillFromUrl() {
  const fromUrl = normalizeCode(new URLSearchParams(location.search).get("room"));
  if (fromUrl) {
    el.codeInput.value = fromUrl;
    setLobbyMsg(`Invite code ${fromUrl} filled in. Press Join room.`, "ok");
  }
}

async function main() {
  buildBoard();
  bindUi();
  prefillFromUrl();

  if (!isSupabaseConfigured()) { showSetupNeeded(); return; }
  if (keyLooksSecret()) { showSecretKeyError(); return; }

  setNet("connecting");
  try {
    sb = createClient(SUPABASE_URL.trim(), SUPABASE_PUBLISHABLE_KEY.trim(), {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
  } catch (err) {
    console.error(err);
    setNet("offline");
    setLobbyMsg("Supabase couldn't start. Re-check the values in supabase-config.js.", "error");
    return;
  }

  try {
    const { data: sessionData } = await sb.auth.getSession();
    let user = sessionData && sessionData.session ? sessionData.session.user : null;
    if (!user) {
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      user = data.user;
    }
    S.uid = user.id;
  } catch (err) {
    showAuthError(err);
    return;
  }

  sb.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" && S.code) exitToLobby("You were signed out. Reload the page.", "error");
  });

  setNet("online");
  setBusy(false);
  await resumeLastRoom();
}

main();
