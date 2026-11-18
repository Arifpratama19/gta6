// SOLMAR BAY — bootstrap, game loop and state machine.
// Wires the city, traffic, pedestrians, player, combat, police, missions,
// HUD and audio together. No network: three.js is vendored locally.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { City } from './city.js';
import { Traffic, PlayerCar, makeCarMesh } from './vehicles.js';
import { Pedestrians } from './people.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { saveGameData, loadGameData } from './save.js';
import { applyShot } from './shots.js';
import { clamp, dist2 } from './util.js';

class Game {
  constructor() {
    this.state = 'menu'; // menu | playing | paused | over
    this.time = 0;
    this.dayHours = 17.6; // golden hour
    this.cash = CONFIG.player.startCash;
    this.health = CONFIG.player.health;
    this.armor = 0;
    this.lastDamageAt = -99;
    this.shotMode = 0;
    this.shotFrames = 0;
    this.menuCamera = false;
    this.prevE = false;
    this.overReason = '';

    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(150, 70, 260);

    this.audio = new SoundBank();
    this.input = new Input();
    this.input.attach(canvas);
    this.input.onFirstGesture = () => this.audio.unlock();
    this.input.onPauseKey = () => this.togglePause();
    this.input.onMuteKey = () => {
      this.audio.setMuted(!this.audio.muted);
      this.hud.message(this.audio.muted ? 'Sound muted.' : 'Sound on.');
    };
    this.input.onRadioKey = () => {
      this.audio.musicOn = !this.audio.musicOn;
      this.hud.message(this.audio.musicOn ? 'Radio on — Vice Coast FM.' : 'Radio off.');
    };

    this.city = new City(this.scene);
    this.traffic = new Traffic(this.scene, this.city);
    this.peds = new Pedestrians(this.scene, this.city);
    this.player = new Player(this.scene);
    this.combat = new Combat(this.scene, this);
    this.police = new Police(this.scene, this);
    this.missions = new Missions(this.scene, this);
    this.hud = new HUD(this);

    this.traffic.populate(CONFIG.traffic.count);
    this.peds.populate(CONFIG.peds.count);

    this.wireButtons();
    this.hud.show('menu');
    this.updateContinueButton();

    window.addEventListener('resize', () => this.onResize());
    window.__game = this;
  }

  wireButtons() {
    document.getElementById('start-btn').addEventListener('click', () => {
      this.audio.unlock();
      this.newGame();
    });
    document.getElementById('continue-btn').addEventListener('click', () => {
      this.audio.unlock();
      const save = loadGameData();
      if (save) {
        this.cash = save.cash ?? CONFIG.player.startCash;
        this.missions.completed = save.completed ?? 0;
        this.startGame(true);
        this.missions.start(save.missionIndex ?? 0);
      } else {
        this.newGame();
      }
    });
    document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('restart-btn').addEventListener('click', () => this.newGame());
    document.getElementById('over-btn').addEventListener('click', () => {
      this.health = CONFIG.player.health;
      this.armor = 0;
      this.police.clearForce();
      this.player.pos.set(0, 0, 40);
      this.player.heading = 0;
      if (this.player.driving) {
        this.player.driving = null;
        this.player.mesh.visible = true;
      }
      this.startGame(true);
    });
    document.getElementById('menu-btn').addEventListener('click', () => {
      this.state = 'menu';
      this.hud.show('menu');
    });
  }

  updateContinueButton() {
    const save = loadGameData();
    const btn = document.getElementById('continue-btn');
    btn.style.display = save ? '' : 'none';
    if (save) {
      btn.textContent = `Continue — ${save.completed ?? 0}/5 jobs, $${(save.cash ?? 0).toLocaleString('en-US')}`;
    }
  }

  newGame() {
    this.cash = CONFIG.player.startCash;
    this.health = CONFIG.player.health;
    this.armor = 0;
    this.missions.completed = 0;
    this.police.setWanted(0);
    this.combat.clearEnemies();
    this.startGame(true);
    this.missions.start(0);
    this.hud.showBanner('SOLMAR BAY', 'Five jobs. One debt. Welcome home, Rico.');
  }

