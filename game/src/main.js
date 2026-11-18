// SOLMAR BAY — the game itself: loop, input, camera, driving, missions, wanted.
// One job: glue every system together and run the frame.

import * as THREE from 'three';
import { WORLD, PLAYER, CAR, TRAFFIC, PALETTE } from './config.js';
import { City } from './city.js';
import { TrafficSystem, PoliceSystem, buildCarMesh } from './vehicles.js';
import { PedestrianSystem, buildPlayerMesh } from './people.js';
import { CombatSystem, WantedSystem } from './combat.js';
import { MissionRunner, MISSIONS } from './missions.js';
import { Hud } from './hud.js';
import { SoundBank } from './audio.js';
import { saveGame, loadGame, clearSave, saveSummary } from './save.js';

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const $ = (id) => document.getElementById(id);

export class SolmarBayGame {
  constructor() {
    this.rand = seededRandom(20261118);
    this.canvas = $('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x53356e);
    this.scene.fog = new THREE.Fog(PALETTE.fog, 140, 560);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(0, 8, -14);

    // Sunset: a low warm sun and a violet sky fill.
    const sun = new THREE.DirectionalLight(PALETTE.sun, 3.4);
    sun.position.set(-140, 130, 170);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
    sun.shadow.camera.far = 600;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0x9a7fd6, 0x5a4028, 1.3));

    this.city = new City(this.scene);
    this.traffic = new TrafficSystem(this.scene, this.city, this.rand);
    this.traffic.populate(TRAFFIC.cars);
    this.police = new PoliceSystem(this.scene, this.traffic, this.rand);
    this.peds = new PedestrianSystem(this.scene, this.city, this.rand);
    this.peds.populate(TRAFFIC.pedestrians);
    this.combat = new CombatSystem(this.scene);
    this.wanted = new WantedSystem();
    this.hud = new Hud();
    this.sound = new SoundBank();

    // Player state.
    this.playerMesh = buildPlayerMesh();
    this.scene.add(this.playerMesh);
    this.playerPos = new THREE.Vector3(-8, 0, -150);
    this.playerHeading = 0;
    this.playerSpeed = 0;
    this.health = PLAYER.maxHealth;
    this.cash = PLAYER.startCash;
    this.totalEarned = 0;
    this.carsStolen = 0;
    this.rivalsWrecked = 0;
    this.playSeconds = 0;
    this.inCar = false;
    this.currentCar = null;
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.camDistance = 10;

    this.screen = 'menu'; // menu | playing | paused | over
    this.missions = new MissionRunner((type, data) => this.onMissionEvent(type, data));
    this.rivalCars = [];
    this.missionDelay = 0;
    this.autoSaveTimer = 0;
    this.keys = {};
    this.mouseDown = false;
    this.time = 0;
    this.lastRamAt = 0;
    this.lastShotAt = 0;
    this.bustedReason = '';

    this.bindInput();
    this.bindMenus();
    this.applySceneParam();
    window.addEventListener('resize', () => this.onResize());
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  // ---- menus -------------------------------------------------------------
  bindMenus() {
    $('play-btn').addEventListener('click', () => { this.sound.unlock(); this.startNewGame(); });
    $('continue-btn').addEventListener('click', () => { this.sound.unlock(); this.startSavedGame(); });
    $('resume-btn').addEventListener('click', () => this.resume());
    $('restart-btn').addEventListener('click', () => { this.startSavedGame(); });
    $('quit-btn').addEventListener('click', () => this.toMenu());
    $('again-btn').addEventListener('click', () => { this.startSavedGame(); });
    $('end-menu-btn').addEventListener('click', () => this.toMenu());
    const save = loadGame();
    $('save-line').textContent = saveSummary(save);
    $('continue-btn').style.display = save ? '' : 'none';
  }

