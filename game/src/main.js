// SOLMAR BAY — the entry point: builds the renderer and the world, runs the
// game loop, and wires input, missions, police, combat and the HUD together.
// States: 'menu' | 'playing' | 'paused' | 'over'.

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { City } from './city.js';
import { Player, FollowCamera } from './player.js';
import { Traffic } from './vehicles.js';
import { Crowd } from './people.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { initAudio, resumeAudio, toggleMute, setEngine, setSiren, playGunshot, playPunch, playPickup, playCash, playMissionComplete, playFail, playCrash, playHorn, playClick, playSirenWhoop } from './audio.js';
import * as input from './input.js';
import { hasSave, saveGame, loadSave } from './save.js';
import { shotNumber, autoPlay, stageShot } from './shots.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c5e8);
scene.fog = new THREE.Fog(0x9fc8e8, 180, 620);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1500);

// Sun-soaked light: a warm directional sun with shadows and a sky fill.
const sun = new THREE.DirectionalLight(0xfff1c9, 2.6);
sun.position.set(120, 180, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
sun.shadow.camera.far = 600;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9));

// The world and its systems.
const city = new City(scene);
const player = new Player(scene);
const traffic = new Traffic(scene, city);
const crowd = new Crowd(scene, city);
const police = new Police(scene, city);
const combat = new Combat(scene);
const missions = new Missions(scene);
const hud = new Hud();
const followCam = new FollowCamera(camera);

const game = {
  scene, city, player, traffic, crowd, police, combat, missions, hud, followCam,
};

let state = 'menu';
let time = 0;
let lastNow = performance.now();
let fpsFrames = 0;
let fpsTimer = 0;
let regenTimer = 0;
let damageFlash = 0;
let trafficRespawnTimer = 0;
let lastPickupCount = combat.pickups.length;

input.initInput(canvas);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- menus ---------------------------------------------------------------

const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const overEl = document.getElementById('gameover');
const btnNew = document.getElementById('btn-new');
const btnContinue = document.getElementById('btn-continue');
const btnResume = document.getElementById('btn-resume');
const btnRestart = document.getElementById('btn-restart');
const btnQuit = document.getElementById('btn-quit');
const btnRespawn = document.getElementById('btn-respawn');
const btnGoMenu = document.getElementById('btn-go-menu');

btnContinue.disabled = !hasSave();

function showOnly(el) {
  for (const e of [menuEl, pauseEl, overEl]) e.classList.add('hidden');
  if (el) el.classList.remove('hidden');
  hud.el.hud.classList.toggle('hidden', el !== null);
}

function startGame(fresh) {
  initAudio(); resumeAudio();
  if (fresh) {
    player.cash = PLAYER.startCash;
    player.health = PLAYER.maxHealth;
    player.armor = 0;
    player.pos.set(14, 0, 232);
    player.heading = Math.PI;
    police.clear();
    missions.start(0);
    hud.feed('Welcome to Solmar Bay, Lucia.', 'gold');
    hud.showBanner('WELCOME TO SOLMAR', 'Meet Rico at the Pier Bar — follow the gold marker', 4);
  } else {
    const save = loadSave();
    if (save) {
      player.cash = save.cash;
      player.health = save.health;
      player.armor = save.armor;
      player.pos.set(save.x, 0, save.z);
      player.heading = save.heading;
      if (save.storyDone) { missions.done = true; missions.active = false; }
      else missions.start(save.missionIndex);
      missions.stepIndex = Math.min(save.missionStep, (missions.current?.steps.length || 1) - 1);
      hud.feed('Welcome back to Solmar Bay.', 'gold');
    }
  }
  showOnly(null);
  hud.show();
  state = 'playing';
  playClick();
}

