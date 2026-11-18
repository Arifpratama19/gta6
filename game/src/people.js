// SOLMAR BAY — people: Dana on foot and the pedestrians filling the sidewalks.
// One job: character meshes and sidewalk walking.

import * as THREE from 'three';
import { WORLD } from './config.js';

function pick(arr, rand) { return arr[Math.floor(rand() * arr.length)]; }

const SHIRT_COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95d5b2, 0xf72585, 0x4361ee, 0xfb8500, 0x90be6d];
const SKIN_COLORS = [0xf2c89b, 0xd9a066, 0x8d5524, 0xffdbac, 0xc68642];

// A simple stylised person: head, torso, legs, arms — built from boxes.
export function buildPersonMesh(shirtColor, skinColor, scale = 1) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.9 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1d130b, roughness: 1 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.34), hairMat);
  hair.position.y = 1.84;
  group.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), pants);
  legL.position.set(-0.14, 0.5, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), shirt);
  armL.position.set(-0.34, 1.12, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.34;
  group.add(armR);
  group.userData = { legL, legR, armL, armR, torso };
  group.scale.setScalar(scale);
  return group;
}

// Dana herself: sunset jacket, dark hair in a ponytail, a pistol at her hip.
export function buildPlayerMesh() {
  const g = buildPersonMesh(0xff9f1c, 0xd9a066, 1.05);
  const ponytail = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.42, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x1d130b, roughness: 1 }));
  ponytail.position.set(0, 1.66, -0.22);
  g.add(ponytail);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.07, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.7 }));
  gun.position.set(0.32, 0.86, 0.1);
  g.add(gun);
  return g;
}

export class PedestrianSystem {
  constructor(scene, city, rand) {
    this.scene = scene;
    this.city = city;
    this.rand = rand;
    this.peds = [];
  }

  populate(count) {
    for (let i = 0; i < count; i++) {
      const mesh = buildPersonMesh(pick(SHIRT_COLORS, this.rand), pick(SKIN_COLORS, this.rand), 0.95 + this.rand() * 0.15);
      this.scene.add(mesh);
      const ped = {
        mesh,
        pos: new THREE.Vector3((this.rand() * 2 - 1) * (WORLD.half - 8), 0, (this.rand() * 2 - 1) * (WORLD.half - 8)),
        heading: this.rand() * Math.PI * 2,
        speed: 1.1 + this.rand() * 1.1,
        walkPhase: this.rand() * Math.PI * 2,
        // Pedestrians panic and run when the player fires nearby.
        panic: 0,
        state: 'walk',
      };
      mesh.position.copy(ped.pos);
      mesh.rotation.y = ped.heading;
      this.peds.push(ped);
    }
  }

  // Flee from a point (a gunshot): pedestrians within radius panic.
  scare(x, z, radius = 30) {
    for (const p of this.peds) {
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < radius) {
        p.panic = 3 + this.rand() * 2;
        p.heading = Math.atan2(p.pos.x - x, p.pos.z - z);
        p.state = 'flee';
      }
    }
  }

  update(dt, playerPos, playerInCar, time) {
    for (const p of this.peds) {
      if (p.panic > 0) {
        p.panic -= dt;
        p.speed = 5.2;
        if (p.panic <= 0) { p.state = 'walk'; p.speed = 1.1 + this.rand() * 1.1; }
      }
      // Wander: pick a new heading now and then, avoid walking through buildings.
      if (this.rand() < dt * 0.12) p.heading += (this.rand() - 0.5) * 1.6;
      const nx = p.pos.x + Math.sin(p.heading) * p.speed * dt;
      const nz = p.pos.z + Math.cos(p.heading) * p.speed * dt;
      if (!this.city.collideCircle(nx, nz, 0.6)) {
        p.pos.x = nx;
        p.pos.z = nz;
      } else {
        p.heading += Math.PI / 2;
      }
      const [cx, cz] = this.city.clampToLand(p.pos.x, p.pos.z);
      p.pos.x = cx; p.pos.z = cz;
      // Walk-cycle swing.
      p.walkPhase += dt * p.speed * 3.4;
      const swing = Math.sin(p.walkPhase) * 0.55;
      const u = p.mesh.userData;
      u.legL.rotation.x = swing;
      u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.8;
      u.armR.rotation.x = swing * 0.8;
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y = p.heading;
    }
  }

  // The nearest pedestrian to a point (for bumping / shoving).
  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.peds) {
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
}
