import * as T from 'three';
import { CFG } from '../shared/config.js';
import { angleLerp, aimDirection, arenaRay, clamp, move } from '../shared/physics.js';
import { neutralInput, type Input, type Motor, type Pose, type Preference, type Snapshot, type GameEvent } from '../shared/types.js';
import { Character, makeBlaster } from './models.js';
import { makeArena, makeStage, CYAN, PINK } from './world.js';
import { Connection } from './network.js';
import { GameAudio } from './audio.js';
const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;
const canvas = $<HTMLCanvasElement>('game');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.13;
renderer.shadowMap.enabled = localStorage.getItem('echo-shadows') !== 'off'; renderer.shadowMap.type = T.PCFShadowMap;
const arena = makeArena(), stage = makeStage();
const camera = new T.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 180);
const stageCamera = new T.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 100);
const foregroundGun = makeBlaster(); foregroundGun.scale.setScalar(0.47); foregroundGun.position.set(0.27, -0.33, -0.49); foregroundGun.rotation.y = Math.PI; camera.add(foregroundGun); arena.scene.add(camera);
const heroHider = new Character('hider'), heroSeeker = new Character('seeker'), heroGhost = new Character('hider', true);
heroHider.group.scale.setScalar(1.23); heroHider.group.position.set(-0.8, 0, 0.85); heroHider.group.rotation.y = 0.22;
heroSeeker.group.scale.setScalar(1.3); heroSeeker.group.position.set(1.45, 0, -0.1); heroSeeker.group.rotation.y = -0.68;
heroGhost.group.scale.setScalar(1.23); heroGhost.group.position.set(0.55, 0, -1.5); heroGhost.group.rotation.y = 0.3;
stage.stage.add(heroHider.group, heroSeeker.group, heroGhost.group);
const audio = new GameAudio();
let sensitivity = Number(localStorage.getItem('echo-sensitivity') ?? 1), showEcho = localStorage.getItem('echo-show-echo') !== 'off';
let preference: Preference = (localStorage.getItem('echo-role') as Preference) || 'hider';
if (!['hider', 'seeker', 'auto'].includes(preference)) preference = 'hider';
let snapshot: Snapshot | null = null, predicted: Motor | null = null, sequence = 0, currentRound = -1;
let pending: Input[] = [], frames: Snapshot[] = [], active = false, connecting = false, yaw = 0, pitch = 0, shoot = false, dragging = false;
let localCharacter: Character | null = null, ownEcho: Character | null = null;
const correction = new T.Vector3(), keys = new Set<string>(), seenEvents = new Set<number>();
const remote = new Map<string, { character: Character; label: HTMLDivElement }>();
const plateLayer = document.createElement('div'); plateLayer.id = 'nameplates'; $('hud').append(plateLayer);
let toastTimer: ReturnType<typeof setTimeout>, uiAccumulator = 0, accumulator = 0, lastTime = performance.now(), gunKick = 0, lastLobbyKey = '', lastScoreKey = '', scoreHeld = false, lastToastAt = 0;
interface FX { mesh: T.Mesh; life: number; max: number; velocity?: T.Vector3 }
const effects: FX[] = [];
const connection = new Connection(onSnapshot, reason => { leave(false); toast(reason, 7000); });
function toast(text: string, ms = 2700) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').classList.add('show'); toastTimer = setTimeout(() => $('toast').classList.remove('show'), ms); }
function setBusy(value: boolean) { connecting = value; for (const id of ['quick-play', 'practice', 'create-room']) $<HTMLButtonElement>(id).disabled = value; }
function chooseRole(value: Preference) {
  preference = value; localStorage.setItem('echo-role', value); $<HTMLSelectElement>('lobby-preference').value = value;
  for (const el of document.querySelectorAll<HTMLButtonElement>('.role-choice')) { const yes = el.dataset.role === value; el.classList.toggle('active', yes); el.setAttribute('aria-pressed', String(yes)); }
}
chooseRole(preference);
$<HTMLInputElement>('player-name').value = localStorage.getItem('echo-name') || 'Runner';
for (const el of document.querySelectorAll<HTMLButtonElement>('.role-choice')) el.onclick = () => chooseRole(el.dataset.role as Preference);
function join(mode: 'create' | 'join' | 'quick' | 'practice', room?: string) {
  if (connecting) return;
  audio.unlock(); setBusy(true); sequence = 0; currentRound = -1; frames = []; pending = []; seenEvents.clear();
  const name = $<HTMLInputElement>('player-name').value.trim().slice(0, 18) || 'Runner'; localStorage.setItem('echo-name', name);
  connection.connect({ type: 'join', mode, room, name, preference });
}
$('quick-play').onclick = () => join('quick'); $('practice').onclick = () => join('practice'); $('create-room').onclick = () => join('create');
$('start-round').onclick = () => { audio.unlock(); connection.send({ type: 'start' }); };
$('join-form').onsubmit = event => { event.preventDefault(); $<HTMLDialogElement>('modal-join').close(); join('join', $<HTMLInputElement>('join-code').value.toUpperCase()); };
$<HTMLSelectElement>('lobby-preference').onchange = event => { const value = (event.target as HTMLSelectElement).value as Preference; chooseRole(value); connection.send({ type: 'preference', value }); };
$<HTMLInputElement>('fill-bots').onchange = event => connection.send({ type: 'bots', enabled: (event.target as HTMLInputElement).checked });
$('nav-play').onclick = () => $<HTMLButtonElement>('quick-play').focus();
for (const el of document.querySelectorAll<HTMLButtonElement>('[data-modal]')) el.onclick = () => {
  if (document.pointerLockElement) document.exitPointerLock();
  active = false; keys.clear(); shoot = false; $<HTMLDialogElement>(`modal-${el.dataset.modal}`).showModal();
};
for (const el of document.querySelectorAll<HTMLButtonElement>('.close-modal')) el.onclick = () => el.closest('dialog')?.close();
for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog')) dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
function soundButtons() { for (const button of document.querySelectorAll<HTMLButtonElement>('.sound-toggle')) { button.classList.toggle('muted', !audio.enabled); button.textContent = audio.enabled ? '♪' : '∅'; button.setAttribute('aria-pressed', String(audio.enabled)); } }
for (const button of document.querySelectorAll<HTMLButtonElement>('.sound-toggle')) button.onclick = () => { audio.unlock(); audio.enabled = !audio.enabled; localStorage.setItem('echo-sound', audio.enabled ? 'on' : 'off'); soundButtons(); };
soundButtons();
$<HTMLInputElement>('sensitivity').value = String(sensitivity); $<HTMLInputElement>('volume').value = String(audio.volume);
$<HTMLInputElement>('shadows').checked = renderer.shadowMap.enabled; $<HTMLInputElement>('show-echo').checked = showEcho;
$<HTMLInputElement>('sensitivity').oninput = e => { sensitivity = Number((e.target as HTMLInputElement).value); localStorage.setItem('echo-sensitivity', String(sensitivity)); };
$<HTMLInputElement>('volume').oninput = e => { audio.volume = Number((e.target as HTMLInputElement).value); localStorage.setItem('echo-volume', String(audio.volume)); audio.unlock(); audio.play('wave'); };
$<HTMLInputElement>('shadows').onchange = e => { renderer.shadowMap.enabled = (e.target as HTMLInputElement).checked; localStorage.setItem('echo-shadows', renderer.shadowMap.enabled ? 'on' : 'off'); };
$<HTMLInputElement>('show-echo').onchange = e => { showEcho = (e.target as HTMLInputElement).checked; localStorage.setItem('echo-show-echo', showEcho ? 'on' : 'off'); };
async function invite() {
  if (!snapshot) return;
  if (snapshot.practice) { toast('Practice is solo. Create a private room to invite friends.'); return; }
  const url = new URL(location.href); url.search = ''; url.searchParams.set('room', snapshot.room); url.hash = '';
  try { await navigator.clipboard.writeText(url.toString()); toast('Invite link copied. Friends must be able to reach this server.'); }
  catch { toast(`Room ${snapshot.room} · Share this server’s address with your friends.`, 6000); }
}
for (const id of ['hud-room', 'lobby-code', 'pause-invite']) $(id).onclick = () => void invite();
function pause() { if (!snapshot || snapshot.phase === 'lobby') return; active = false; keys.clear(); shoot = false; if (document.pointerLockElement) document.exitPointerLock(); $('pause').classList.remove('hidden'); $('capture').classList.add('hidden'); }
function capture() {
  if (!snapshot || snapshot.phase === 'lobby' || snapshot.phase === 'finished' || snapshot.self.spectating || !snapshot.self.alive) return;
  audio.unlock(); active = true; $('pause').classList.add('hidden'); $('capture').classList.add('hidden');
  const result = canvas.requestPointerLock(); if (result) void result.catch(() => { active = true; toast('Mouse capture unavailable. Hold the right mouse button to look.'); });
}
$('pause-button').onclick = pause; $('resume').onclick = capture; $('capture').onclick = capture;
for (const el of document.querySelectorAll<HTMLButtonElement>('.leave-room')) el.onclick = () => leave(true);
function leave(notify: boolean) {
  connection.close(); active = false; connecting = false; snapshot = null; predicted = null; frames = []; pending = []; currentRound = -1; keys.clear(); shoot = false;
  if (document.pointerLockElement) document.exitPointerLock();
  for (const id of ['hud', 'lobby', 'pause', 'scoreboard']) $(id).classList.add('hidden'); $('menu').classList.remove('hidden'); setBusy(false);
  localCharacter?.dispose(); localCharacter = null; ownEcho?.dispose(); ownEcho = null;
  for (const obj of remote.values()) { obj.character.dispose(); obj.label.remove(); } remote.clear();
  for (const f of effects) { f.mesh.removeFromParent(); f.mesh.geometry.dispose(); (f.mesh.material as T.Material).dispose(); } effects.length = 0;
  const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null, '', url.pathname + url.search);
  document.body.classList.remove('hider'); if (notify) toast('You left the room.');
}
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => { if (!active) { capture(); return; } if (e.button === 0) shoot = true; if (e.button === 2) dragging = true; });
window.addEventListener('mouseup', e => { if (e.button === 0) shoot = false; if (e.button === 2) dragging = false; });
window.addEventListener('mousemove', e => { if (!active || (!document.pointerLockElement && !dragging)) return; yaw -= e.movementX * 0.0021 * sensitivity; pitch = clamp(pitch - e.movementY * 0.0021 * sensitivity, -1.2, 1.2); });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement === canvas) { active = true; $('capture').classList.add('hidden'); } else if (snapshot && snapshot.phase !== 'lobby' && snapshot.phase !== 'finished') { active = false; keys.clear(); shoot = false; $('pause').classList.remove('hidden'); } });
window.addEventListener('keydown', e => {
  if ((e.target as HTMLElement).matches('input,select,textarea') || document.querySelector('dialog[open]')) return;
  if (e.code === 'Tab' && snapshot && snapshot.phase !== 'lobby') { e.preventDefault(); scoreHeld = true; $('scoreboard').classList.remove('hidden'); renderScores(); return; }
  if (e.code === 'Escape') { if (snapshot && snapshot.phase !== 'lobby') pause(); return; }
  if (active && ['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','KeyE','KeyQ','KeyR','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) { e.preventDefault(); keys.add(e.code); }
});
window.addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'Tab') { scoreHeld = false; if (snapshot?.phase !== 'finished') $('scoreboard').classList.add('hidden'); } });
window.addEventListener('blur', () => { keys.clear(); shoot = false; dragging = false; if (active) pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && active) pause(); });
window.addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = stageCamera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); stageCamera.updateProjectionMatrix(); });
function playable(s: Snapshot) { return s.self.alive && !s.self.spectating && (s.phase === 'playing' || (s.phase === 'headstart' && s.self.role === 'hider')); }
function onSnapshot(s: Snapshot) {
  const previous = snapshot; snapshot = s; setBusy(false);
  const fresh = currentRound !== s.round || !predicted || previous?.self.role !== s.self.role;
  if (fresh) {
    currentRound = s.round; predicted = { ...s.self }; pending = []; frames = []; correction.set(0, 0, 0); yaw = s.self.yaw; pitch = s.self.pitch; sequence = Math.max(sequence, s.self.ack);
    localCharacter?.dispose(); localCharacter = new Character(s.self.role); arena.scene.add(localCharacter.group);
    ownEcho?.dispose(); ownEcho = s.self.role === 'hider' ? new Character('hider', true) : null; if (ownEcho) arena.scene.add(ownEcho.group);
    document.body.classList.toggle('hider', s.self.role === 'hider');
    $('role-label').textContent = `YOU ARE THE ${s.self.role.toUpperCase()}`; $('role-heading').textContent = s.self.role === 'hider' ? 'STAY AHEAD.' : 'THINK AHEAD.';
    $('role-hint').textContent = s.self.role === 'hider' ? 'Let them chase a memory.' : 'You see the past. Shoot the present.';
    $('ammo-panel').classList.toggle('hidden', s.self.role !== 'seeker'); $('hider-stats').classList.toggle('hidden', s.self.role !== 'hider'); $('ability').classList.toggle('hidden', s.self.role !== 'hider');
    $('timeline-subject').textContent = s.self.role === 'hider' ? 'YOUR ECHO' : 'EVERYONE ELSE'; $('timeline-note').textContent = s.self.role === 'hider' ? 'The ghost is where they think you are.' : 'Your own movement is always live.';
  } else if (predicted) {
    const old = new T.Vector3(predicted.x, predicted.y, predicted.z);
    pending = pending.filter(i => i.seq > s.self.ack); if (pending.length > 90) pending = [];
    predicted = { ...s.self }; if (playable(s)) for (const input of pending) move(predicted, input, s.self.role);
    const change = old.sub(new T.Vector3(predicted.x, predicted.y, predicted.z));
    if (change.length() < 2) correction.add(change).clampLength(0, 0.8); else correction.set(0, 0, 0);
  }
  frames.push(s); if (frames.length > 12) frames.shift();
  $('menu').classList.add('hidden'); $('lobby').classList.toggle('hidden', s.phase !== 'lobby'); $('hud').classList.toggle('hidden', s.phase === 'lobby');
  $('room-code').textContent = s.room; $('lobby-code-value').textContent = s.room;
  if (s.phase === 'lobby') renderLobby();
  if (s.phase !== 'lobby' && (!previous || previous.phase === 'lobby' || fresh)) {
    $('pause').classList.add('hidden'); $('scoreboard').classList.add('hidden');
    $('capture').classList.toggle('hidden', active || !s.self.alive || s.self.spectating || s.phase === 'finished');
  }
  if (s.phase === 'finished') {
    if (previous?.phase !== 'finished') { active = false; keys.clear(); shoot = false; if (document.pointerLockElement) document.exitPointerLock(); audio.play('win'); }
    $('capture').classList.add('hidden'); $('pause').classList.add('hidden'); $('scoreboard').classList.remove('hidden'); renderScores();
  } else if (!scoreHeld) $('scoreboard').classList.add('hidden');
  if (!s.self.alive || s.self.spectating) $('capture').classList.add('hidden');
  if (previous && previous.self.hp > s.self.hp && !fresh) { document.body.classList.add('hurt'); setTimeout(() => document.body.classList.remove('hurt'), 200); }
  for (const e of s.events) if (!seenEvents.has(e.id)) { seenEvents.add(e.id); handleEvent(e); }
  if (seenEvents.size > 1500) for (const id of [...seenEvents].slice(0, 500)) seenEvents.delete(id);
}
function renderLobby() {
  const s = snapshot!; const key = JSON.stringify([s.roster, s.host, s.botsEnabled]); if (lastLobbyKey === key) return; lastLobbyKey = key;
  const container = $('lobby-players'); container.replaceChildren();
  for (const p of s.roster) {
    const row = document.createElement('div'); row.className = 'lobby-player';
    const dot = document.createElement('span'), name = document.createElement('span'), badge = document.createElement('small');
    name.textContent = p.name + (p.id === s.self.id ? ' (you)' : ''); badge.textContent = p.bot ? 'BOT' : p.id === s.host ? 'HOST' : 'CONNECTED'; row.append(dot, name, badge); container.append(row);
  }
  $<HTMLInputElement>('fill-bots').checked = s.botsEnabled; $<HTMLInputElement>('fill-bots').disabled = s.self.id !== s.host;
  $<HTMLButtonElement>('start-round').disabled = s.self.id !== s.host; $('start-round').firstChild!.textContent = s.self.id === s.host ? 'START ROUND ' : 'WAITING FOR HOST ';
  $('lobby-note').textContent = s.self.id === s.host ? 'One seeker. Two minutes. No coordination required.' : 'The host will start the round. Your role preference is saved.';
}
function renderScores() {
  if (!snapshot) return; const s = snapshot, key = JSON.stringify([s.roster, s.winner, s.phase]); if (key === lastScoreKey) return; lastScoreKey = key;
  $('score-title').textContent = s.phase === 'finished' ? s.winner === 'hider' ? 'THE PRESENT WINS.' : 'THE PAST CAUGHT UP.' : 'THE FREQUENCY.';
  const container = $('score-rows'); container.replaceChildren();
  for (const p of [...s.roster].sort((a, b) => b.tags + b.baits - a.tags - a.baits)) {
    const row = document.createElement('div'); row.className = 'score-row';
    const name = document.createElement('span'); name.textContent = p.name + (p.id === s.self.id ? ' / YOU' : p.bot ? ' / BOT' : ''); name.className = p.caught ? 'caught' : p.id === s.self.id ? 'you' : '';
    const role = document.createElement('span'); role.textContent = p.role.toUpperCase(); role.className = `role-${p.role}`;
    const tags = document.createElement('span'); tags.textContent = String(p.tags); const baits = document.createElement('span'); baits.textContent = String(p.baits); row.append(name, role, tags, baits); container.append(row);
  }
}
function beam(from: T.Vector3, to: T.Vector3, hit: boolean) {
  const direction = to.clone().sub(from), length = direction.length(); if (length < 0.02) return;
  const mesh = new T.Mesh(new T.CylinderGeometry(0.017, 0.017, length, 5), new T.MeshBasicMaterial({ color: hit ? CYAN : 0xffd182, transparent: true, opacity: 0.9, depthWrite: false }));
  mesh.position.copy(from).addScaledVector(direction, 0.5); mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize()); arena.scene.add(mesh); effects.push({ mesh, life: 0.16, max: 0.16 });
  for (let i = 0; i < 6; i++) {
    const spark = new T.Mesh(new T.BoxGeometry(0.035, 0.035, 0.035), new T.MeshBasicMaterial({ color: hit ? CYAN : 0xffd182, transparent: true })); spark.position.copy(to); arena.scene.add(spark);
    effects.push({ mesh: spark, life: 0.23, max: 0.23, velocity: new T.Vector3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3) });
  }
}
function handleEvent(e: GameEvent) {
  if (!snapshot) return; const me = e.actor === snapshot.self.id;
  if (e.kind === 'shot' && e.from && e.to) {
    const from = new T.Vector3(e.from.x, e.from.y, e.from.z);
    if (me && predicted) { from.set(predicted.x + Math.cos(yaw) * 0.24, predicted.y + CFG.eye - 0.15, predicted.z - Math.sin(yaw) * 0.24); gunKick = 1; }
    beam(from, new T.Vector3(e.to.x, e.to.y, e.to.z), !!e.hit); audio.play(me ? 'shot' : 'echo');
    if (me && e.hit) { $('hit-marker').classList.add('show'); setTimeout(() => $('hit-marker').classList.remove('show'), 130); audio.play('hit'); }
    if (e.echo && performance.now() - lastToastAt > 1200) {
      if (me) { toast('ONLY AN ECHO. Aim ahead.', 1000); lastToastAt = performance.now(); }
      else if (e.target === snapshot.self.id) { toast('THEY SHOT YOUR ECHO. Keep moving.', 1400); lastToastAt = performance.now(); }
    }
  } else if (e.kind === 'catch') {
    const name = snapshot.roster.find(p => p.id === e.target)?.name ?? 'A hider';
    const item = document.createElement('div'); item.className = 'feed-item'; item.textContent = `${name} was caught in the present.`; $('feed').append(item); setTimeout(() => item.remove(), 4500);
  } else if (me && e.kind === 'wave') audio.play('wave'); else if (me && e.kind === 'dash') audio.play('dash');
}
function inputTick() {
  if (!snapshot || !predicted || snapshot.phase === 'lobby') return;
  const input = neutralInput(++sequence); input.yaw = yaw; input.pitch = pitch;
  if (active && !document.hidden) {
    input.mx = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    input.mz = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
    input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight'); input.jump = keys.has('Space'); input.dash = keys.has('KeyQ'); input.wave = keys.has('KeyE'); input.reload = keys.has('KeyR'); input.shoot = shoot;
  }
  connection.send({ type: 'input', input }); pending.push(input); if (pending.length > 90) pending.shift();
  if (playable(snapshot)) move(predicted, input, snapshot.self.role);
  else { predicted.yaw = input.yaw; predicted.pitch = input.pitch; }
}
function interpolatePose(a: Pose, b: Pose, t: number): Pose {
  if (a.alive !== b.alive || a.role !== b.role) return a;
  return { ...a, x: T.MathUtils.lerp(a.x, b.x, t), y: T.MathUtils.lerp(a.y, b.y, t), z: T.MathUtils.lerp(a.z, b.z, t), yaw: angleLerp(a.yaw, b.yaw, t), pitch: T.MathUtils.lerp(a.pitch, b.pitch, t), moving: T.MathUtils.lerp(a.moving, b.moving, t) };
}
function viewFrame(): { players: Pose[]; echo: Pose | null } {
  if (!snapshot || frames.length < 2) return { players: snapshot?.players ?? [], echo: snapshot?.echo ?? null };
  const at = connection.now - 100; let a = frames[0], b = a;
  for (let i = 0; i < frames.length - 1; i++) { if (frames[i].now <= at) { a = frames[i]; b = frames[i + 1]; } }
  if (at >= frames[frames.length - 1].now) return frames[frames.length - 1];
  const t = clamp((at - a.now) / Math.max(1, b.now - a.now), 0, 1), next = new Map(b.players.map(p => [p.id, p]));
  return { players: a.players.map(p => next.has(p.id) ? interpolatePose(p, next.get(p.id)!, t) : p), echo: a.echo && b.echo ? interpolatePose(a.echo, b.echo, t) : a.echo };
}
const localPos = new T.Vector3(), aim = new T.Vector3(), cameraGoal = new T.Vector3(), cameraBase = new T.Vector3();
function updateGame(dt: number, time: number) {
  if (!snapshot || !predicted || !localCharacter) return;
  correction.multiplyScalar(Math.exp(-16 * dt)); localPos.set(predicted.x, predicted.y, predicted.z).add(correction);
  const seeker = snapshot.self.role === 'seeker';
  localCharacter.group.visible = !seeker && snapshot.self.alive && !snapshot.self.spectating;
  localCharacter.group.position.copy(localPos); localCharacter.group.rotation.y = yaw + Math.PI;
  localCharacter.animate({ moving: Math.hypot(predicted.vx, predicted.vz), grounded: predicted.grounded, waving: snapshot.self.waving || (active && keys.has('KeyE')), dashing: predicted.dashTime > 0 }, dt, time);
  const direction = aimDirection(yaw, pitch); aim.set(direction.x, direction.y, direction.z);
  if (seeker) {
    camera.position.copy(localPos).add(new T.Vector3(0, CFG.eye, 0)); camera.lookAt(camera.position.clone().add(aim));
  } else {
    cameraBase.copy(localPos).add(new T.Vector3(0, 1.35, 0));
    // Lift the third-person camera without changing movement-relative yaw.
    const hiderAim = new T.Vector3(-Math.sin(yaw) * Math.cos(pitch - 0.18), Math.sin(pitch - 0.18), -Math.cos(yaw) * Math.cos(pitch - 0.18));
    cameraGoal.copy(cameraBase).addScaledVector(hiderAim, -5.2).add(new T.Vector3(0, 1.0, 0));
    const offset = cameraGoal.clone().sub(cameraBase), distance = offset.length(); offset.normalize();
    const collision = arenaRay(cameraBase, offset, distance); camera.position.copy(cameraBase).addScaledVector(offset, Math.max(0.3, Math.min(distance, collision - 0.18)));
    camera.lookAt(cameraBase.clone().addScaledVector(hiderAim, 3));
  }
  if (snapshot.self.spectating || !snapshot.self.alive) { camera.position.set(0, 17, 19); camera.lookAt(0, 0, 0); }
  camera.updateMatrixWorld();
  foregroundGun.visible = seeker && snapshot.self.alive && !snapshot.self.spectating;
  gunKick *= Math.exp(-18 * dt);
  foregroundGun.position.set(0.27 + Math.sin(time * 9) * Math.min(0.008, Math.hypot(predicted.vx, predicted.vz) * 0.001), -0.33 - (snapshot.self.reloadLeft > 0 ? 0.16 : 0), -0.49 + gunKick * 0.10);
  foregroundGun.rotation.x = -gunKick * 0.09 + (snapshot.self.reloadLeft > 0 ? -0.4 : 0);
  const view = viewFrame(), ids = new Set(view.players.map(p => p.id));
  for (const [id, obj] of remote) if (!ids.has(id)) { obj.character.dispose(); obj.label.remove(); remote.delete(id); }
  for (const p of view.players) {
    let obj = remote.get(p.id);
    if (obj && obj.character.role !== p.role) { obj.character.dispose(); obj.label.remove(); remote.delete(p.id); obj = undefined; }
    if (!obj) {
      const character = new Character(p.role); arena.scene.add(character.group); const label = document.createElement('div'); label.className = 'nameplate'; plateLayer.append(label); obj = { character, label }; remote.set(p.id, obj);
    }
    obj.character.group.visible = p.alive; obj.character.group.position.set(p.x, p.y, p.z); obj.character.group.rotation.y = p.yaw + Math.PI;
    obj.character.animate(p, dt, time); if (obj.character.gun) obj.character.gun.rotation.x -= p.pitch;
    const name = snapshot.roster.find(q => q.id === p.id)?.name ?? 'Runner'; obj.label.textContent = name + (seeker ? ' / −3s' : '');
    const pos = new T.Vector3(p.x, p.y + 2.55, p.z), dir = pos.clone().sub(camera.position), distance = dir.length(); dir.normalize();
    const occluded = arenaRay(camera.position, dir, distance) < distance - 0.6; pos.project(camera);
    obj.label.style.display = !p.alive || occluded || pos.z > 1 || pos.z < -1 || Math.abs(pos.x) > 1.1 || Math.abs(pos.y) > 1.1 ? 'none' : 'block';
    obj.label.style.left = `${(pos.x * 0.5 + 0.5) * innerWidth}px`; obj.label.style.top = `${(-pos.y * 0.5 + 0.5) * innerHeight}px`; obj.label.classList.toggle('past', seeker);
  }
  if (ownEcho) {
    ownEcho.group.visible = showEcho && !!view.echo?.alive && snapshot.self.alive;
    if (view.echo) { const e = view.echo; ownEcho.group.position.set(e.x, e.y, e.z); ownEcho.group.rotation.y = e.yaw + Math.PI; ownEcho.animate(e, dt, time - 3); }
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const f = effects[i]; f.life -= dt; (f.mesh.material as T.MeshBasicMaterial).opacity = Math.max(0, f.life / f.max);
    if (f.velocity) { f.mesh.position.addScaledVector(f.velocity, dt); f.velocity.y -= dt * 5; }
    if (f.life <= 0) { f.mesh.removeFromParent(); f.mesh.geometry.dispose(); (f.mesh.material as T.Material).dispose(); effects.splice(i, 1); }
  }
  arena.animate(time); renderer.render(arena.scene, camera);
}
function updateHUD() {
  if (!snapshot || !predicted) return; const s = snapshot;
  const left = Math.max(0, s.endsAt - connection.now), seconds = Math.ceil(left / 1000);
  $('clock').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('phase-label').textContent = s.phase === 'headstart' ? 'HEAD START' : s.phase === 'finished' ? 'NEXT ROUND' : `ROUND ${String(s.round).padStart(2, '0')}`;
  $('hiders-left').textContent = `${s.roster.filter(p => p.role === 'hider' && p.alive).length} HIDERS LEFT`;
  $('ping').textContent = String(Math.round(connection.ping));
  $('stamina-fill').style.width = `${predicted.stamina}%`; $('dash-cooldown').textContent = predicted.dashCooldown > 0 ? `${predicted.dashCooldown.toFixed(1)}s` : 'READY';
  const hearts = $('health').querySelectorAll('i'); hearts.forEach((heart, i) => heart.classList.toggle('empty', i >= s.self.hp)); $('health').querySelector('span')!.textContent = `${s.self.hp} / 2`;
  $('ammo').textContent = String(s.self.ammo).padStart(2, '0'); $('reload-fill').style.width = s.self.reloadLeft > 0 ? `${100 - s.self.reloadLeft / CFG.reloadMs * 100}%` : '0%';
  $('baits').textContent = String(s.roster.find(p => p.id === s.self.id)?.baits ?? 0).padStart(2, '0');
  const banner = $('round-banner'); banner.style.opacity = s.phase === 'headstart' || s.self.spectating || !s.self.alive ? '1' : '0';
  if (s.self.spectating) { $('banner-kicker').textContent = 'ROUND IN PROGRESS'; $('banner-title').textContent = 'YOU’RE UP NEXT.'; $('banner-subtitle').textContent = 'You’ll join automatically when the next round starts.'; }
  else if (!s.self.alive) { $('banner-kicker').textContent = 'CAUGHT IN THE PRESENT'; $('banner-title').textContent = 'BAD TIMING.'; $('banner-subtitle').textContent = 'Stay for the next round. Your team can still win.'; }
  else if (s.phase === 'headstart') {
    $('banner-kicker').textContent = s.self.role === 'hider' ? 'THEY’RE LIVING IN THE PAST' : 'BUFFERING THE PAST';
    $('banner-title').textContent = `${s.self.role === 'hider' ? 'GET MOVING' : 'HUNT STARTS IN'} ${String(seconds).padStart(2, '0')}`;
    $('banner-subtitle').textContent = s.self.role === 'hider' ? 'Five seconds to leave your first bad memory.' : 'Hiders are moving. You can look, but not move or fire yet.';
  }
  if (scoreHeld || s.phase === 'finished') { renderScores(); $('score-note').textContent = s.phase === 'finished' ? `Next round in ${seconds}s · Scores carry over this session` : 'Hold Tab to view · Shots hit current positions'; }
}
function frame(at: number) {
  const dt = Math.min((at - lastTime) / 1000, 0.1); lastTime = at; accumulator += dt; uiAccumulator += dt;
  while (accumulator >= CFG.dt) { inputTick(); accumulator -= CFG.dt; }
  const time = at / 1000;
  if (snapshot && snapshot.phase !== 'lobby') updateGame(dt, time);
  else {
    heroHider.animate({ moving: 0, grounded: true, waving: true, dashing: false }, dt, time);
    heroSeeker.animate({ moving: 0, grounded: true, waving: false, dashing: false }, dt, time);
    heroGhost.animate({ moving: 1.5, grounded: true, waving: true, dashing: false }, dt, time - 3);
    const orbit = Math.sin(time * 0.13) * 0.18;
    stageCamera.position.set(7.8 + orbit, 4.6, 12.4); stageCamera.lookAt(-3.8, 1.18, 0); renderer.render(stage.scene, stageCamera);
  }
  if (uiAccumulator >= 0.1) { updateHUD(); uiAccumulator = 0; }
  requestAnimationFrame(frame);
}
$('loading').classList.add('hidden');
requestAnimationFrame(frame);
const invitation = new URL(location.href).searchParams.get('room');
if (invitation) { $<HTMLInputElement>('join-code').value = invitation.toUpperCase().slice(0, 6); $<HTMLDialogElement>('modal-join').showModal(); }
