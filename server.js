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

const rooms = new Map(); // roomCode -> { participants: Map<userId, participant>, desiredHeads, desiredBooths, theme }
const sockets = new Map(); // ws -> { userId, roomCode }

const server = http.createServer((req, res) => {
  const rawUrl = req.url === '/' ? '/index.html' : req.url || '/index.html';
  const safePath = path.normalize(rawUrl).replace(/^\.+/, '');
  const filePath = path.join(__dirname, safePath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  const userId = cryptoRandomId();
  sockets.set(ws, { userId, roomCode: null });
  send(ws, { type: 'welcome', userId, clientId: userId });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }

    if (msg.type === 'create_or_join_room' || msg.type === 'join_room') {
      const roomCode = sanitizeRoomCode(msg.roomCode);
      if (!roomCode) {
        send(ws, { type: 'error', message: 'Invalid room code.' });
        return;
      }
      joinRoom(ws, roomCode, msg);
      return;
    }

    if (msg.type === 'leave_room') {
      leaveRoom(ws);
      return;
    }

    const session = sockets.get(ws);
    if (!session?.roomCode) return;
    const room = rooms.get(session.roomCode);
    if (!room) return;

    if (msg.type === 'profile_update') {
      const p = room.participants.get(session.userId);
      if (!p) return;
      const profile = msg.profile || {};
      p.name = safeText(profile.name, 24) || p.name;
      p.bio = safeText(profile.bio, 280);
      p.glyph = safeText(profile.glyph, 2) || p.glyph;
      p.color = safeColor(profile.color) || p.color;
      broadcastRoomState(session.roomCode);
      return;
    }

    if (msg.type === 'level') {
      const p = room.participants.get(session.userId);
      if (!p) return;
      p.level = clampNum(msg.level, 0, 100);
      broadcastRoomState(session.roomCode);
      return;
    }

    if (msg.type === 'mute_participant') {
      const target = room.participants.get(String(msg.targetUserId || ''));
      if (target) {
        target.muted = Boolean(msg.muted);
        broadcastRoomState(session.roomCode);
      }
      return;
    }

    if (msg.type === 'tv_route') {
      const p = room.participants.get(session.userId);
      if (!p) return;
      p.route = ['none', '1', '2'].includes(msg.route) ? msg.route : 'none';
      broadcastRoomState(session.roomCode);
      return;
    }
  });

  ws.on('close', () => {
    leaveRoom(ws);
    sockets.delete(ws);
  });
});

function joinRoom(ws, roomCode, msg) {
  leaveRoom(ws);
  let room = rooms.get(roomCode);
  if (!room) {
    room = {
      code: roomCode,
      desiredHeads: clampNum(msg.desiredHeads, 2, 40, 8),
      desiredBooths: clampNum(msg.desiredBooths, 2, 20, 8),
      theme: msg.theme || {},
      participants: new Map()
    };
    rooms.set(roomCode, room);
  }

  const session = sockets.get(ws);
  if (!session) return;
  session.roomCode = roomCode;

  const profile = msg.profile || {};
  room.participants.set(session.userId, {
    userId: session.userId,
    name: safeText(profile.name, 24) || `User ${room.participants.size + 1}`,
    bio: safeText(profile.bio, 280),
    glyph: safeText(profile.glyph, 2) || '◉',
    color: safeColor(profile.color) || '#7f70ff',
    level: 0,
    muted: false,
    route: 'none',
    ws
  });

  broadcastRoomState(roomCode);
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
    route: p.route
  }));

  const payload = {
    type: 'room_state',
    roomCode,
    desiredHeads: room.desiredHeads,
    desiredBooths: room.desiredBooths,
    theme: room.theme,
    participants
  };

  for (const p of room.participants.values()) {
    send(p.ws, payload);
  }
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function sanitizeRoomCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 18);
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

function cryptoRandomId() {
  return `u_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

server.listen(PORT, () => {
  console.log(`The Eye server running on http://localhost:${PORT}`);
});
