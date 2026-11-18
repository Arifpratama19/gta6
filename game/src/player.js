// SOLMAR BAY — Lucia Vega on foot: a low-poly walker with a third-person
// camera that orbits on mouse drag and settles behind her as she moves.

import * as THREE from 'three';
import { PLAYER, WORLD } from './config.js';
import { clamp, angleLerp } from './util.js';

// Build Lucia: jacket, jeans, hair, a pistol in her hand when armed.
export function buildPlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0xff5d8f });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2e4a6b });
  const hair = new THREE.MeshLambertMaterial({ color: 0x2a1a12 });
  const shoe = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.12; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skin);
  head.position.y = 1.72; head.castShadow = true;
  g.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.42), hair);
  hairM.position.y = 1.94;
  g.add(hairM);
  const ponytail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), hair);
  ponytail.position.set(0, 1.7, -0.26);
  g.add(ponytail);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.26), jeans);
  legL.position.set(-0.17, 0.39, 0);
  const legR = legL.clone(); legR.position.x = 0.17;
  g.add(legL, legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), jacket);
  armL.position.set(-0.42, 1.14, 0);
  const armR = armL.clone(); armR.position.x = 0.42;
  g.add(armL, armR);
  // The pistol, held out to the side.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  gun.position.set(0.5, 0.95, 0.18);
  g.add(gun);
  g.userData = { legL, legR, armL, armR, gun, torso };
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = buildPlayerMesh();
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(14, 0, 232);   // start on the pier approach
    this.vel = new THREE.Vector3();
    this.heading = Math.PI;                      // facing the city
    this.onGround = true;
    this.health = PLAYER.maxHealth;
    this.armor = 0;
    this.cash = PLAYER.startCash;
    this.car = null;                             // the Car she is driving, or null
    this.walkPhase = 0;
    this.lastDamageAt = -99;
    this.punchCooldown = 0;
  }

  get speed2d() { return Math.hypot(this.vel.x, this.vel.z); }

  // Move on foot: WASD relative to the camera, sprint, jump, building
  // collision, and a walk-cycle swing for the limbs.
  updateOnFoot(dt, input, camYaw, city, time) {
    const sprint = input.sprint;
    const speed = sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let fx = 0, fz = 0;
    if (input.forward) { fx += Math.sin(camYaw); fz += Math.cos(camYaw); }
    if (input.back) { fx -= Math.sin(camYaw); fz -= Math.cos(camYaw); }
    if (input.left) { fx -= Math.cos(camYaw); fz += Math.sin(camYaw); }
    if (input.right) { fx += Math.cos(camYaw); fz -= Math.sin(camYaw); }
    const len = Math.hypot(fx, fz);
    if (len > 0) {
      fx /= len; fz /= len;
      this.heading = angleLerp(this.heading, Math.atan2(fx, fz), dt * 12);
      this.vel.x = fx * speed;
      this.vel.z = fz * speed;
      this.walkPhase += dt * speed * 1.6;
    } else {
      this.vel.x *= Math.max(0, 1 - dt * 10);
      this.vel.z *= Math.max(0, 1 - dt * 10);
    }
    if (input.jump && this.onGround) {
      this.vel.y = PLAYER.jumpSpeed;
      this.onGround = false;
    }
    this.vel.y -= WORLD.gravity * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vel.y = 0; this.onGround = true; }
    this.pos.x = clamp(this.pos.x, -WORLD.cityHalf, WORLD.cityHalf);
    this.pos.z = clamp(this.pos.z, -WORLD.cityHalf, WORLD.oceanZ - 4);
    const probe = { x: this.pos.x, z: this.pos.z };
    city.collideCircle(probe, PLAYER.radius);
    this.pos.x = probe.x; this.pos.z = probe.z;

    // Limb swing while moving; idle breathing when still.
    const swing = len > 0 ? Math.sin(this.walkPhase) * 0.55 : 0;
    const u = this.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
    u.torso.position.y = 1.12 + (len > 0 ? Math.abs(Math.sin(this.walkPhase)) * 0.04 : Math.sin(time * 2) * 0.015);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
  }

  // Damage with a short grace window; armor absorbs first.
  takeDamage(amount, now) {
    if (now - this.lastDamageAt < 0.25) return false;
    this.lastDamageAt = now;
    let left = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, left);
      this.armor -= absorbed; left -= absorbed;
    }
    this.health = Math.max(0, this.health - left);
    return true;
  }

  heal(amount) { this.health = Math.min(PLAYER.maxHealth, this.health + amount); }
  addCash(amount) { this.cash = Math.max(0, this.cash + amount); }

  // Where the pistol fires from, for tracers and muzzle flash.
  gunTip() {
    const tip = new THREE.Vector3(0.5, 1.0, 0.45);
    tip.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    return tip.add(this.pos);
  }
}

// ---------------------------------------------------------------- camera ----

// Third-person camera: drag to orbit, auto-settles behind the player or car,
// pulls in close when a wall would block the view.
export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI;
    this.pitch = 0.32;
    this.distance = 8.5;
    this.smoothed = new THREE.Vector3(14, 4, 224);
  }

  update(dt, target, targetHeading, moving, drag) {
    this.yaw -= drag.x * 0.005;
    this.pitch = clamp(this.pitch + drag.y * 0.004, 0.08, 1.1);
    // Settle behind the direction of travel when the player is moving.
    if (moving && Math.abs(drag.x) < 0.5) {
      let diff = targetHeading - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 1.6);
    }
    const dist = this.distance;
    const off = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch) * dist,
      Math.sin(this.pitch) * dist + 1.2,
      -Math.cos(this.yaw) * Math.cos(this.pitch) * dist,
    );
    const desired = target.clone().add(off);
    desired.y = Math.max(desired.y, 0.6);
    this.smoothed.lerp(desired, Math.min(1, dt * 7));
    this.camera.position.copy(this.smoothed);
    const look = target.clone(); look.y += 1.4;
    this.camera.lookAt(look);
  }
}
