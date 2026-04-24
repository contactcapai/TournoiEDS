// Smoke test E2E : verifier que POST /api/admin/days broadcast tournament_state_changed
// et POST /api/admin/days/:id/complete broadcast tournament_state_changed (puis cleanup).
import { io } from 'socket.io-client';

const BASE = 'http://localhost:3001';
const WS_URL = `${BASE}/tournament`;
const TIMEOUT_MS = 8000;

async function httpJson(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.text();
  let json;
  try { json = JSON.parse(body); } catch { json = body; }
  return { status: res.status, body: json };
}

const results = { createBroadcast: false, completeBroadcast: false };

async function run() {
  // 1) login admin
  const login = await httpJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin-eds-2026' }),
  });
  if (login.status !== 200 || !login.body?.data?.token) {
    throw new Error(`Login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }
  const token = login.body.data.token;
  console.log('OK: login admin');

  // 2) connexion WebSocket
  const socket = io(WS_URL, { autoConnect: true, reconnection: false });
  const events = [];
  socket.on('tournament_state_changed', (payload) => {
    events.push({ type: 'state_changed', payload });
    console.log(`  event tournament_state_changed (phase=${payload.data.phase}, dayId=${payload.data.currentDayId})`);
  });

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('connect timeout')), 3000);
    socket.on('connect', () => { clearTimeout(t); resolve(); });
    socket.on('connect_error', (e) => { clearTimeout(t); reject(e); });
  });
  console.log('OK: WebSocket connect');

  // 3) POST /api/admin/days
  events.length = 0;
  const create = await httpJson('/api/admin/days', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (create.status !== 201) throw new Error(`Create day failed: ${create.status} ${JSON.stringify(create.body)}`);
  const dayId = create.body.data.id;
  console.log(`OK: day cree (id=${dayId})`);

  // Attendre tournament_state_changed
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (events.some((e) => e.type === 'state_changed')) {
    results.createBroadcast = true;
    console.log('PASS: broadcast tournament_state_changed apres POST /days');
  } else {
    console.log('FAIL: AUCUN broadcast apres POST /days');
  }

  // 4) POST /api/admin/days/:id/complete (cleanup + verif broadcast)
  events.length = 0;
  const complete = await httpJson(`/api/admin/days/${dayId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (complete.status !== 200) throw new Error(`Complete day failed: ${complete.status} ${JSON.stringify(complete.body)}`);
  console.log(`OK: day terminee (id=${dayId})`);

  await new Promise((resolve) => setTimeout(resolve, 500));
  if (events.some((e) => e.type === 'state_changed')) {
    results.completeBroadcast = true;
    console.log('PASS: broadcast tournament_state_changed apres POST /complete');
  } else {
    console.log('FAIL: AUCUN broadcast apres POST /complete');
  }

  socket.disconnect();

  // Cleanup DB : supprimer la journee de test pour ne pas laisser d'etat
  // (on passe par un DELETE direct postgres via script externe -- ici on reste propre :
  //  la journee est marquee 'completed', ce qui est tolere par le systeme)
}

const timeout = setTimeout(() => {
  console.log('FAIL: test timeout');
  process.exit(1);
}, TIMEOUT_MS);

run()
  .then(() => {
    clearTimeout(timeout);
    const allPass = results.createBroadcast && results.completeBroadcast;
    console.log('---');
    console.log(`Result: createBroadcast=${results.createBroadcast} completeBroadcast=${results.completeBroadcast}`);
    process.exit(allPass ? 0 : 1);
  })
  .catch((err) => {
    clearTimeout(timeout);
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  });