  startGame(fromMenu) {
    this.state = 'playing';
    this.menuCamera = false;
    this.hud.show('playing');
    if (fromMenu) this.audio.unlock();
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.hud.show('pause');
      document.exitPointerLock?.();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.hud.show('playing');
    }
  }

  saveGame() {
    saveGameData({
      cash: this.cash,
      missionIndex: this.missions.index,
      completed: this.missions.completed,
      savedAt: Date.now(),
    });
  }

  addHeat(n) {
    this.police.addHeat(n);
  }

  damagePlayer(n) {
    if (this.state !== 'playing' || n <= 0) return;
    this.lastDamageAt = this.time;
    let rest = n;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rest);
      this.armor -= absorbed;
      rest -= absorbed;
    }
    this.health -= rest;
    if (this.health <= 0) {
      this.health = 0;
      this.wasted();
    }
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.overReason = 'wasted';
    this.audio.busted();
    this.cash = Math.max(0, Math.round(this.cash * 0.85));
    document.getElementById('over-title').textContent = 'WASTED';
    document.getElementById('over-sub').textContent = 'Rico got clipped. The hospital patched him up — for a fee.';
    this.hud.show('over');
    this.saveGame();
  }

  busted() {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.overReason = 'busted';
    this.audio.busted();
    this.cash = Math.max(0, Math.round(this.cash * 0.85));
    document.getElementById('over-title').textContent = 'BUSTED';
    document.getElementById('over-sub').textContent = 'The Solmar Bay PD hauled Rico in. Bail took a cut of his cash.';
    this.hud.show('over');
    this.police.clearForce();
    this.saveGame();
  }

  takeCarAt(x, z) {
    let car = this.traffic.nearest(x, z, 60);
    if (!car) {
      const mesh = makeCarMesh(0xd7263d, 'sport');
      car = this.traffic.addParked(mesh, x + 4, z, 0);
    }
    this.traffic.removeCar(car);
    return new PlayerCar(car.mesh);
  }

  enterCar(playerCar) {
    this.player.enterCar(playerCar);
    this.audio.horn();
  }

  exitCar() {
    const car = this.player.exitCar();
    if (car) {
      this.traffic.addParked(car.mesh, car.pos.x, car.pos.z, car.heading);
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  handleInteract() {
    const eDown = this.input.down('KeyE');
    if (eDown && !this.prevE) {
      if (this.player.driving) {
        this.exitCar();
      } else {
        const car = this.traffic.nearest(this.player.x, this.player.z, 4.5);
        if (car) {
          this.traffic.removeCar(car);
          this.enterCar(new PlayerCar(car.mesh));
          this.addHeat(1);
          this.hud.message('Car stolen — someone called the cops!');
        }
      }
    }
    this.prevE = eDown;
  }

  handleShooting() {
    if (!this.player.driving && this.input.mouseDown && this.input.locked) {
      const dir = this.player.aimDirection(this.camera);
      this.combat.shoot(this.player.muzzlePosition(), dir);
    }
  }

  handleCarHits() {
    // Driving into pedestrians is a crime — and a mess.
    if (!this.player.driving) return;
    const car = this.player.driving;
    if (Math.abs(car.speed) < 4) return;
    const ped = this.peds.nearest(car.pos.x, car.pos.z, 2.6);
    if (ped) {
      ped.down = true;
      ped.downTimer = 25;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.35;
      this.addHeat(1);
      this.audio.crash();
      this.hud.message('You hit a pedestrian!');
      this.peds.scare(ped.mesh.position.x, ped.mesh.position.z, 60);
    }
    // Bump traffic cars.
    for (const c of this.traffic.cars) {
      if (c.parked) continue;
      const d = dist2(c.mesh.position.x, c.mesh.position.z, car.pos.x, car.pos.z);
      if (d < 4.2) {
        car.speed *= 0.6;
        c.speed = Math.max(c.speed, 6);
        if (Math.abs(car.speed) > 6) this.audio.crash();
      }
    }
  }

  update(dt) {
    this.time += dt;
    this.dayHours = (this.dayHours + dt * 0.008) % 24;
    this.city.update(dt);
    if (this.shotMode) {
      this.shotFrames++;
      if (this.shotFrames > 45) window.__shotReady = true;
    }

    if (this.state === 'menu') {
      if (!this.menuCamera) {
        const a = this.time * 0.045;
        this.camera.position.set(-40 + Math.sin(a) * 250, 72, -120 + Math.cos(a) * 250);
        this.camera.lookAt(-40, 28, -120);
      }
      this.traffic.update(dt, this.player.pos);
      this.peds.update(dt);
      return;
    }
    if (this.state !== 'playing') return;

    this.player.update(dt, this.input, this);
    this.handleInteract();
    this.handleShooting();
    this.handleCarHits();
    this.traffic.update(dt, this.player.pos);
    this.peds.update(dt);
    this.combat.update(dt);
    this.police.update(dt);
    this.missions.update(dt);
    this.audio.update(dt, this.police.wanted);
    this.audio.updateMusic(dt, true);

    // Slow health regen after 8 quiet seconds.
    if (this.time - this.lastDamageAt > 8 && this.health > 0 && this.health < CONFIG.player.health) {
      this.health = Math.min(CONFIG.player.health, this.health + 2.5 * dt);
    }
    // Mission 2's delivery pays an armor bonus on completion is handled in missions.
    this.hud.update(dt);
  }

  loop() {
    const clock = new THREE.Clock();
    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      try {
        this.update(dt);
      } catch (err) {
        window.__error = String(err && err.stack ? err.stack : err);
        document.title = 'GAME ERROR';
      }
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    tick();
  }
}

window.addEventListener('error', (e) => {
  window.__error = String(e.message);
});

const params = new URLSearchParams(location.search);
const game = new Game();
game.loop();
const shot = parseInt(params.get('shot') || '0', 10);
if (shot >= 1 && shot <= 4) {
  applyShot(game, shot);
  game.hud.update(0);
}
window.__ready = true;
