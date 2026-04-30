import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 8787);
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-change-me-eye-secret';
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));

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

const server = http.createServer(async (req, res) => {
  if ((req.url || '').startsWith('/api/')) return handleApi(req, res);

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

async function handleApi(req, res) {
  try {
    if (req.method === 'POST' && req.url === '/api/signup') {
      const body = await readJson(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (!/^[^\s]{3,24}$/.test(username)) return json(res, 400, { ok: false, error: 'Username must be 3-24 chars, no spaces.' });
      if (password.length < 8) return json(res, 400, { ok: false, error: 'Password must be 8+ chars.' });

      const db = readUsers();
      if (db.users.find((u) => decryptText(u.usernameEnc) === username.toLowerCase())) return json(res, 409, { ok: false, error: 'Username already exists.' });

      const { salt, hash } = hashPassword(password);
      db.users.push({
        id: `usr_${crypto.randomBytes(5).toString('hex')}`,
        usernameEnc: encryptText(username.toLowerCase()),
        passSalt: salt,
        passHash: hash,
        profileEnc: encryptText(JSON.stringify({ name: username, bio: '', glyph: '◈', color: '#7f70ff' }))
      });
      writeUsers(db);
      const created = db.users[db.users.length - 1];
      const token = signToken({ uid: created.id, username: username.toLowerCase() });
      return json(res, 200, { ok: true, message: 'Signup complete.', token, profile: { name: username, bio: '', glyph: '◈', color: '#7f70ff' } });
    }

    if (req.method === 'POST' && req.url === '/api/login') {
      const body = await readJson(req);
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const db = readUsers();
      const user = db.users.find((u) => decryptText(u.usernameEnc) === username);
      if (!user) return json(res, 404, { ok: false, error: 'User not found.' });
      if (!verifyPassword(password, user.passSalt, user.passHash)) return json(res, 401, { ok: false, error: 'Invalid credentials.' });

      const token = signToken({ uid: user.id, username });
      const profile = JSON.parse(decryptText(user.profileEnc));
      return json(res, 200, { ok: true, token, profile });
    }

    if (req.method === 'GET' && req.url === '/api/me') {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const session = verifyToken(token);
      if (!session) return json(res, 401, { ok: false, error: 'Unauthorized.' });
      const db = readUsers();
      const user = db.users.find((u) => u.id === session.uid);
      if (!user) return json(res, 404, { ok: false, error: 'User missing.' });
      return json(res, 200, { ok: true, profile: JSON.parse(decryptText(user.profileEnc)), username: decryptText(user.usernameEnc) });
    }

    return json(res, 404, { ok: false, error: 'Not found.' });
  } catch (err) {
    return json(res, 500, { ok: false, error: 'Server error.' });
  }
}

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

    if (msg.type === 'create_room') return createRoom(ws, sanitizeRoomCode(msg.roomCode), msg);
    if (msg.type === 'join_room_invite') return joinRoom(ws, sanitizeRoomCode(msg.roomCode), sanitizeInvite(msg.inviteCode), msg);
    if (msg.type === 'leave_room') return leaveRoom(ws);

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

function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}
function writeUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const h = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
}
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

function encryptText(plain) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(AUTH_SECRET).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}
function decryptText(payload) {
  const [ivHex, tagHex, dataHex] = String(payload || '').split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const key = crypto.createHash('sha256').update(AUTH_SECRET).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expect = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8') || '{}';
  return JSON.parse(raw);
}
function json(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function send(ws, payload) { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload)); }
function sanitizeRoomCode(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 18); }
function sanitizeInvite(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10); }
function safeText(v, n) { return String(v || '').trim().slice(0, n); }
function safeColor(v) { const s = String(v || '').trim(); return /^#[0-9a-fA-F]{6}$/.test(s) ? s : null; }
function clampNum(v, min, max, fb = min) { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb; }
function makeInviteCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function cryptoRandomId() { return `u_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`; }

server.listen(PORT, () => console.log(`The Eye server running on http://localhost:${PORT}`));