  toMenu() {
    this.screen = 'menu';
    $('menu-screen').classList.remove('hidden');
    $('pause-screen').classList.add('hidden');
    $('end-screen').classList.add('hidden');
    this.hud.hide();
    const save = loadGame();
    $('save-line').textContent = saveSummary(save);
    $('continue-btn').style.display = save ? '' : 'none';
    if (document.pointerLockElement) document.exitPointerLock();
  }

  startNewGame() {
    clearSave();
    this.resetRun({ cash: PLAYER.startCash, health: PLAYER.maxHealth, missionIndex: 0, missionsDone: 0, playerX: -8, playerZ: -150, playerHeading: 0, totalEarned: 0, carsStolen: 0, rivalsWrecked: 0, playSeconds: 0 });
    this.beginPlay();
    this.missions.start(0);
    this.hud.toast('Vic Marlowe: First job — jack a car and bring it to my garage. Go!');
  }

  startSavedGame() {
    const save = loadGame();
    if (save) {
      this.resetRun(save);
      this.beginPlay();
      if (save.missionIndex < MISSIONS.length) {
        this.missions.index = save.missionIndex;
        this.missions.start(save.missionIndex);
        this.hud.toast(`Welcome back, Dana. Job ${save.missionIndex + 1} is waiting.`);
      } else {
        this.hud.toast('All jobs done — Solmar Bay is yours. Free roam!');
      }
    } else {
      this.startNewGame();
    }
  }

  resetRun(s) {
    this.cash = s.cash;
    this.health = s.health;
    this.totalEarned = s.totalEarned || 0;
    this.carsStolen = s.carsStolen || 0;
    this.rivalsWrecked = s.rivalsWrecked || 0;
    this.playSeconds = s.playSeconds || 0;
    this.playerPos.set(s.playerX, 0, s.playerZ);
    this.playerHeading = s.playerHeading || 0;
    this.wanted.clear();
    this.police.clearAll();
    this.clearRivals();
    this.exitCar(true);
    this.playerMesh.position.copy(this.playerPos);
    this.playerMesh.visible = true;
    this.missions = new MissionRunner((type, data) => this.onMissionEvent(type, data));
    this.missions.index = s.missionIndex || 0;
  }

  beginPlay() {
    this.screen = 'playing';
    $('menu-screen').classList.add('hidden');
    $('pause-screen').classList.add('hidden');
    $('end-screen').classList.add('hidden');
    this.hud.show();
  }