btnNew.addEventListener('click', () => startGame(true));
btnContinue.addEventListener('click', () => startGame(false));
btnResume.addEventListener('click', () => { state = 'playing'; showOnly(null); hud.show(); playClick(); });
btnRestart.addEventListener('click', () => {
  missions.start(missions.index);
  police.clear();
  state = 'playing'; showOnly(null); hud.show();
  hud.feed('Mission restarted.', 'gold');
});
btnQuit.addEventListener('click', () => {
  saveGame({ player, missions });
  state = 'menu'; showOnly(menuEl);
  btnContinue.disabled = !hasSave();
  hud.feed('Progress saved.', 'gold');
});
btnRespawn.addEventListener('click', () => {
  player.health = PLAYER.maxHealth;
  player.armor = 0;
  player.pos.set(14, 0, 232);
  player.heading = Math.PI;
  player.addCash(-Math.min(500, player.cash));
  police.clear();
  state = 'playing'; showOnly(null); hud.show();
  hud.showBanner('BACK ON YOUR FEET', 'The hospital bill stung. Rico is still waiting.', 4);
});
btnGoMenu.addEventListener('click', () => { state = 'menu'; showOnly(menuEl); });

function gameOver(kind) {
  state = 'over';
  setEngine(0, false);
  setSiren(false, 0);
  const title = document.getElementById('gameover-title');
  const sub = document.getElementById('gameover-sub');
  if (kind === 'busted') {
    title.textContent = 'BUSTED';
    sub.textContent = 'The SPPD took you in. Bail was not cheap — but Lucia always walks free.';
    player.addCash(-Math.min(800, player.cash));
  } else {
    title.textContent = 'WASTED';
    sub.textContent = 'The bay took you down. The hospital patched you up — for a fee.';
  }
  police.clear();
  combat.clearGuards();
  showOnly(overEl);
  playFail();
}

// ---- entering and leaving cars --------------------------------------------

function nearestStealable() {
  return traffic.nearestCar(player.pos.x, player.pos.z, 4.5);
}

function enterCar(car) {
  traffic.steal(car);
  car.isPlayer = true;
  player.car = car;
  player.mesh.visible = false;
  player.pos.copy(car.pos);
  const hadDriver = !!car.driver;
  if (hadDriver) hud.feed('You jacked a car! The driver ran for it.', 'warn');
  // Stealing in front of the law is a crime.
  if (police.cruisers.length > 0 || police.cops.length > 0) {
    police.addStars(1, 'Grand theft auto');
    hud.feed('The SPPD saw that! Wanted level up.', 'warn');
    playSirenWhoop();
  }
  playHorn();
}

function exitCar() {
  const car = player.car;
  if (!car) return;
  player.car = null;
  car.isPlayer = false;
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
  player.pos.set(car.pos.x + side.x * 2.4, 0, car.pos.z + side.z * 2.4);
  player.heading = car.heading;
  player.mesh.visible = true;
  player.vel.set(0, 0, 0);
}

// ---- shooting --------------------------------------------------------------

function playerShoot() {
  const from = player.gunTip();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  // Aim slightly down the crosshair: the camera looks at the player, so the
  // ray starts at the gun and follows the camera's view.
  const hit = combat.shoot(from, dir, combat.targets(crowd, police));
  playGunshot();
  if (hit) {
    if (hit.health !== undefined && hit.mesh) {
      // A guard.
      const result = combat.damageGuard(hit, 1);
      if (result === 'down') {
        hud.feed('Guard down. He dropped some cash.', 'gold');
        playCash();
        player.addCash(100);
      }
    } else if (hit.pos) {
      // A pedestrian or a cop: a crime, and the crowd scatters.
      if (hit.isCop) police.removeCop(hit);
      else crowd.remove(hit);
      police.addStars(1, 'Assault');
      hud.feed(hit.isCop ? 'You shot a cop! The whole SPPD is coming.' : 'You shot a civilian! The SPPD is coming.', 'warn');
      playSirenWhoop();
    }
  }
}

function playerPunch() {
  if (player.punchCooldown > 0) return;
  player.punchCooldown = 0.45;
  playPunch();
  const target = crowd.nearest(player.pos.x, player.pos.z, 2.2);
  if (target) {
    crowd.remove(target);
    police.addStars(1, 'Assault');
    hud.feed('You knocked a pedestrian flat! Wanted level up.', 'warn');
  }
}

// ---- per-frame update ------------------------------------------------------

