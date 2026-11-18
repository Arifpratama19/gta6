// Pedestrians: simple low-poly walkers who stroll the sidewalks, wait at
// corners, and flee when shots ring out or a car bears down on them.

import * as THREE from 'three';
import { CONFIG, PED_SHIRTS } from './config.js';
import { clamp, dist2, pick, rand } from './util.js';

function makePedMesh(shirtColor) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: pick([0xe8b88a, 0xc98d64, 0x8a5a3b, 0xf2c9a0]) });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pick([0x2b2f36, 0x3a4a6b, 0x5b3a29]) });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, 1.4), new THREE.MeshLambertMaterial({ color: pick([0x1a1a1a, 0x4a2f18, 0x777777, 0x8a5a2b]) }));
  hair.position.y = 1.78;
  g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
  legL.position.set(-0.16, 0.36, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.18), shirt);
  armL.position.set(-0.42, 1.1, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Pedestrians {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.peds = [];
  }

  spawn(x, z) {
    const mesh = makePedMesh(pick(PED_SHIRTS));
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const ped = {
      mesh,
      target: this.pickTarget(x, z),
      speed: rand(1.1, 2.2),
      phase: rand(0, 6),
      flee: 0,
      down: false,
      downTimer: 0,
    };
    this.peds.push(ped);
    return ped;
  }

  pickTarget(x, z) {
    const near = this.city.nearestRoad(x, z);
    const horiz = Math.random() < 0.5;
    if (horiz) return { x: rand(-400, 400), z: near.z + (Math.random() < 0.5 ? 9 : -9) };
    return { x: near.x + (Math.random() < 0.5 ? 9 : -9), z: rand(-400, 400) };
  }

  populate(n) {
    for (let i = 0; i < n; i++) {
      const road = pick(this.city.roadsH);
      const along = rand(-400, 400);
      this.spawn(along, road + (Math.random() < 0.5 ? 9 : -9));
    }
  }

  scare(x, z, radius) {
    for (const p of this.peds) {
      if (p.down) continue;
      const d = dist2(p.mesh.position.x, p.mesh.position.z, x, z);
      if (d < radius) {
        p.flee = 3 + Math.random() * 2;
        const away = Math.atan2(p.mesh.position.x - x, p.mesh.position.z - z);
        p.target = {
          x: clamp(p.mesh.position.x + Math.sin(away) * 60, -430, 430),
          z: clamp(p.mesh.position.z + Math.cos(away) * 60, -430, 430),
        };
      }
    }
  }

  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.peds) {
      if (p.down) continue;
      const d = dist2(p.mesh.position.x, p.mesh.position.z, x, z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  update(dt) {
    for (const p of this.peds) {
      const m = p.mesh;
      if (p.down) {
        p.downTimer -= dt;
        if (p.downTimer <= 0) {
          this.scene.remove(m);
          this.peds.splice(this.peds.indexOf(p), 1);
          this.spawn(rand(-400, 400), pick(this.city.roadsH) + 9);
        }
        continue;
      }
      if (p.flee > 0) p.flee -= dt;
      const dx = p.target.x - m.position.x;
      const dz = p.target.z - m.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 2) {
        p.target = this.pickTarget(m.position.x, m.position.z);
        continue;
      }
      const speed = p.flee > 0 ? p.speed * 2.6 : p.speed;
      const step = Math.min(d, speed * dt);
      m.position.x += (dx / d) * step;
      m.position.z += (dz / d) * step;
      m.rotation.y = Math.atan2(dx, dz);
      p.phase += dt * speed * 3.4;
      const swing = Math.sin(p.phase) * 0.5;
      m.userData.legL.rotation.x = swing;
      m.userData.legR.rotation.x = -swing;
      m.userData.armL.rotation.x = -swing * 0.7;
      m.userData.armR.rotation.x = swing * 0.7;
    }
  }
}