  pause() {
    if (this.screen !== 'playing') return;
    this.screen = 'paused';
    $('pause-screen').classList.remove('hidden');
    this.renderMissionList();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  resume() {
    if (this.screen !== 'paused') return;
    this.screen = 'playing';
    $('pause-screen').classList.add('hidden');
  }

  renderMissionList() {
    const done = this.missions.index;
    let html = '';
    MISSIONS.forEach((m, i) => {
      const cls = i < done ? 'done' : (i === done ? 'next' : 'locked');
      const mark = i < done ? '✓' : (i === done ? '▶' : '·');
      html += `<div class="${cls}">${mark} ${m.title} — $${m.reward.toLocaleString('en-US')}</div>`;
    });
    html += `<div style="margin-top:8px;color:#9fb3d1">Cash: $${this.cash.toLocaleString('en-US')} · Cars stolen: ${this.carsStolen} · Played: ${Math.floor(this.playSeconds / 60)} min</div>`;
    $('pause-missions').innerHTML = html;
  }

  gameOver(reason) {
    this.screen = 'over';
    this.bustedReason = reason;
    this.sound.busted();
    if (document.pointerLockElement) document.exitPointerLock();
    $('end-title').textContent = reason === 'busted' ? 'BUSTED' : 'WASTED';
    $('end-title').style.color = reason === 'busted' ? '#5eb1ff' : '#ff5d5d';
    const mins = Math.floor(this.playSeconds / 60);
    $('end-stats').innerHTML =
      `${reason === 'busted' ? 'The Solmar PD finally caught up with Dana.' : 'Dana went down in the streets of Solmar Bay.'}<br>` +
      `Cash kept: <b>$${this.cash.toLocaleString('en-US')}</b> &nbsp;·&nbsp; Jobs done: <b>${this.missions.index} / 5</b><br>` +
      `Cars stolen: <b>${this.carsStolen}</b> &nbsp;·&nbsp; Time in the city: <b>${mins} min</b><br>` +
      `Your last save is waiting — jump back in.`;
    $('end-screen').classList.remove('hidden');
    this.hud.hide();
    saveGame(this.saveState());
  }

  saveState() {
    return {
      cash: this.cash, health: this.health, missionIndex: this.missions.index,
      missionsDone: this.missions.index, playerX: this.playerPos.x, playerZ: this.playerPos.z,
      playerHeading: this.playerHeading, totalEarned: this.totalEarned,
      carsStolen: this.carsStolen, rivalsWrecked: this.rivalsWrecked, playSeconds: this.playSeconds,
    };
  }

  // ---- input ---------------------------------------------------------------
  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.screen === 'playing') this.pause();
        else if (this.screen === 'paused') this.resume();
      }
      if (e.code === 'KeyM') {
        if (this.screen === 'playing') this.pause();
      }
      if (e.code === 'KeyE' && this.screen === 'playing') this.tryEnterExitCar();
      if (e.code === 'KeyR' && this.screen === 'playing') this.tryEnterExitCar();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.screen !== 'playing') return;
      this.mouseDown = true;
      if (!document.pointerLockElement) this.canvas.requestPointerLock?.();
      if (e.button === 0) this.tryShoot();
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas && this.screen === 'playing') {
        this.camYaw -= e.movementX * 0.0032;
        this.camPitch = Math.max(-0.1, Math.min(0.9, this.camPitch + e.movementY * 0.0022));
      }
    });
    // Arrow keys also steer the camera, so the game is fully playable without a mouse lock.
    window.addEventListener('keydown', (e) => {
      if (this.screen !== 'playing') return;
      if (e.code === 'ArrowLeft') this.camYaw += 0.09;
      if (e.code === 'ArrowRight') this.camYaw -= 0.09;
      if (e.code === 'ArrowUp') this.camPitch = Math.max(-0.1, Math.min(0.9, this.camPitch - 0.06));
      if (e.code === 'ArrowDown') this.camPitch = Math.max(-0.1, Math.min(0.9, this.camPitch + 0.06));
    });
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---- cars ------------------------------------------------------------------
  tryEnterExitCar() {
    if (this.inCar) { this.exitCar(false); return; }
    const car = this.traffic.nearestStealable(this.playerPos.x, this.playerPos.z, 6.5);
    if (!car) { this.hud.toast('No car close enough — walk up to one.'); return; }
    this.currentCar = car;
    this.inCar = true;
    this.playerMesh.visible = false;
    this.carsStolen++;
    this.sound.doorSlam();
    car.stop();
    this.wanted.addCrime(1.0, this.time); // jacking a car in broad daylight: one star at once
    this.hud.toast('Car jacked! The owner is calling the cops — keep moving.');
    this.hud.setCrosshair(false);
  }

  exitCar(silent) {
    if (!this.inCar || !this.currentCar) return;
    const c = this.currentCar;
    const side = new THREE.Vector3(Math.cos(c.heading), 0, -Math.sin(c.heading));
    this.playerPos.set(c.pos.x + side.x * 2.6, 0, c.pos.z + side.z * 2.6);
    this.playerHeading = c.heading;
    this.inCar = false;
    this.currentCar = null;
    this.playerMesh.visible = true;
    this.playerMesh.position.copy(this.playerPos);
    if (!silent) this.sound.doorSlam();
    this.hud.setCrosshair(true);
  }

  // Rival crew cars for Job 4: red, aggressive, wreckable.
  spawnRivals(count) {
    this.clearRivals();
    for (let i = 0; i < count; i++) {
      const mesh = buildCarMesh(0x8d0801, false);
      this.scene.add(mesh);
      const x = 150 + (this.rand() - 0.5) * 60;
      const z = -20 + i * 30 + (this.rand() - 0.5) * 20;
      const car = { mesh, pos: new THREE.Vector3(x, 0, z), heading: this.rand() * Math.PI * 2, speed: 12, health: 100, isRival: true };
      mesh.position.copy(car.pos);
      this.rivalCars.push(car);
      this.traffic.cars.push(car);
    }
  }

  clearRivals() {
    for (const r of this.rivalCars) {
      this.scene.remove(r.mesh);
      const i = this.traffic.cars.indexOf(r);
      if (i >= 0) this.traffic.cars.splice(i, 1);
    }
    this.rivalCars = [];
  }

  damageRival(rival, amount) {
    rival.health -= amount;
    // Smoke and sparks when hurt.
    const puff = new THREE.PointLight(0xff7722, 24, 8);
    puff.position.copy(rival.pos).y = 1.2;
    this.scene.add(puff);
    setTimeout(() => this.scene.remove(puff), 120);
    if (rival.health <= 0) {
      const idx = this.rivalCars.indexOf(rival);
      if (idx >= 0) {
        this.rivalCars.splice(idx, 1);
        const ti = this.traffic.cars.indexOf(rival);
        if (ti >= 0) this.traffic.cars.splice(ti, 1);
        // Wreck: spin the car out and leave it smoking.
        rival.mesh.rotation.z = 0.5;
        rival.mesh.position.y = 0.2;
        this.sound.crash();
        this.rivalsWrecked++;
        this.missions.rivalDestroyed();
        this.hud.toast(`Rival car wrecked! ${this.missions.rivalsDown} of 3 down.`);
        setTimeout(() => this.scene.remove(rival.mesh), 6000);
      }
    }
  }

  // ---- shooting --------------------------------------------------------------
  tryShoot() {
    if (this.screen !== 'playing' || this.time - this.lastShotAt < 0.2) return;
    this.lastShotAt = this.time;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const origin = this.camera.position.clone();
    const targets = [];
    for (const c of this.police.cruisers) targets.push({ pos: c.pos.clone().setY(1), radius: 2.2, kind: 'police', ref: c });
    for (const r of this.rivalCars) targets.push({ pos: r.pos.clone().setY(1), radius: 2.2, kind: 'rival', ref: r });
    for (const p of this.peds.peds) targets.push({ pos: p.pos.clone().setY(1.2), radius: 0.9, kind: 'ped', ref: p });
    const hit = this.combat.shoot(origin, dir, targets);
    this.sound.gunshot();
    this.peds.scare(this.playerPos.x, this.playerPos.z, 35);
    this.wanted.addCrime(0.5, this.time);
    if (hit) {
      if (hit.kind === 'rival') this.damageRival(hit.ref, this.combat.damage);
      if (hit.kind === 'police') {
        this.wanted.addCrime(0.8, this.time);
        this.hud.toast('You shot a cop car! The whole PD is coming.');
      }
      if (hit.kind === 'ped') this.wanted.addCrime(1.2, this.time);
    }
  }

  // ---- missions ----------------------------------------------------------------
  onMissionEvent(type, data) {
    if (type === 'start') {
      this.sound.pickup();
      const m = data.mission;
      this.hud.toast(`${m.title}: ${m.brief}`);
      if (m.id === 'street-heat') this.spawnRivals(3);
    }
    if (type === 'step') {
      this.sound.pickup();
      this.hud.toast(data.step.text);
    }
    if (type === 'rival') {
      // Toast handled in damageRival.
    }
    if (type === 'complete') {
      this.cash += data.reward;
      this.totalEarned += data.reward;
      this.sound.cashRegister();
      this.sound.missionDone();
      this.hud.toast(`JOB DONE — Vic paid $${data.reward.toLocaleString('en-US')}!`, 4200);
      this.wanted.clear();
      this.police.clearAll();
      saveGame(this.saveState());
      if (!this.missions.finishedAll) {
        this.missionDelay = 4;
      } else {
        this.hud.toast('ALL FIVE JOBS DONE — Dana owns Solmar Bay now. Free roam!', 6000);
      }
    }
    if (type === 'fail') {
      this.sound.missionFail();
      this.hud.toast(`JOB FAILED: ${data.reason} Talk to Vic to try again (M).`, 5000);
    }
  }

  setWantedAtLeast(stars) {
    if (this.wanted.stars < stars) {
      // +0.9 of heat so the stars hold while the player is on the run.
      this.wanted.heat = stars + 0.9;
      this.wanted.stars = stars;
    }
  }

  // ---- screenshot scenes ---------------------------------------------------------
  // ?scene=chase | street | heist | menu — deterministic setups for screenshots.
  applySceneParam() {
    const params = new URLSearchParams(window.location.search);
    const scene = params.get('scene');
    if (!scene) return;
    this.sceneParam = scene;
    if (scene === 'menu') return;
    this.startNewGame();
    if (scene === 'chase') {
      this.missions.index = 2;
      this.missions.start(2);
      this.missions.step = 2;
      this.missions.waitLeft = 0;
      this.setWantedAtLeast(2);
      const car = this.traffic.cars[0];
      this.currentCar = car;
      this.inCar = true;
      this.playerMesh.visible = false;
      car.pos.set(-20, 0, 60);
      car.heading = Math.PI;
      car.speed = 24;
      this.playerPos.copy(car.pos);
      this.camYaw = Math.PI;
      this.camPitch = 0.22;
      // Two cruisers right on Dana's tail for the shot.
      for (const dz of [-26, -38]) {
        const cruiser = this.traffic.spawnCar(-20 + (dz === -26 ? -4 : 4), 60 + dz, Math.PI, true);
        cruiser.speed = 26;
        this.police.cruisers.push(cruiser);
        this.traffic.cars.push(cruiser);
      }
      this.keys.KeyW = true; // keep the getaway rolling through the warmup
    } else if (scene === 'street') {
      this.playerPos.set(20, 0, 10);
      this.playerHeading = 2.6;
      this.camYaw = 2.6;
      this.camPitch = 0.28;
    } else if (scene === 'heist') {
      this.missions.index = 4;
      this.missions.start(4);
      this.missions.step = 2;
      this.setWantedAtLeast(3);
      const car = this.traffic.cars[1];
      this.currentCar = car;
      this.inCar = true;
      this.playerMesh.visible = false;
      car.pos.set(168, 0, 60);
      car.heading = Math.PI;
      car.speed = 18;
      this.playerPos.copy(car.pos);
      this.camYaw = Math.PI;
      this.camPitch = 0.22;
      const cruiser = this.traffic.spawnCar(164, 86, Math.PI, true);
      cruiser.speed = 24;
      this.police.cruisers.push(cruiser);
      this.traffic.cars.push(cruiser);
      this.keys.KeyW = true;
    }
    // Let the world settle a couple of seconds so traffic and police are in frame.
    const warmup = parseFloat(params.get('warmup') || '2.5');
    for (let i = 0; i < Math.floor(warmup * 60); i++) this.tick(1 / 60, true);
    this.hud.update(this.hudState(), 0);
    window.__solmarReady = true;
  }

  // ---- per-frame -------------------------------------------------------------------
  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - (this.lastFrame || now)) / 1000 || 0.016);
    this.lastFrame = now;
    if (this.screen === 'playing') this.tick(dt, false);
    else if (this.screen === 'menu') this.tickMenu(dt);
    this.renderer.render(this.scene, this.camera);
    if (!window.__solmarReady && this.time > 1) window.__solmarReady = true;
  }

  tickMenu(dt) {
    // Slow orbit around the city behind the title screen.
    this.time += dt;
    const a = this.time * 0.05;
    this.camera.position.set(Math.sin(a) * 180, 55, Math.cos(a) * 180);
    this.camera.lookAt(0, 0, 40);
    this.city.update(dt, this.time);
    this.traffic.update(dt, this.playerPos);
    this.peds.update(dt, this.playerPos, false, this.time);
  }

  hudState() {
    const mission = this.missions.mission;
    const stepText = this.missions.active ? this.missions.objectiveText() : null;
    const waitText = this.missions.active && this.missions.currentStep && this.missions.currentStep.wait && this.missions.waitLeft > 0
      ? `Hold position… ${Math.ceil(this.missions.waitLeft)}s` : null;
    return {
      stars: this.wanted.stars,
      cash: this.cash,
      missionTitle: this.missions.active ? mission.title : 'FREE ROAM',
      missionText: stepText || waitText || (this.missions.finishedAll
        ? 'Every job is done. Solmar Bay is yours — drive, explore, cause a little chaos.'
        : 'Press M for the job list. Vic always has work.'),
      missionTimer: this.missions.timer,
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      playerHeading: this.inCar && this.currentCar ? this.currentCar.heading : this.playerHeading,
      health: this.health,
      speed: this.inCar && this.currentCar ? this.currentCar.speed : Math.abs(this.playerSpeed),
      inCar: this.inCar,
      vehicleName: this.inCar ? 'STOLEN SEDAN — SOLMAR PD wants it back' : 'ON FOOT',
      buildings: this.city.buildings,
      traffic: this.traffic.cars.filter((c) => !c.isPolice && !c.isRival).map((c) => ({ x: c.pos.x, z: c.pos.z })),
      police: this.police.cruisers.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      objective: this.missions.markerPos(),
    };
  }

  tick(dt, silent) {
    this.time += dt;
    this.playSeconds += dt;
    this.combat.update(dt);
    this.city.update(dt, this.time);
    this.peds.update(dt, this.playerPos, this.inCar, this.time);
    this.traffic.update(dt, this.playerPos);

    // Mission chain: the next job starts a few seconds after the last one pays out.
    if (this.missionDelay > 0) {
      this.missionDelay -= dt;
      if (this.missionDelay <= 0 && !this.missions.finishedAll && !this.missions.active) {
        this.missions.start(this.missions.index);
      }
    }
    this.missions.update(dt, this);

    // Wanted heat and the police response.
    const nearestCop = this.police.closestDistance(this.playerPos);
    this.wanted.update(dt, this.time, nearestCop);
    const sirensOn = this.police.update(dt, this.playerPos, this.inCar ? this.currentCar?.speed || 0 : 0, this.wanted.stars, this.time);
    this.sound.setSiren(sirensOn);

    if (this.inCar && this.currentCar) this.driveCar(dt);
    else this.walkPlayer(dt);

    // Police rams hurt; traffic bumps hurt a little.
    this.handleCollisions(dt);
    // Rival cars cruise the Strip and try to ram the player.
    this.updateRivals(dt);

    // Health / busted.
    if (this.health <= 0) {
      this.gameOver(this.wanted.stars > 0 ? 'busted' : 'wasted');
      return;
    }
    // Busted on foot: a cruiser sitting on top of Dana for a while arrests her.
    if (!this.inCar && nearestCop < 3.5 && this.wanted.stars >= 2 && this.time - (this.lastArrestCheck || 0) > 1) {
      this.lastArrestCheck = this.time;
      this.arrestTimer = (this.arrestTimer || 0) + 1;
      if (this.arrestTimer >= 3) { this.gameOver('busted'); return; }
    } else {
      this.arrestTimer = 0;
    }

    this.updateCamera(dt);
    this.hud.update(this.hudState(), dt);
    this.sound.setEngine(this.inCar && this.currentCar ? Math.abs(this.currentCar.speed) / CAR.maxSpeed : 0, this.inCar);

    // Autosave.
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer > 25) {
      this.autoSaveTimer = 0;
      saveGame(this.saveState());
    }
    if (this.mouseDown && this.time - this.lastShotAt > 0.25) this.tryShoot();
  }

  walkPlayer(dt) {
    const k = this.keys;
    let ix = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    let iz = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
    const len = Math.hypot(ix, iz);
    if (len > 0) { ix /= len; iz /= len; }
    const sprint = k.ShiftLeft || k.ShiftRight;
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    // Movement is relative to the camera yaw: W walks away from the camera.
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    const mx = ix * cos + iz * sin;
    const mz = -ix * sin + iz * cos;
    const targetSpeed = len * speed;
    this.playerSpeed += (targetSpeed - this.playerSpeed) * Math.min(1, dt * 10);
    if (len > 0) {
      this.playerHeading = Math.atan2(mx, mz);
      const nx = this.playerPos.x + mx * this.playerSpeed * dt;
      const nz = this.playerPos.z + mz * this.playerSpeed * dt;
      if (!this.city.collideCircle(nx, nz, 0.7)) {
        this.playerPos.x = nx;
        this.playerPos.z = nz;
      } else if (!this.city.collideCircle(nx, this.playerPos.z, 0.7)) {
        this.playerPos.x = nx;
      } else if (!this.city.collideCircle(this.playerPos.x, nz, 0.7)) {
        this.playerPos.z = nz;
      }
      const [cx, cz] = this.city.clampToLand(this.playerPos.x, this.playerPos.z);
      this.playerPos.x = cx; this.playerPos.z = cz;
    }
    // Walk-cycle swing.
    const swing = Math.sin(this.time * (sprint ? 13 : 9)) * (this.playerSpeed > 0.5 ? 0.6 : 0);
    const u = this.playerMesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7;
    u.armR.rotation.x = swing * 0.7;
    this.playerMesh.position.copy(this.playerPos);
    this.playerMesh.rotation.y = this.playerHeading;
    this.hud.setCrosshair(true);
  }

  driveCar(dt) {
    const k = this.keys;
    const throttle = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const steer = (k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0);
    const handbrake = !!(k.Space);
    const car = this.currentCar;
    car.drive(dt, throttle, steer, handbrake);
    // Buildings stop the car, hard.
    const hit = this.city.collideCircle(car.pos.x, car.pos.z, 2.2);
    if (hit) {
      const push = 2.4;
      const dx = car.pos.x - hit.x;
      const dz = car.pos.z - hit.z;
      const ox = hit.halfW + push - Math.abs(dx);
      const oz = hit.halfD + push - Math.abs(dz);
      if (ox < oz) car.pos.x += Math.sign(dx) * ox; else car.pos.z += Math.sign(dz) * oz;
      if (Math.abs(car.speed) > 12 && this.time - this.lastRamAt > 0.6) {
        this.lastRamAt = this.time;
        this.sound.crash();
        this.health -= CombatSystem.ramDamage(Math.abs(car.speed)) * 0.5;
        this.hud.flashDamage();
      }
      car.speed *= 0.4;
    }
    const [cx, cz] = this.city.clampToLand(car.pos.x, car.pos.z);
    car.pos.x = cx; car.pos.z = cz;
    this.playerPos.copy(car.pos);
    // Camera follows the car's heading when driving.
    this.camYaw += (((car.heading - this.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 1.2);
  }

  handleCollisions(dt) {
    // Traffic and police bumping the player's car.
    if (this.inCar && this.currentCar) {
      const me = this.currentCar;
      for (const other of this.traffic.cars) {
        if (other === me || other.isRival) continue;
        const d = Math.hypot(other.pos.x - me.pos.x, other.pos.z - me.pos.z);
        if (d < 4.2 && d > 0.01) {
          const push = (4.2 - d) / 2;
          const nx = (me.pos.x - other.pos.x) / d;
          const nz = (me.pos.z - other.pos.z) / d;
          me.pos.x += nx * push;
          me.pos.z += nz * push;
          const relSpeed = Math.abs(me.speed - other.speed);
          if (relSpeed > 8 && this.time - this.lastRamAt > 0.6) {
            this.lastRamAt = this.time;
            this.sound.crash();
            if (other.isPolice) {
              this.health -= CombatSystem.ramDamage(relSpeed);
              this.hud.flashDamage();
              this.hud.toast('Solmar PD is ramming you!');
            } else {
              this.health -= CombatSystem.ramDamage(relSpeed) * 0.3;
            }
          }
          me.speed *= 0.94;
        }
      }
      // Rival rams.
      for (const r of this.rivalCars) {
        const d = Math.hypot(r.pos.x - me.pos.x, r.pos.z - me.pos.z);
        if (d < 4.2 && Math.abs(me.speed) > 10 && this.time - this.lastRamAt > 0.8) {
          this.lastRamAt = this.time;
          this.sound.crash();
          this.damageRival(r, 26);
          this.health -= 3;
          this.hud.flashDamage();
        }
      }
    } else {
      // On foot: traffic can knock Dana down.
      for (const other of this.traffic.cars) {
        const d = Math.hypot(other.pos.x - this.playerPos.x, other.pos.z - this.playerPos.z);
        if (d < 2.2 && Math.abs(other.speed) > 4) {
          this.health -= 18;
          this.hud.flashDamage();
          this.playerPos.x += Math.sign(this.playerPos.x - other.pos.x || 1) * 2;
          this.playerPos.z += Math.sign(this.playerPos.z - other.pos.z || 1) * 2;
          this.sound.crash();
          this.wanted.addCrime(0.3, this.time);
          other.speed *= 0.3;
        }
      }
    }
  }

  updateRivals(dt) {
    if (this.rivalCars.length === 0) return;
    for (const r of this.rivalCars) {
      // Rivals cruise toward the player and try to ram.
      const dx = this.playerPos.x - r.pos.x;
      const dz = this.playerPos.z - r.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const want = Math.atan2(dx, dz);
      let diff = want - r.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      r.heading += Math.max(-1.4 * dt, Math.min(1.4 * dt, diff));
      r.speed = Math.min(24, r.speed + 8 * dt);
      r.pos.x += Math.sin(r.heading) * r.speed * dt;
      r.pos.z += Math.cos(r.heading) * r.speed * dt;
      const [cx, cz] = this.city.clampToLand(r.pos.x, r.pos.z);
      r.pos.x = cx; r.pos.z = cz;
      r.mesh.position.copy(r.pos);
      r.mesh.rotation.y = r.heading;
      const spin = (r.speed * dt) / 0.38;
      for (const w of r.mesh.userData.wheels) w.rotation.x += spin;
      // Rival ramming the player on foot.
      if (!this.inCar && dist < 2.4) {
        this.health -= 12;
        this.hud.flashDamage();
        this.playerPos.x += (dx / dist) * -3;
        this.playerPos.z += (dz / dist) * -3;
      }
    }
  }

  updateCamera(dt) {
    const target = this.inCar && this.currentCar ? this.currentCar.pos : this.playerPos;
    const dist = this.inCar ? 11 : 9.5;
    const height = this.inCar ? 5 : 3.6;
    const yaw = this.inCar ? this.camYaw : this.camYaw;
    const cx = target.x - Math.sin(yaw) * dist * Math.cos(this.camPitch);
    const cz = target.z - Math.cos(yaw) * dist * Math.cos(this.camPitch);
    const cy = height + Math.sin(this.camPitch) * dist * 0.55;
    const desired = new THREE.Vector3(cx, cy, cz);
    this.camera.position.lerp(desired, Math.min(1, dt * 7));
    this.camera.lookAt(target.x, target.y + 1.6, target.z);
  }
}

// Boot the game when the page loads.
window.__solmarGame = new SolmarBayGame();
