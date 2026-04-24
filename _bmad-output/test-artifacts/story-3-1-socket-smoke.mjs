// Smoke test : se connecter au namespace /tournament et verifier tournament_state
import { io } from 'socket.io-client';

const URL = 'http://localhost:3001/tournament';
const TIMEOUT_MS = 5000;

const socket = io(URL, { autoConnect: true, reconnection: false, timeout: 3000 });

let finished = false;
const exit = (code, msg) => {
  if (finished) return;
  finished = true;
  console.log(msg);
  socket.disconnect();
  process.exit(code);
};

const timer = setTimeout(
  () => exit(1, 'FAIL: aucun evenement tournament_state recu avant timeout'),
  TIMEOUT_MS
);

socket.on('connect', () => {
  console.log(`OK: connect (sid=${socket.id})`);
});

socket.on('connect_error', (err) => {
  clearTimeout(timer);
  exit(1, `FAIL: connect_error ${err.message}`);
});

socket.on('tournament_state', (payload) => {
  clearTimeout(timer);
  console.log('OK: tournament_state recu');
  console.log(`  event: ${payload.event}`);
  console.log(`  timestamp: ${payload.timestamp}`);
  console.log(`  phase: ${payload.data.phase}`);
  console.log(`  currentDayId: ${payload.data.currentDayId}`);
  console.log(`  rankings.length: ${payload.data.rankings.length}`);
  const hasExpectedKeys =
    payload.event === 'tournament_state' &&
    typeof payload.timestamp === 'string' &&
    'phase' in payload.data &&
    'currentDayId' in payload.data &&
    'rankings' in payload.data &&
    Array.isArray(payload.data.rankings);
  if (!hasExpectedKeys) exit(1, 'FAIL: payload ne respecte pas le format standardise');
  exit(0, 'PASS: smoke test tournament_state OK');
});
