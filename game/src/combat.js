// SOLMAR BAY — combat: the pistol, tracers, muzzle flashes and damage.
// One job: shooting and getting shot, and the wanted heat it causes.

import * as THREE from 'three';

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.cooldown = 0;
    this.fireRate = 0.22; // seconds between shots
    this.range = 60;
    this.damage = 34;
  }

  get ready() { return this.cooldown <= 0; }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / t.maxLife);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  // Hitscan shot from `origin` along `dir`. Returns the first thing hit, if any.
  // targets: [{ pos: Vector3, radius, kind: 'police'|'ped'|'car', ref }]
  shoot(origin, dir, targets) {
    if (!this.ready) return null;
    this.cooldown = this.fireRate;
    let best = null;
    let bestT = this.range;
    for (const t of targets) {
      const to = new THREE.Vector3().subVectors(t.pos, origin);
      const along = to.dot(dir);
      if (along < 0.5 || along > this.range) continue;
      const closest = new THREE.Vector3().copy(origin).addScaledVector(dir, along);
      const d = closest.distanceTo(t.pos);
      if (d < (t.radius || 1.2) && along < bestT) { bestT = along; best = t; }
    }
    const end = new THREE.Vector3().copy(origin).addScaledVector(dir, bestT);
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe66d, transparent: true, opacity: 0.95 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.12, maxLife: 0.12 });
    // Muzzle flash.
    const flash = new THREE.PointLight(0xffc300, 30, 9);
    flash.position.copy(origin);
    this.scene.add(flash);
    setTimeout(() => this.scene.remove(flash), 60);
    if (best) {
      const spark = new THREE.PointLight(0xff5533, 20, 6);
      spark.position.copy(end);
      this.scene.add(spark);
      setTimeout(() => this.scene.remove(spark), 90);
    }
    return best;
  }

  // A police cruiser ramming the player's car dents health a little.
  static ramDamage(speed) { return Math.min(14, 3 + speed * 0.22); }
}

// Wanted heat: stars rise when crimes are seen, decay when the player hides.
export class WantedSystem {
  constructor() {
    this.stars = 0;
    this.heat = 0; // 0..5 continuous, stars = floor
    this.lastCrimeAt = -100;
  }

  addCrime(amount, time) {
    this.heat = Math.min(5, this.heat + amount);
    this.stars = Math.floor(this.heat + 0.0001);
    this.lastCrimeAt = time;
  }

  // Police can only keep the heat up while a cruiser is close.
  update(dt, time, nearestCopDistance) {
    if (nearestCopDistance === Infinity || nearestCopDistance > 60) {
      this.heat = Math.max(0, this.heat - dt * 0.055);
      const s = Math.floor(this.heat + 0.0001);
      if (s < this.stars) this.stars = s;
    } else if (this.stars > 0 && time - this.lastCrimeAt > 12) {
      this.heat = Math.max(this.stars - 0.5, this.heat - dt * 0.02);
    }
  }

  clear() { this.stars = 0; this.heat = 0; }
}
