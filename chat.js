import { } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.1/+esm";

let client = null;
let roomCode = null;
let userId = null;
let mark = null;
let messagesChannel = null;
let voiceChannel = null;
let peer = null;
let localStream = null;
let remoteStream = null;
let voiceActive = false;
let pendingCandidates = [];
let seenIds = new Set();

const byId = (id) => document.getElementById(id);
const chatMessages = () => byId("chatMessages");
const voiceStatus = () => byId("voiceStatus");
const voiceBtn = () => byId("voiceBtn");

function addMessage(row) {
  if (!row || seenIds.has(row.id)) return;
  seenIds.add(row.id);
  const root = chatMessages();
  const empty = root.querySelector(".chat-empty");
  if (empty) empty.remove();
  const bubble = document.createElement("div");
  bubble.className = "chat-message" + (row.sender_id === userId ? " mine" : "");
  const meta = document.createElement("span");
  meta.className = "chat-meta";
  const date = row.created_at ? new Date(row.created_at) : new Date();
  meta.textContent = (row.sender_id === userId ? "You" : "Opponent") + " · " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const body = document.createElement("div");
  body.className = "chat-body";
  body.textContent = row.message || "";
  bubble.append(meta, body);
  root.appendChild(bubble);
  root.scrollTop = root.scrollHeight;
}

function showEmpty(text) {
  const root = chatMessages();
  root.textContent = "";
  const empty = document.createElement("p");
  empty.className = "chat-empty";
  empty.textContent = text;
  root.appendChild(empty);
}

function setVoiceUi(text, buttonText, disabled = false) {
  if (voiceStatus()) voiceStatus().textContent = text;
  if (voiceBtn()) {
    voiceBtn().textContent = buttonText;
    voiceBtn().disabled = disabled;
  }
}

async function startMessages() {
  showEmpty("Loading room messages…");
  const { data, error } = await client.from("room_messages")
    .select("id, room_code, sender_id, message, created_at")
    .eq("room_code", roomCode).order("created_at", { ascending: true }).limit(100);
  if (error) {
    showEmpty("Chat could not load. Check the Supabase chat setup.");
    console.warn("Chat history:", error);
  } else {
    showEmpty("No messages yet. Say hello!");
    for (const row of (data || [])) addMessage(row);
  }
  messagesChannel = client.channel("chat-db:" + roomCode)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "room_messages",
      filter: "room_code=eq." + roomCode
    }, payload => addMessage(payload.new))
    .subscribe();
}

async function sendMessage(event) {
  event.preventDefault();
  const input = byId("chatInput");
  const message = input.value.trim();
  if (!message || !roomCode) return;
  input.disabled = true;
  try {
    const { data, error } = await client.rpc("send_room_message", {
      p_room_code: roomCode, p_message: message
    });
    if (error) throw error;
    input.value = "";
    const row = Array.isArray(data) ? data[0] : data;
    if (row) addMessage(row);
  } catch (err) {
    console.error("Send chat:", err);
    alert("Message send nahi hua. Supabase room_messages setup check karo.");
  } finally {
    input.disabled = false;
    input.focus();
  }
}

async function sendSignal(type, payload = {}) {
  if (!voiceChannel) return;
  const { error } = await voiceChannel.send({
    type: "broadcast", event: "voice-signal",
    payload: { type, from: userId, ...payload }
  });
  if (error) console.warn("Voice signal:", error);
}

function makePeer() {
  if (peer) return peer;
  peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });
  remoteStream = new MediaStream();
  const audio = byId("remoteAudio");
  audio.srcObject = remoteStream;
  peer.ontrack = event => {
    for (const track of event.streams[0]?.getTracks() || [event.track]) {
      if (!remoteStream.getTracks().some(t => t.id === track.id)) remoteStream.addTrack(track);
    }
    audio.play().catch(() => {});
    setVoiceUi("Connected · voice on", "🔇 End voice");
  };
  peer.onicecandidate = event => {
    if (event.candidate) sendSignal("candidate", { candidate: event.candidate });
  };
  peer.onconnectionstatechange = () => {
    if (!peer) return;
    if (peer.connectionState === "connected") setVoiceUi("Connected · voice on", "🔇 End voice");
    if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
      if (voiceActive) setVoiceUi("Connection interrupted", "🔇 End voice");
    }
  };
  if (localStream) for (const track of localStream.getTracks()) peer.addTrack(track, localStream);
  return peer;
}

