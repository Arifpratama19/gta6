// The wanted system: stars rise with crime, Solmar Bay PD cars chase the
// player, foot cops move in when the player is on foot, and getting caught
// means BUSTED.

import * as THREE from 'three';
import { makeCarMesh } from './vehicles.js';
import { CONFIG } from './config.js';
import { clamp, dist2, rand } from './util.js';

function makeCopMesh() {
  const g = new THREE.Group();
  const uniform = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.82, 0.36), uniform);
  torso.position.y = 1.14;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
  head.position.y = 1.76;
  g.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.12, 12), new THREE.MeshLambertMaterial({ color: 0x0f172a }));
  hat.position.y = 1.95;
  g.add(hat);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.74, 0.26), new THREE.MeshLambertMaterial({ color: 0x0f172a }));
  legL.position.set(-0.17, 0.37, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.68, 0.19), uniform);
  armL.position.set(-0.44, 1.12, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.44;
  g.add(armR);
  g.userData = { legL, legR };
  return g;
}

export class Police {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.wanted = 0;
    this.copCars = [];
    this.cops = [];
    this.quietTimer = 0;
    this.decayTimer = 0;
    this.bustedTimer = 0;
    this.spawnTimer = 0;
    this.flashPhase = 0;
  }

  setWanted(n) {
    this.wanted = clamp(n, 0, CONFIG.wanted.max);
    this.quietTimer = 0;
    this.decayTimer = 0;
    if (this.wanted === 0) this.clearForce();
  }

  addHeat(n) {
    if (n <= 0) return;
    this.setWanted(this.wanted + n);
    this.game.hud.flashWanted();
  }

  clearForce() {
    for (const c of this.copCars) this.scene.remove(c.mesh);
    for (const c of this.cops) this.scene.remove(c.mesh);
    this.copCars = [];
    this.cops = [];
    this.bustedTimer = 0;
  }

  hurtCop(cop) {
    cop.hp -= 34;
    if (cop.hp <= 0) {
      cop.down = true;
      cop.mesh.rotation.x = -Math.PI / 2;
      cop.mesh.position.y = 0.35;
      cop.downTimer = 20;
      this.addHeat(1);
    }
  }

  spawnCopCar(x, z) {
    const pp = this.game.player.pos;
    const ang = rand(0, Math.PI * 2);
    const cx = x !== undefined ? x : clamp(pp.x + Math.sin(ang) * 70, -430, 430);
    const cz = z !== undefined ? z : clamp(pp.z + Math.cos(ang) * 70, -430, 430);
    const mesh = makeCarMesh(0xf8fafc, 'cop');
    mesh.position.set(cx, 0, cz);
    this.scene.add(mesh);
    this.copCars.push({ mesh, speed: 0, hp: 100, heading: 0 });
  }

  spawnFootCop() {
    const pp = this.game.player.pos;
    const ang = rand(0, Math.PI * 2);
    const mesh = makeCopMesh();
    mesh.position.set(
      clamp(pp.x + Math.sin(ang) * 18, -430, 430),
      0,
      clamp(pp.z + Math.cos(ang) * 18, -430, 430)
    );
    this.scene.add(mesh);
    this.cops.push({ mesh, hp: 100, down: false, downTimer: 0, phase: rand(0, 6) });
  }

  update(dt) {
    const game = this.game;
    const pp = game.player.pos;
    const wanted = this.wanted;

    game.audio.setSiren(wanted > 0 && game.state === 'playing');

    // Wanted decay: stay clean and out of sight and the heat cools off.
    if (wanted > 0) {
      let nearestCop = Infinity;
      for (const c of this.copCars) nearestCop = Math.min(nearestCop, dist2(c.mesh.position.x, c.mesh.position.z, pp.x, pp.z));
      for (const c of this.cops) nearestCop = Math.min(nearestCop, dist2(c.mesh.position.x, c.mesh.position.z, pp.x, pp.z));
      if (nearestCop > 55) this.quietTimer += dt;
      else this.quietTimer = 0;
      if (this.quietTimer > CONFIG.wanted.decayQuietSeconds) {
        this.decayTimer += dt;
        if (this.decayTimer > CONFIG.wanted.decayStepSeconds) {
          this.decayTimer = 0;
          this.setWanted(wanted - 1);
          game.hud.message('The heat is cooling off…');
        }
      }
    }

    // Keep the force at the wanted level.
    if (game.state === 'playing' && wanted > 0) {
      this.spawnTimer -= dt;
      const wantCars = Math.min(wanted, 4);
      if (this.copCars.length < wantCars && this.spawnTimer <= 0) {
        this.spawnTimer = 1.5;
        this.spawnCopCar();
      }
      const wantFoot = game.player.driving ? 0 : Math.min(wanted, 3);
      if (this.cops.filter((c) => !c.down).length < wantFoot && this.spawnTimer <= 0) {
        this.spawnTimer = 1.5;
        this.spawnFootCop();
      }
    }

    // Cop cars chase: steer toward the player, ram on contact.
    this.flashPhase += dt * 6;
    const flashOn = Math.sin(this.flashPhase) > 0;
    for (const c of this.copCars) {
      const m = c.mesh;
      if (m.userData.copRed) m.userData.copRed.material.color.setHex(flashOn ? 0xff2222 : 0x550000);
      if (m.userData.copBlue) m.userData.copBlue.material.color.setHex(flashOn ? 0x1133aa : 0x2266ff);
      const d = dist2(m.position.x, m.position.z, pp.x, pp.z);
      const targetHeading = Math.atan2(pp.x - m.position.x, pp.z - m.position.z);
      let dh = targetHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += clamp(dh, -1.9 * dt, 1.9 * dt);
      m.rotation.y = c.heading - Math.PI / 2;
      const topSpeed = 26 + wanted * 2.5;
      c.speed = d > 6 ? Math.min(topSpeed, c.speed + 14 * dt) : Math.max(0, c.speed - 20 * dt);
      const nx = m.position.x + Math.sin(c.heading) * c.speed * dt;
      const nz = m.position.z + Math.cos(c.heading) * c.speed * dt;
      const fixed = game.city.collide(nx, nz, 2.4);
      if (fixed.x !== nx || fixed.z !== nz) c.speed *= 0.4;
      m.position.x = clamp(fixed.x, -445, 445);
      m.position.z = clamp(fixed.z, -445, 445);
      const spin = (c.speed * dt) / 0.38;
      for (const w of m.userData.wheels) w.rotation.y += spin;
      if (d < 4.5) {
        if (game.player.driving) {
          game.player.driving.speed *= 0.55;
          if (Math.abs(game.player.driving.speed) > 4) game.audio.crash();
        } else {
          this.bustedTimer += dt;
          if (this.bustedTimer > 1.0) {
            game.busted();
            return;
          }
        }
      }
    }

    // Foot cops run the player down.
    for (const c of this.cops) {
      const m = c.mesh;
      if (c.down) {
        c.downTimer -= dt;
        if (c.downTimer <= 0) {
          this.scene.remove(m);
          this.cops.splice(this.cops.indexOf(c), 1);
        }
        continue;
      }
      const d = dist2(m.position.x, m.position.z, pp.x, pp.z);
      if (game.player.driving) {
        // Cops give up the foot chase against a car and despawn far away.
        if (d > 60) {
          this.scene.remove(m);
          this.cops.splice(this.cops.indexOf(c), 1);
        }
        continue;
      }
      const nx = m.position.x + ((pp.x - m.position.x) / (d || 1)) * 7.5 * dt;
      const nz = m.position.z + ((pp.z - m.position.z) / (d || 1)) * 7.5 * dt;
      const fixed = game.city.collide(nx, nz, 0.7);
      m.position.x = fixed.x;
      m.position.z = fixed.z;
      m.rotation.y = Math.atan2(pp.x - m.position.x, pp.z - m.position.z);
      c.phase += dt * 9;
      m.userData.legL.rotation.x = Math.sin(c.phase) * 0.7;
      m.userData.legR.rotation.x = -Math.sin(c.phase) * 0.7;
      if (d < 2.4) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 1.1) {
          game.busted();
          return;
        }
      }
    }
    if (this.bustedTimer > 0) this.bustedTimer = Math.max(0, this.bustedTimer - dt * 0.5);
  }
}
