// SOLMAR BAY — combat: Lucia's pistol, tracer fire, muzzle flash, armed
// bank guards who shoot back, and the health / armor / cash pickups scattered
// around the city.

import * as THREE from 'three';
import { randRange, clamp } from './util.js';
import { buildPersonMesh } from './people.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];      // { line, life }
    this.flashes = [];      // { light, life }
    this.sparks = [];       // { mesh, vel, life }
    this.guards = [];       // armed bank guards
    this.pickups = [];      // { mesh, kind, pos, bob }
    this.gunfireAt = null;  // last shot position (pedestrians flee it)
    this.gunfireTimer = 0;
    this.shootCooldown = 0;
    this.spawnPickups();
  }

  spawnPickups() {
    const spots = [
      { kind: 'health', x: 60, z: 60 }, { kind: 'health', x: -120, z: 200 },
      { kind: 'armor', x: -60, z: -120 }, { kind: 'armor', x: 180, z: -60 },
      { kind: 'cash', x: 120, z: 120 }, { kind: 'cash', x: -180, z: 60 },
      { kind: 'cash', x: 40, z: -180 }, { kind: 'health', x: -40, z: 240 },
    ];
    for (const s of spots) this.addPickup(s.kind, s.x, s.z);
  }

  addPickup(kind, x, z) {
    const color = kind === 'health' ? 0x37e08b : kind === 'armor' ? 0x4db2ff : 0xffd23e;
    const mesh = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshLambertMaterial({ color }),
    );
    box.rotation.y = Math.PI / 4;
    mesh.add(box);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.06, 8, 24),
      new THREE.MeshBasicMaterial({ color }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.4;
    mesh.add(ring);
    mesh.position.set(x, 0.9, z);
    this.scene.add(mesh);
    this.pickups.push({ mesh, kind, pos: new THREE.Vector3(x, 0, z), bob: Math.random() * 6 });
  }

  // A shot from `from` along `dir`: hits the nearest ped / guard / cop in a
  // cone, or sparks off a building. Returns what it hit, if anything.
  shoot(from, dir, targets) {
    if (this.shootCooldown > 0) return null;
    this.shootCooldown = 0.22;
    this.gunfireAt = from.clone();
    this.gunfireTimer = 3;
    const range = 60;
    const end = from.clone().add(dir.clone().multiplyScalar(range));
    let hit = null;
    let bestT = range;
    for (const t of targets) {
      if (!t.pos) continue;
      const to = t.pos.clone(); to.y = 1.2;
      const rel = to.clone().sub(from);
      const along = rel.dot(dir);
      if (along < 0 || along > range) continue;
      const perp = rel.clone().addScaledVector(dir, -along).length();
      if (perp < 1.1 && along < bestT) { bestT = along; hit = t; }
    }
    if (hit) {
      end.copy(from).addScaledVector(dir, bestT);
      this.addSparks(end, 0xffd23e);
    } else {
      this.addSparks(end, 0xffffff);
    }
    this.addTracer(from, end);
    this.addFlash(from);
    return hit;
  }

  addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  addFlash(at) {
    const light = new THREE.PointLight(0xffc44d, 30, 9);
    light.position.copy(at);
    this.scene.add(light);
    this.flashes.push({ light, life: 0.06 });
  }

  addSparks(at, color) {
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.09, 0.09),
        new THREE.MeshBasicMaterial({ color }),
      );
      m.position.copy(at);
      this.scene.add(m);
      this.sparks.push({
        mesh: m,
        vel: new THREE.Vector3(randRange(Math.random, -3, 3), randRange(Math.random, 1, 4), randRange(Math.random, -3, 3)),
        life: 0.4,
      });
    }
  }

  // Bank guards: they spawn at the bank during mission 5, hold position and
  // shoot at the player with poor aim. They drop a cash pickup when down.
  spawnGuards(count, cx, cz) {
    for (let i = 0; i < count; i++) {
      const mesh = buildPersonMesh('guard');
      const x = cx + randRange(Math.random, -12, 12);
      const z = cz + randRange(Math.random, -12, 12);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.guards.push({
        mesh, pos: new THREE.Vector3(x, 0, z), health: 3,
        shootTimer: randRange(Math.random, 0.5, 1.5), heading: 0, phase: 0,
      });
    }
  }

  clearGuards() {
    for (const g of this.guards) this.scene.remove(g.mesh);
    this.guards = [];
  }

  // Guards fire at the player; returns true when a shot lands.
  updateGuards(dt, playerPos, onShot) {
    let hitPlayer = false;
    for (const g of this.guards) {
      const d = g.pos.distanceTo(playerPos);
      g.shootTimer -= dt;
      const dir = Math.atan2(playerPos.x - g.pos.x, playerPos.z - g.pos.z);
      let dd = dir - g.heading;
      while (dd > Math.PI) dd -= Math.PI * 2;
      while (dd < -Math.PI) dd += Math.PI * 2;
      g.heading += dd * Math.min(1, dt * 4);
      g.mesh.rotation.y = g.heading;
      g.phase += dt * 8;
      const u = g.mesh.userData;
      u.legL.rotation.x = Math.sin(g.phase) * 0.2;
      u.legR.rotation.x = -Math.sin(g.phase) * 0.2;
      if (d < 42 && g.shootTimer <= 0) {
        g.shootTimer = randRange(Math.random, 0.9, 1.7);
        const from = g.pos.clone(); from.y = 1.3;
        const aim = playerPos.clone(); aim.y = 1.2;
        // Guards are bad shots: the aim wanders.
        aim.x += randRange(Math.random, -2.5, 2.5);
        aim.z += randRange(Math.random, -2.5, 2.5);
        const dirV = aim.clone().sub(from).normalize();
        this.addTracer(from, from.clone().addScaledVector(dirV, 40));
        this.addFlash(from);
        onShot();
        if (Math.random() < 0.3) hitPlayer = true;
      }
    }
    return hitPlayer;
  }

  // A guard takes a bullet. Returns 'down' when it falls.
  damageGuard(guard, amount) {
    guard.health -= amount;
    if (guard.health <= 0) {
      const i = this.guards.indexOf(guard);
      if (i >= 0) this.guards.splice(i, 1);
      this.addSparks(guard.pos.clone().setY(1.2), 0xff5d5d);
      this.scene.remove(guard.mesh);
      this.addPickup('cash', guard.pos.x + randRange(Math.random, -2, 2), guard.pos.z + randRange(Math.random, -2, 2));
      return 'down';
    }
    return 'hit';
  }

  update(dt, playerPos, player) {
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.gunfireTimer = Math.max(0, this.gunfireTimer - dt);
    if (this.gunfireTimer <= 0) this.gunfireAt = null;
    for (const t of this.tracers) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09);
      if (t.life <= 0) { this.scene.remove(t.line); }
    }
    this.tracers = this.tracers.filter((t) => t.life > 0);
    for (const f of this.flashes) {
      f.life -= dt;
      if (f.life <= 0) this.scene.remove(f.light);
    }
    this.flashes = this.flashes.filter((f) => f.life > 0);
    for (const s of this.sparks) {
      s.life -= dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.vel.y -= 12 * dt;
      if (s.life <= 0) this.scene.remove(s.mesh);
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    // Pickups bob, spin, and get collected.
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.bob += dt;
      p.mesh.position.y = 0.9 + Math.sin(p.bob * 2.5) * 0.18;
      p.mesh.rotation.y += dt * 1.6;
      if (playerPos.distanceTo(p.pos) < 2.2) {
        if (p.kind === 'health') player.heal(40);
        if (p.kind === 'armor') player.armor = Math.min(100, player.armor + 50);
        if (p.kind === 'cash') player.addCash(150);
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  // Every shootable thing the player's bullets can hit right now.
  targets(crowd, police) {
    return [
      ...crowd.peds,
      ...this.guards,
      ...police.cops,
    ];
  }
}