async function handleSignal(payload) {
  if (!payload || payload.from === userId || !voiceActive) return;
  try {
    const pc = makePeer();
    if (payload.type === "offer") {
      await pc.setRemoteDescription(payload.description);
      for (const candidate of pendingCandidates.splice(0)) await pc.addIceCandidate(candidate).catch(() => {});
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal("answer", { description: pc.localDescription });
    } else if (payload.type === "answer" && pc.signalingState === "have-local-offer") {
      await pc.setRemoteDescription(payload.description);
      for (const candidate of pendingCandidates.splice(0)) await pc.addIceCandidate(candidate).catch(() => {});
    } else if (payload.type === "candidate" && payload.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate);
      else pendingCandidates.push(payload.candidate);
    } else if (payload.type === "hangup") {
      stopVoice(false);
      setVoiceUi("Opponent ended voice chat", "🎙️ Start voice");
    }
  } catch (err) {
    console.warn("Voice negotiation:", err);
    setVoiceUi("Voice connection failed", "🎙️ Try again");
  }
}

async function startVoice() {
  if (!roomCode || voiceActive) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
    setVoiceUi("Voice chat needs a supported browser and HTTPS", "🎙️ Start voice");
    return;
  }
  try {
    setVoiceUi("Requesting microphone…", "Starting…", true);
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    voiceActive = true;
    makePeer();
    setVoiceUi("Waiting for opponent…", "🔇 End voice");
    // Both players may start at once; only X initiates to avoid offer collisions.
    if (mark === "X") {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal("offer", { description: peer.localDescription });
    } else {
      setVoiceUi("Mic on · waiting for host", "🔇 End voice");
    }
  } catch (err) {
    console.warn("Microphone:", err);
    stopVoice(false);
    setVoiceUi(err?.name === "NotAllowedError" ? "Microphone permission denied" : "Could not start microphone", "🎙️ Start voice");
  }
}

function stopVoice(notify = true) {
  if (notify && voiceActive) sendSignal("hangup");
  voiceActive = false;
  if (peer) { peer.ontrack = null; peer.onicecandidate = null; peer.close(); peer = null; }
  if (localStream) { localStream.getTracks().forEach(track => track.stop()); localStream = null; }
  if (remoteStream) { remoteStream.getTracks().forEach(track => track.stop()); remoteStream = null; }
  const audio = byId("remoteAudio");
  if (audio) audio.srcObject = null;
  pendingCandidates = [];
}

async function onVoiceClick() {
  if (voiceActive) {
    stopVoice(true);
    setVoiceUi("Microphone off", "🎙️ Start voice");
  } else {
    await startVoice();
  }
}

export function initRoomChat(supabase, code, uid, playerMark) {
  stopRoomChat();
  client = supabase; roomCode = code; userId = uid; mark = playerMark;
  seenIds = new Set();
  byId("chatForm")?.addEventListener("submit", sendMessage);
  voiceBtn()?.addEventListener("click", onVoiceClick);
  startMessages();
  voiceChannel = client.channel("arena:" + roomCode + ":voice", {
    config: { private: true, broadcast: { self: false, ack: true } }
  });
  voiceChannel.on("broadcast", { event: "voice-signal" }, ({ payload }) => handleSignal(payload));
  voiceChannel.subscribe(status => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      setVoiceUi("Voice signaling unavailable", "🎙️ Start voice");
    }
  });
  setVoiceUi("Microphone off", "🎙️ Start voice");
}

export function stopRoomChat() {
  stopVoice(false);
  for (const channel of [messagesChannel, voiceChannel]) {
    if (channel && client) {
      try { Promise.resolve(client.removeChannel(channel)).catch(() => {}); } catch {}
    }
  }
  messagesChannel = null; voiceChannel = null;
  byId("chatForm")?.removeEventListener("submit", sendMessage);
  voiceBtn()?.removeEventListener("click", onVoiceClick);
  if (chatMessages()) showEmpty("Join a room to chat with your opponent.");
  client = null; roomCode = null; userId = null; mark = null;
}
