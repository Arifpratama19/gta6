// SOLMAR BAY — the people: pedestrians strolling the sidewalks (and
// fleeing gunfire) and SPPD officers on foot who chase, tackle and bust.

import * as THREE from 'three';
import { WORLD } from './config.js';
import { clamp, randRange, pick } from './util.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1];
const PANTS = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x5d4037, 0x283593];
const SKINS = [0xd9a066, 0xc98a5a, 0x8d5524, 0xf1c27d, 0xe0ac69];

// A simple walker: torso, head, legs that swing. `cop` gives a navy uniform
// and a cap; `guard` gives the bank's grey uniform.
export function buildPersonMesh(kind) {
  const g = new THREE.Group();
  const shirt = kind === 'cop' ? 0x1b2a4a : kind === 'guard' ? 0x6b7280 : pick(Math.random, SHIRTS);
  const pants = kind === 'cop' ? 0x141c2e : pick(Math.random, PANTS);
  const skin = pick(Math.random, SKINS);
  const shirtM = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsM = new THREE.MeshLambertMaterial({ color: pants });
  const skinM = new THREE.MeshLambertMaterial({ color: skin });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.32), shirtM);
  torso.position.y = 1.06; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skinM);
  head.position.y = 1.6;
  g.add(head);
  if (kind === 'cop') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.38), new THREE.MeshLambertMaterial({ color: 0x0d1526 }));
    cap.position.y = 1.82;
    g.add(cap);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    badge.position.set(-0.14, 1.22, 0.17);
    g.add(badge);
  } else {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.38), new THREE.MeshLambertMaterial({ color: pick(Math.random, [0x2a1a12, 0x111111, 0x6b4423, 0x888888]) }));
    hair.position.y = 1.8;
    g.add(hair);
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pantsM);
  legL.position.set(-0.15, 0.36, 0);
  const legR = legL.clone(); legR.position.x = 0.15;
  g.add(legL, legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), shirtM);
  armL.position.set(-0.38, 1.08, 0);
  const armR = armL.clone(); armR.position.x = 0.38;
  g.add(armL, armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Pedestrian {
  constructor(scene, city, x, z) {
    this.mesh = buildPersonMesh('ped');
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = Math.random() * Math.PI * 2;
    this.speed = randRange(Math.random, 1.2, 2.4);
    this.phase = Math.random() * 6;
    this.fleeing = 0;
    this.car = null;      // the traffic car this ped is driving, if any
    this.city = city;
    this.scene = scene;
    this.updateMesh(0);
  }

  update(dt, playerPos, gunfireAt) {
    // Flee from the player when shots ring out nearby.
    if (gunfireAt && this.pos.distanceTo(gunfireAt) < 26) this.fleeing = 4;
    if (playerPos && this.pos.distanceTo(playerPos) < 4 && this.fleeing <= 0) this.fleeing = 2;
    this.fleeing = Math.max(0, this.fleeing - dt);
    let speed = this.speed;
    if (this.fleeing > 0) {
      speed = 5.5;
      const away = Math.atan2(this.pos.x - playerPos.x, this.pos.z - playerPos.z);
      let d = away - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, dt * 5);
    } else if (Math.random() < dt * 0.12) {
      this.heading += randRange(Math.random, -1.2, 1.2);
    }
    this.pos.x += Math.sin(this.heading) * speed * dt;
    this.pos.z += Math.cos(this.heading) * speed * dt;
    this.pos.x = clamp(this.pos.x, -WORLD.cityHalf, WORLD.cityHalf);
    this.pos.z = clamp(this.pos.z, -WORLD.cityHalf, WORLD.oceanZ - 6);
    const probe = { x: this.pos.x, z: this.pos.z };
    this.city.collideCircle(probe, 0.5);
    this.pos.x = probe.x; this.pos.z = probe.z;
    this.updateMesh(dt, speed);
  }

  updateMesh(dt, speed = 0) {
    this.phase += dt * (2 + speed * 2.2);
    const swing = speed > 0.1 ? Math.sin(this.phase) * 0.5 : 0;
    const u = this.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7;
    u.armR.rotation.x = swing * 0.7;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }

  remove() { this.scene.remove(this.mesh); }
}

export class Crowd {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.peds = [];
    for (let i = 0; i < 34; i++) {
      const p = city.randomRoadPoint(Math.random);
      // Nudge pedestrians onto the sidewalk beside the road.
      const ped = new Pedestrian(scene, city, p.x + randRange(Math.random, -8, 8), p.z + randRange(Math.random, -8, 8));
      this.peds.push(ped);
    }
  }

  update(dt, playerPos, gunfireAt) {
    for (const ped of this.peds) ped.update(dt, playerPos, gunfireAt);
    // Keep the crowd topped up near the player.
    if (this.peds.length < 30 && Math.random() < dt * 0.5) {
      const a = Math.random() * Math.PI * 2;
      const x = playerPos.x + Math.cos(a) * randRange(Math.random, 40, 70);
      const z = playerPos.z + Math.sin(a) * randRange(Math.random, 40, 70);
      this.peds.push(new Pedestrian(this.scene, this.city, clamp(x, -230, 230), clamp(z, -230, 230)));
    }
  }

  // A pedestrian close enough to punch.
  nearest(x, z, maxDist) {
    let best = null, bestD = maxDist;
    for (const ped of this.peds) {
      const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
      if (d < bestD) { bestD = d; best = ped; }
    }
    return best;
  }

  remove(ped) {
    const i = this.peds.indexOf(ped);
    if (i >= 0) this.peds.splice(i, 1);
    ped.remove();
  }
}

// ----------------------------------------------------------------- police ---

// An officer on foot: runs at the player, and holds them to bust them.
export class Cop {
  constructor(scene, x, z) {
    this.mesh = buildPersonMesh('cop');
    this.isCop = true;
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = 0;
    this.phase = 0;
    this.scene = scene;
    this.bustProgress = 0;
    this.speed = 7.2;
  }

  update(dt, playerPos, playerInCar) {
    const d = Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
    const dir = Math.atan2(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
    let dd = dir - this.heading;
    while (dd > Math.PI) dd -= Math.PI * 2;
    while (dd < -Math.PI) dd += Math.PI * 2;
    this.heading += dd * Math.min(1, dt * 6);
    if (!playerInCar && d > 1.2) {
      this.pos.x += Math.sin(this.heading) * this.speed * dt;
      this.pos.z += Math.cos(this.heading) * this.speed * dt;
    }
    this.phase += dt * 11;
    const swing = Math.sin(this.phase) * 0.6;
    const u = this.mesh.userData;
    u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8; u.armR.rotation.x = swing * 0.8;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    // Busted: standing on the player for long enough.
    if (!playerInCar && d < 2.4) this.bustProgress += dt;
    else this.bustProgress = Math.max(0, this.bustProgress - dt * 2);
    return this.bustProgress;
  }

  remove() { this.scene.remove(this.mesh); }
}
