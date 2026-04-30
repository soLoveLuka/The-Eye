import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 8787);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const rooms = new Map();
const sockets = new Map();

const server = http.createServer((req, res) => {
  const rawUrl = req.url === '/' ? '/index.html' : req.url || '/index.html';
  const safePath = path.normalize(rawUrl).replace(/^\.+/, '');
  const filePath = path.join(__dirname, safePath);
  if (!filePath.startsWith(__dirname)) return void res.writeHead(403).end('Forbidden');

  fs.readFile(filePath, (err, data) => {
    if (err) return void res.writeHead(404).end('Not found');
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') return void socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
});

wss.on('connection', (ws) => {
  const userId = cryptoRandomId();
  sockets.set(ws, { userId, roomCode: null });
  send(ws, { type: 'welcome', userId, clientId: userId });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }

    if (msg.type === 'create_room') {
      return createRoom(ws, sanitizeRoomCode(msg.roomCode), msg);
    }
    if (msg.type === 'join_room_invite') {
      return joinRoom(ws, sanitizeRoomCode(msg.roomCode), sanitizeInvite(msg.inviteCode), msg);
    }
    if (msg.type === 'leave_room') {
      return leaveRoom(ws);
    }

    const session = sockets.get(ws);
    const room = session?.roomCode ? rooms.get(session.roomCode) : null;
    if (!session || !room) return;

    if (msg.type === 'profile_update') {
      const p = room.participants.get(session.userId);
      if (!p) return;
      const profile = msg.profile || {};
      p.name = safeText(profile.name, 24) || p.name;
      p.bio = safeText(profile.bio, 280);
      p.glyph = safeText(profile.glyph, 2) || p.glyph;
      p.color = safeColor(profile.color) || p.color;
      return broadcastRoomState(session.roomCode);
    }

    if (msg.type === 'level') {
      const p = room.participants.get(session.userId);
      if (!p) return;
      p.level = clampNum(msg.level, 0, 100);
      return broadcastRoomState(session.roomCode);
    }

    if (msg.type === 'mute_participant') {
      const target = room.participants.get(String(msg.targetUserId || ''));
      if (!target) return;
      target.muted = Boolean(msg.muted);
      return broadcastRoomState(session.roomCode);
    }

    if (msg.type === 'curtain') {
      const p = room.participants.get(session.userId);
      if (!p) return;
      p.curtained = Boolean(msg.curtained);
      return broadcastRoomState(session.roomCode);
    }

    if (msg.type === 'regen_invite') {
      room.inviteCode = makeInviteCode();
      return broadcastRoomState(session.roomCode);
    }

    if (msg.type === 'tv_route') {
      const p = room.participants.get(session.userId);
      if (!p) return;
      p.route = ['none', '1', '2'].includes(msg.route) ? msg.route : 'none';
      return broadcastRoomState(session.roomCode);
    }
  });

  ws.on('close', () => {
    leaveRoom(ws);
    sockets.delete(ws);
  });
});

function createRoom(ws, roomCode, msg) {
  if (!roomCode || roomCode.length < 3) return send(ws, { type: 'error', message: 'Invalid room code.' });
  leaveRoom(ws);
  if (rooms.has(roomCode)) return send(ws, { type: 'error', message: 'Room already exists. Use JOIN.' });

  const room = {
    code: roomCode,
    desiredHeads: clampNum(msg.desiredHeads, 1, 20, 8),
    desiredBooths: clampNum(msg.desiredBooths, 1, 20, 8),
    inviteCode: makeInviteCode(),
    theme: msg.theme || {},
    participants: new Map()
  };
  rooms.set(roomCode, room);
  addParticipant(ws, roomCode, msg.profile || {});
  broadcastRoomState(roomCode);
}

function joinRoom(ws, roomCode, inviteCode, msg) {
  if (!roomCode || !inviteCode) return send(ws, { type: 'error', message: 'Passcode + invite required.' });
  leaveRoom(ws);
  const room = rooms.get(roomCode);
  if (!room) return send(ws, { type: 'error', message: 'Room not found.' });
  if (room.inviteCode !== inviteCode) return send(ws, { type: 'error', message: 'Invite mismatch.' });
  if (room.participants.size >= room.desiredHeads) return send(ws, { type: 'error', message: 'Room full.' });

  addParticipant(ws, roomCode, msg.profile || {});
  broadcastRoomState(roomCode);
}

function addParticipant(ws, roomCode, profile) {
  const room = rooms.get(roomCode);
  const session = sockets.get(ws);
  if (!room || !session) return;
  session.roomCode = roomCode;

  room.participants.set(session.userId, {
    userId: session.userId,
    name: safeText(profile.name, 24) || `User ${room.participants.size + 1}`,
    bio: safeText(profile.bio, 280),
    glyph: safeText(profile.glyph, 2) || '◉',
    color: safeColor(profile.color) || '#7f70ff',
    level: 0,
    muted: false,
    curtained: false,
    route: 'none',
    ws
  });
}

function leaveRoom(ws) {
  const session = sockets.get(ws);
  if (!session?.roomCode) return;
  const room = rooms.get(session.roomCode);
  if (!room) {
    session.roomCode = null;
    return;
  }

  room.participants.delete(session.userId);
  const code = session.roomCode;
  session.roomCode = null;

  if (room.participants.size === 0) {
    rooms.delete(code);
    return;
  }
  broadcastRoomState(code);
}

function broadcastRoomState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const participants = [...room.participants.values()].map((p) => ({
    userId: p.userId,
    name: p.name,
    bio: p.bio,
    glyph: p.glyph,
    color: p.color,
    level: p.level,
    muted: p.muted,
    curtained: p.curtained,
    route: p.route
  }));

  const payload = {
    type: 'room_state',
    roomCode,
    inviteCode: room.inviteCode,
    desiredHeads: room.desiredHeads,
    desiredBooths: room.desiredBooths,
    theme: room.theme,
    participants
  };

  for (const p of room.participants.values()) send(p.ws, payload);
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function sanitizeRoomCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 18);
}
function sanitizeInvite(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}
function safeText(value, maxLen) {
  return String(value || '').trim().slice(0, maxLen);
}
function safeColor(value) {
  const v = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : null;
}
function clampNum(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function makeInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
function cryptoRandomId() {
  return `u_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

server.listen(PORT, () => {
  console.log(`The Eye server running on http://localhost:${PORT}`);
});