function update(dt) {
  time += dt;
  const events = { enteredCar: false, wanted: police.wanted };

  // Pause / resume.
  if (input.wasPressed('Escape') && state === 'playing') {
    state = 'paused'; showOnly(pauseEl); playClick();
  } else if (input.wasPressed('Escape') && state === 'paused') {
    state = 'playing'; showOnly(null); hud.show(); playClick();
  }
  if (input.wasPressed('KeyM')) {
    const muted = toggleMute();
    hud.feed(muted ? 'Sound muted.' : 'Sound on.');
  }
  // The menu backdrop: a slow orbit over Ocean Drive while the title is up.
  if (state === 'menu') {
    camera.position.set(60 + Math.sin(time * 0.05) * 40, 30, 150 + Math.cos(time * 0.05) * 30);
    camera.lookAt(0, 2, 200);
    return;
  }
  if (state !== 'playing') return;

  const drag = input.consumeDrag();
  const camTarget = player.car ? player.car.pos : player.pos;
  const camHeading = player.car ? player.car.heading : player.heading;

  // --- driving or walking ---
  if (player.car) {
    const car = player.car;
    const wasCrashed = car.crashed;
    car.crashed = false;
    car.drive(dt, {
      forward: input.moveForward() || game.autoDrive,
      back: input.moveBack(),
      left: input.moveLeft(),
      right: input.moveRight(),
      handbrake: input.sprinting(),
    }, city);
    if (wasCrashed || car.crashed) { playCrash(); damageFlash = Math.max(damageFlash, 0.25); }
    setEngine(Math.abs(car.speed) / car.def.top, true);
    player.pos.copy(car.pos);
    // Ramming a pedestrian at speed is a crime.
    const victim = crowd.nearest(car.pos.x, car.pos.z, 2.6);
    if (victim && Math.abs(car.speed) > 8) {
      crowd.remove(victim);
      police.addStars(1, 'Vehicular assault');
      hud.feed('You ran someone over! The SPPD is coming.', 'warn');
      playSirenWhoop();
    }
    if (input.wasPressed('KeyE')) exitCar();
  } else {
    setEngine(0, false);
    player.updateOnFoot(dt, {
      forward: input.moveForward(),
      back: input.moveBack(),
      left: input.moveLeft(),
      right: input.moveRight(),
      sprint: input.sprinting(),
      jump: input.jumping(),
    }, followCam.yaw, city, time);
    if (input.wasPressed('KeyE')) {
      const car = nearestStealable();
      if (car) { enterCar(car); events.enteredCar = true; }
      else hud.feed('No car close enough — walk up to one and press E.');
    }
    if (input.wasPressed('KeyF')) playerPunch();
    if (input.consumeClick()) playerShoot();
  }

  // --- the world around the player ---
  const playerPos = player.car ? player.car.pos : player.pos;
  traffic.update(dt, player.car, police.cruisers);
  trafficRespawnTimer -= dt;
  if (traffic.cars.length < 22 && trafficRespawnTimer <= 0) {
    traffic.respawn();
    trafficRespawnTimer = 4;
  }
  crowd.update(dt, playerPos, combat.gunfireAt);
  combat.update(dt, playerPos, player);
  if (combat.pickups.length < lastPickupCount) playPickup();
  lastPickupCount = combat.pickups.length;

  // --- police ---
  const policeResult = police.update(dt, player, player.car, time);
  if (policeResult === 'busted') { gameOver('busted'); return; }
  if (policeResult === 'cooled') hud.feed('You lost the heat. One star down.', 'gold');
  setSiren(police.sirenOn, dt);

  // Guards shoot back during the bank job and the yacht job.
  if (combat.guards.length > 0) {
    const shot = combat.updateGuards(dt, player.pos, () => playGunshot());
    if (shot && player.takeDamage(9, time)) {
      damageFlash = 1;
      hud.feed('You\'re hit!', 'warn');
    }
  }

  // --- missions ---
  const missionResult = missions.update(dt, playerPos, !!player.car, events);
  if (missionResult) {
    if (missionResult.completed) {
      const m = missionResult.completed;
      player.addCash(m.reward);
      playMissionComplete();
      hud.showBanner('MISSION PASSED', `${m.title}  •  +$${m.reward}`, 3.5);
      hud.feed(`${m.complete} (+$${m.reward})`, 'gold');
      combat.clearGuards();
      const next = missions.startNext();
      if (next) {
        const w = missions.wantedOnStart();
        if (w > 0) police.setStars(w);
        if (next.id === 'm5') combat.spawnGuards(4, 30, -30);
        if (next.id === 'm6') combat.spawnGuards(3, 120, 250);
        hud.feed(next.briefing, 'gold');
      } else {
        hud.showBanner('STORY COMPLETE', 'Lucia Vega owns Solmar Bay. Free roam!', 5);
        saveGame({ player, missions });
      }
      saveGame({ player, missions });
    } else if (missionResult.step) {
      playPickup();
      const m = missions.current;
      if (m.id === 'm5' && missions.stepIndex === 1) combat.spawnGuards(4, 30, -30);
      if (m.id === 'm6' && missions.stepIndex === 1) combat.spawnGuards(3, 120, 250);
    }
  }
  // Mission start wanted levels (mission 4/5/6 open hot).
  const m = missions.current;
  if (m && m.wanted && missions.stepIndex === 0 && police.wanted < m.wanted && !m._heatApplied) {
    m._heatApplied = true;
    police.setStars(m.wanted);
    hud.feed('The SPPD is onto you!', 'warn');
    playSirenWhoop();
  }

  // --- health regen and damage feedback ---
  regenTimer += dt;
  if (regenTimer > 5 && time - player.lastDamageAt > 5) {
    player.heal(dt * 4);
    regenTimer = 0;
  }
  damageFlash = Math.max(0, damageFlash - dt * 1.5);
  hud.setDamage(damageFlash);
  hud.setSirenFlash(police.sirenOn, time);
  if (player.health <= 0) { gameOver('wasted'); return; }

  // --- camera and HUD ---
  const moving = player.car ? Math.abs(player.car.speed) > 1 : player.speed2d > 0.5;
  followCam.update(dt, camTarget, camHeading, moving, drag);  hud.update(dt, playerPos);
  hud.setCash(player.cash);
  hud.setStars(police.wanted);
  hud.setHealth(player.health, player.armor);
  hud.setSpeed(player.car ? Math.abs(player.car.speed) * 1.6 : player.speed2d * 1.6, player.car ? player.car.def.name : '');
  hud.setObjective(missions.objectiveText());
  hud.setCrosshair(!player.car);
  hud.setHint(player.car
    ? 'W/S drive • A/D steer • Space handbrake • E exit car'
    : 'WASD move • Shift sprint • E steal car • Click shoot • F punch');
  hud.drawMinimap({
    player: { x: playerPos.x, z: playerPos.z, heading: camHeading },
    marker: missions.marker,
    traffic: traffic.cars,
    policeCars: police.cruisers,
  });

  // FPS meter (tiny, for the maker's own tuning).
  fpsFrames++;
  fpsTimer += dt;
  if (fpsTimer > 1) {
    document.getElementById('fps').textContent = `${Math.round(fpsFrames / fpsTimer)} fps`;
    fpsFrames = 0; fpsTimer = 0;
  }
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  update(dt);
  renderer.render(scene, camera);
}

// Hide the loading veil once the first frame is ready, then start.
requestAnimationFrame(() => {
  document.getElementById('loading').style.display = 'none';
  // Screenshot staging: ?shot=N (and autoplay) is only for the dossier.
  const shot = shotNumber();
  if (shot > 0) {
    const kind = stageShot(game, shot);
    if (kind !== 'menu') {
      initAudio();
      showOnly(null);
      hud.show();
      state = 'playing';
    }
    // Let the world settle a beat before the screenshot is taken.
    setTimeout(() => { window.__solmarReady = true; }, 1200);
  } else if (autoPlay()) {
    startGame(true);
  }
  window.__solmarReady = window.__solmarReady || false;
  // Exposed for automated smoke tests (camera/car state, screenshots).
  window.__solmarGame = game;
  window.__solmarCamera = camera;
  loop(performance.now());
});

export { game };
