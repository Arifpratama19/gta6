// Combat: the player's pistol, muzzle flash and tracers, and the rival
// shooters the missions send after Rico. Hits are resolved against simple
// spheres around each target so combat stays fast and readable.

import * as THREE from 'three';
import { dist2, rand } from './util.js';

function makeEnemyMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x7f1d1d });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.82, 0.36), jacket);
  torso.position.y = 1.14;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
  head.position.y = 1.76;
  g.add(head);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 12), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  band.position.y = 1.9;
  g.add(band);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.74, 0.26), pants);
  legL.position.set(-0.17, 0.37, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
  gun.position.set(0.3, 1.25, 0.4);
  g.add(gun);
  g.userData = { legL, legR };
  return g;
}

export class Combat {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.enemies = [];
    this.tracers = [];
    this.flash = new THREE.PointLight(0xffc866, 0, 18);
    this.scene.add(this.flash);
    this.flashTimer = 0;
    this.fireCooldown = 0;
    this.crosshairHit = false;
  }

  spawnEnemy(x, z) {
    const mesh = makeEnemyMesh();
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const e = {
      mesh,
      hp: 100,
      shootTimer: rand(0.5, 1.4),
      strafeDir: Math.random() < 0.5 ? 1 : -1,
      strafeTimer: 0,
      phase: rand(0, 6),
    };
    this.enemies.push(e);
    return e;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  enemyCount() {
    return this.enemies.length;
  }

  // Fire one shot along `dir` from `origin`. Returns the thing hit, if any.
  shoot(origin, dir) {
    if (this.fireCooldown > 0) return null;
    this.fireCooldown = 0.13;
    this.game.audio.shot();
    this.flash.position.copy(origin);
    this.flash.intensity = 60;
    this.flashTimer = 0.06;

    const end = origin.clone().addScaledVector(dir, 120);
    let bestT = 120;
    let hitKind = null;
    let hitObj = null;

    const testSphere = (cx, cy, cz, r, kind, obj) => {
      const ox = origin.x - cx;
      const oy = origin.y - cy;
      const oz = origin.z - cz;
      const b = ox * dir.x + oy * dir.y + oz * dir.z;
      const c = ox * ox + oy * oy + oz * oz - r * r;
      const disc = b * b - c;
      if (disc < 0) return;
      const t = -b - Math.sqrt(disc);
      if (t > 0 && t < bestT) {
        bestT = t;
        hitKind = kind;
        hitObj = obj;
      }
    };

    for (const e of this.enemies) {
      const p = e.mesh.position;
      testSphere(p.x, p.y + 1.2, p.z, 1.1, 'enemy', e);
    }
    for (const p of this.game.peds.peds) {
      if (p.down) continue;
      testSphere(p.mesh.position.x, p.mesh.position.y + 1.1, p.mesh.position.z, 1.0, 'ped', p);
    }
    for (const c of this.game.police.cops) {
      const p = c.mesh.position;
      testSphere(p.x, p.y + 1.1, p.z, 1.0, 'cop', c);
    }
    for (const c of this.game.traffic.cars) {
      const p = c.mesh.position;
      testSphere(p.x, p.y + 0.9, p.z, 2.2, 'car', c);
    }

    end.copy(origin).addScaledVector(dir, Math.min(bestT, 120));
    this.spawnTracer(origin, end);

    if (hitKind === 'enemy') {
      hitObj.hp -= 34;
      this.game.audio.hit();
      if (hitObj.hp <= 0) this.killEnemy(hitObj);
    } else if (hitKind === 'ped') {
      hitObj.down = true;
      hitObj.downTimer = 25;
      hitObj.mesh.rotation.x = -Math.PI / 2;
      hitObj.mesh.position.y = 0.35;
      this.game.addHeat(1);
      this.game.hud.message('A bystander is down — the police were called!');
      this.game.peds.scare(hitObj.mesh.position.x, hitObj.mesh.position.z, 60);
    } else if (hitKind === 'cop') {
      this.game.addHeat(1);
      this.game.police.hurtCop(hitObj);
    } else if (hitKind === 'car') {
      this.game.audio.hit();
    }
    this.crosshairHit = hitKind !== null;
    return hitKind;
  }

  killEnemy(e) {
    const i = this.enemies.indexOf(e);
    if (i < 0) return;
    this.enemies.splice(i, 1);
    e.mesh.rotation.x = -Math.PI / 2;
    e.mesh.position.y = 0.35;
    // The body stays for a while, then is cleared with the mission.
    e.dead = true;
    e.deadTimer = 12;
    this.enemiesDead = this.enemiesDead || [];
    this.enemiesDead.push(e);
    this.game.missions.onEnemyKilled();
    this.game.hud.message('Rival down!');
  }

  spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  update(dt) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.intensity = 0;
    }
    for (const t of this.tracers) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.95;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
      }
    }
    this.tracers = this.tracers.filter((t) => t.life > 0);

    const dead = this.enemiesDead || [];
    for (const e of dead) {
      e.deadTimer -= dt;
      if (e.deadTimer <= 0) {
        this.scene.remove(e.mesh);
        dead.splice(dead.indexOf(e), 1);
      }
    }

    // Enemies strafe and shoot back at the player.
    const pp = this.game.player.pos;
    for (const e of this.enemies) {
      const m = e.mesh;
      const d = dist2(m.position.x, m.position.z, pp.x, pp.z);
      e.strafeTimer -= dt;
      if (e.strafeTimer <= 0) {
        e.strafeTimer = rand(0.8, 1.8);
        e.strafeDir *= -1;
      }
      // Keep a fighting distance of ~14 m.
      let mx = 0;
      let mz = 0;
      if (d > 18) {
        mx = (pp.x - m.position.x) / d;
        mz = (pp.z - m.position.z) / d;
      } else if (d < 9) {
        mx = (m.position.x - pp.x) / d;
        mz = (m.position.z - pp.z) / d;
      }
      const px = -mz * e.strafeDir;
      const pz = mx * e.strafeDir;
      const nx = m.position.x + (mx + px * 0.7) * 3.2 * dt;
      const nz = m.position.z + (mz + pz * 0.7) * 3.2 * dt;
      const fixed = this.game.city.collide(nx, nz, 0.7);
      m.position.x = fixed.x;
      m.position.z = fixed.z;
      m.rotation.y = Math.atan2(pp.x - m.position.x, pp.z - m.position.z);
      e.phase += dt * 6;
      m.userData.legL.rotation.x = Math.sin(e.phase) * 0.5;
      m.userData.legR.rotation.x = -Math.sin(e.phase) * 0.5;

      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 46) {
        e.shootTimer = rand(0.9, 1.7);
        this.game.audio.enemyShot();
        const from = new THREE.Vector3(m.position.x, m.position.y + 1.4, m.position.z);
        const to = new THREE.Vector3(pp.x + rand(-1.5, 1.5), pp.y + 1.2, pp.z + rand(-1.5, 1.5));
        this.spawnTracer(from, to);
        // Hit chance falls with distance.
        if (Math.random() < Math.max(0.12, 0.55 - d * 0.011)) {
          this.game.damagePlayer(rand(5, 11));
        }
      }
    }
  }
}
