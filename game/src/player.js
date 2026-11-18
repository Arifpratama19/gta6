// The player on foot: a third-person character with orbit camera, sprint,
// jump, and car entry/exit. Driving itself lives in vehicles.js.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, damp } from './util.js';

function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x14b8a6 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1f2937 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.82, 0.36), jacket);
  torso.position.y = 1.14;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
  head.position.y = 1.76;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.1, 12), new THREE.MeshLambertMaterial({ color: 0x111827 }));
  cap.position.y = 1.94;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.26), new THREE.MeshLambertMaterial({ color: 0x111827 }));
  brim.position.set(0, 1.9, 0.3);
  g.add(brim);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.74, 0.26), pants);
  legL.position.set(-0.17, 0.37, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.68, 0.19), jacket);
  armL.position.set(-0.44, 1.12, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.44;
  g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = makePlayerMesh();
    this.mesh.position.set(0, 0, 40);
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.heading = 0;
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 12.5;
    this.walkPhase = 0;
    this.vy = 0;
    this.onGround = true;
    this.driving = null; // PlayerCar when behind the wheel
    this.aiming = false;
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }

  enterCar(car) {
    this.driving = car;
    this.mesh.visible = false;
    this.camDist = 12.5;
  }

  exitCar() {
    if (!this.driving) return;
    const car = this.driving;
    this.driving = null;
    const side = car.heading + Math.PI / 2;
    this.pos.set(
      car.pos.x + Math.sin(side) * 3.2,
      0,
      car.pos.z + Math.cos(side) * 3.2
    );
    this.heading = car.heading;
    this.camYaw = car.heading + Math.PI;
    this.mesh.visible = true;
    this.camDist = 8.5;
    return car;
  }

  update(dt, input, game) {
    if (this.driving) {
      this.driving.update(dt, input, game);
      this.pos.copy(this.driving.pos);
      this.heading = this.driving.heading;
      this.updateCamera(dt, input, game.camera, true);
      return;
    }

    const mouse = input.consumeMouse();
    this.camYaw -= mouse.dx * 0.0032;
    this.camPitch = clamp(this.camPitch + mouse.dy * 0.0026, -0.15, 0.85);
    this.aiming = input.mouseDown;

    const fwd = input.axis('KeyS', 'KeyW');
    const strafe = input.axis('KeyA', 'KeyD');
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
    const moving = fwd !== 0 || strafe !== 0;

    if (moving) {
      const sin = Math.sin(this.camYaw);
      const cos = Math.cos(this.camYaw);
      // Camera-relative movement: W walks away from the camera.
      let mx = sin * fwd + cos * strafe;
      let mz = cos * fwd - sin * strafe;
      const len = Math.hypot(mx, mz) || 1;
      mx /= len;
      mz /= len;
      const nx = this.pos.x + mx * speed * dt;
      const nz = this.pos.z + mz * speed * dt;
      const fixed = game.city.collide(nx, nz, 0.7);
      this.pos.x = clamp(fixed.x, -445, 445);
      this.pos.z = clamp(fixed.z, -445, 445);
      this.heading = damp(this.heading, Math.atan2(mx, mz), 12, dt);
      this.walkPhase += dt * speed * 1.9;
      const swing = Math.sin(this.walkPhase) * 0.6;
      this.mesh.userData.legL.rotation.x = swing;
      this.mesh.userData.legR.rotation.x = -swing;
      this.mesh.userData.armL.rotation.x = -swing * 0.7;
      this.mesh.userData.armR.rotation.x = swing * 0.7;
    } else {
      this.mesh.userData.legL.rotation.x = damp(this.mesh.userData.legL.rotation.x, 0, 10, dt);
      this.mesh.userData.legR.rotation.x = damp(this.mesh.userData.legR.rotation.x, 0, 10, dt);
      this.mesh.userData.armL.rotation.x = damp(this.mesh.userData.armL.rotation.x, this.aiming ? -1.2 : 0, 10, dt);
      this.mesh.userData.armR.rotation.x = damp(this.mesh.userData.armR.rotation.x, this.aiming ? -1.2 : 0, 10, dt);
    }

    // Jump.
    if (input.down('Space') && this.onGround) {
      this.vy = 7.5;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.vy = 0;
        this.onGround = true;
      }
    }

    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.rotation.y = this.heading;
    this.updateCamera(dt, input, game.camera, false);
    game.audio.setEngine(0, false);
  }

  updateCamera(dt, input, camera, driving) {
    if (driving) {
      // Chase camera: behind the car, easing into place, looking ahead of it.
      const back = this.heading + Math.PI;
      const tx = this.pos.x + Math.sin(back) * this.camDist;
      const tz = this.pos.z + Math.cos(back) * this.camDist;
      const ty = 5.4;
      camera.position.x = damp(camera.position.x, tx, 5, dt);
      camera.position.y = damp(camera.position.y, ty, 5, dt);
      camera.position.z = damp(camera.position.z, tz, 5, dt);
      camera.lookAt(
        this.pos.x + Math.sin(this.heading) * 7,
        1.6,
        this.pos.z + Math.cos(this.heading) * 7
      );
      return;
    }
    const cx = this.pos.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cz = this.pos.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cy = this.pos.y + 2.0 + Math.sin(this.camPitch) * this.camDist;
    // Keep the camera out of buildings: clamp to a simple height floor.
    camera.position.set(cx, Math.max(cy, 1.2), cz);
    camera.lookAt(this.pos.x, this.pos.y + 1.7, this.pos.z);
  }

  // Where a shot fired from the crosshair goes.
  aimDirection(camera) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return dir;
  }

  muzzlePosition() {
    return new THREE.Vector3(
      this.pos.x + Math.sin(this.heading) * 0.6,
      this.pos.y + 1.45,
      this.pos.z + Math.cos(this.heading) * 0.6
    );
  }
}
