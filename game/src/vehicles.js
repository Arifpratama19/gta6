// SOLMAR BAY — cars: the factory, traffic that follows the road grid,
// and Solmar PD cruisers that chase the player.
// One job: everything with four wheels.

import * as THREE from 'three';
import { WORLD, CAR, PALETTE } from './config.js';

function pick(arr, rand) { return arr[Math.floor(rand() * arr.length)]; }

export function buildCarMesh(color, isPolice = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x182233, roughness: 0.15, metalness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 2.2), glass);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 0.7), paint);
  nose.position.set(0, 0.5, 2.3);
  group.add(nose);
  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), headMat);
    h.position.set(sx, 0.55, 2.66);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2e2e }));
    t.position.set(sx, 0.55, -2.26);
    group.add(t);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.48, -0.25);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.28, 1.62, -0.25);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.28, 1.62, -0.25);
    group.add(blue);
    group.userData.lightRed = red;
    group.userData.lightBlue = blue;
  }
  group.userData.wheels = wheels;
  return group;
}

// Arcade car: position, heading, forward speed, steering.
export class Car {
  constructor(mesh, x, z, heading) {
    this.mesh = mesh;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steerAngle = 0;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = heading;
  }

  // throttle -1..1, steer -1..1, handbrake bool.
  drive(dt, throttle, steer, handbrake) {
    const grip = handbrake ? CAR.handbrakeGrip : CAR.grip;
    const targetSteer = steer * CAR.steer * (this.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(this.speed) / 8 + 0.25);
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, dt * 8);
    if (throttle > 0) this.speed += CAR.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= CAR.brake * dt;
      else this.speed += CAR.reverse * throttle * dt;
    }
    if (handbrake) this.speed *= Math.max(0, 1 - dt * 2.2);
    this.speed -= this.speed * 0.55 * dt; // rolling drag
    this.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, this.speed));
    this.heading += this.steerAngle * (this.speed / CAR.maxSpeed) * dt * 2.1;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;
    // Body roll and wheel spin for feel.
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.z = -this.steerAngle * 0.06 * Math.min(1, Math.abs(this.speed) / 10);
    const spin = (this.speed * dt) / 0.38;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    const frontL = this.mesh.userData.wheels[0];
    const frontR = this.mesh.userData.wheels[1];
    if (frontL) { frontL.rotation.y = this.steerAngle * 0.45; frontR.rotation.y = this.steerAngle * 0.45; }
  }

  stop() { this.speed = 0; }
}

// Where the roads run: every grid line, in both directions.
function roadLines() {
  const pitch = WORLD.block + WORLD.road;
  const half = WORLD.half;
  const lines = [];
  for (let i = 0; i <= WORLD.blocks; i++) lines.push(-half + WORLD.road / 2 + i * pitch);
  return lines;
}

export class TrafficSystem {
  constructor(scene, city, rand) {
    this.scene = scene;
    this.city = city;
    this.rand = rand;
    this.cars = [];
    this.lines = roadLines();
  }

  spawnCar(x, z, heading, isPolice = false) {
    const color = isPolice ? 0xf2f2f2 : pick(PALETTE.carPaint, this.rand);
    const mesh = buildCarMesh(color, isPolice);
    this.scene.add(mesh);
    const car = new Car(mesh, x, z, heading);
    car.isPolice = isPolice;
    car.isTraffic = !isPolice;
    car.laneOffset = (this.rand() - 0.5) * 5;
    car.targetSpeed = 9 + this.rand() * 6;
    car.waitAtJunction = 0;
    return car;
  }

  // Seed the streets with traffic driving the grid.
  populate(count) {
    for (let i = 0; i < count; i++) {
      const line = pick(this.lines, this.rand);
      const along = (this.rand() * 2 - 1) * (WORLD.half - 10);
      const horizontal = this.rand() < 0.5;
      const heading = horizontal ? (this.rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (this.rand() < 0.5 ? 0 : Math.PI);
      const car = this.spawnCar(horizontal ? along : line, horizontal ? line : along, heading);
      car.speed = car.targetSpeed;
      this.cars.push(car);
    }
  }

  // Traffic follows its road; at a junction it sometimes turns.
  update(dt, playerPos) {
    const pitch = WORLD.block + WORLD.road;
    for (const car of this.cars) {
      if (car.isPolice || car.isRival) continue; // police and rivals steer themselves
      const heading = car.heading;
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      // Are we near a junction? Snap a turn onto a crossing road.
      const nearX = this.nearestLine(car.pos.x);
      const nearZ = this.nearestLine(car.pos.z);
      const onJunction = Math.abs(car.pos.x - nearX) < 4 && Math.abs(car.pos.z - nearZ) < 4;
      if (onJunction && this.rand() < dt * 0.55) {
        const turn = this.rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        car.heading += turn;
        car.pos.x = nearX;
        car.pos.z = nearZ;
      }
      // Ease back to the centre of the current road.
      const movingX = Math.abs(fx) > 0.5;
      const targetLine = movingX ? this.nearestLine(car.pos.z) : this.nearestLine(car.pos.x);
      const lateral = movingX ? car.pos.z - targetLine : car.pos.x - targetLine;
      const correction = -Math.sign(lateral) * Math.min(Math.abs(lateral), 1) * dt * 2;
      if (movingX) car.pos.z += correction; else car.pos.x += correction;
      // Slow down for the car ahead (cheap: only the player and the car in front).
      let desired = car.targetSpeed;
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.pos.x - car.pos.x;
        const dz = other.pos.z - car.pos.z;
        const ahead = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (ahead > 0 && ahead < 9 && side < 2.4) { desired = 0; break; }
      }
      const pdx = playerPos.x - car.pos.x;
      const pdz = playerPos.z - car.pos.z;
      const pAhead = pdx * fx + pdz * fz;
      const pSide = Math.abs(pdx * fz - pdz * fx);
      if (pAhead > 0 && pAhead < 8 && pSide < 2.4) desired = 0;
      car.speed += (desired - car.speed) * Math.min(1, dt * 1.5);
      car.pos.x += fx * car.speed * dt;
      car.pos.z += fz * car.speed * dt;
      // Wrap around the city edge instead of driving into the sea.
      if (car.pos.x > WORLD.half + 4) car.pos.x = -WORLD.half - 2;
      if (car.pos.x < -WORLD.half - 4) car.pos.x = WORLD.half + 2;
      if (car.pos.z > WORLD.half + 4) car.pos.z = -WORLD.half - 2;
      if (car.pos.z < -WORLD.half - 4) car.pos.z = WORLD.half + 2;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
      const spin = (car.speed * dt) / 0.38;
      for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    }
  }

  nearestLine(v) {
    let best = this.lines[0];
    for (const l of this.lines) if (Math.abs(l - v) < Math.abs(best - v)) best = l;
    return best;
  }

  // The nearest parked / traffic car the player can steal.
  nearestStealable(x, z, maxDist = 6) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      if (car.isPolice || car.isRival) continue;
      const d = Math.hypot(car.pos.x - x, car.pos.z - z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }
}

// Solmar PD: cruisers spawn at the city edge and ram the player's car.
export class PoliceSystem {
  constructor(scene, traffic, rand) {
    this.scene = scene;
    this.traffic = traffic;
    this.rand = rand;
    this.cruisers = [];
    this.flashTime = 0;
  }

  wantedCount(stars) {
    return [0, 1, 2, 3, 4, 6][Math.max(0, Math.min(5, stars))];
  }

  update(dt, playerPos, playerSpeed, stars, time) {
    const want = this.wantedCount(stars);
    while (this.cruisers.length < want) {
      const angle = this.rand() * Math.PI * 2;
      const r = 70 + this.rand() * 30;
      const x = playerPos.x + Math.sin(angle) * r;
      const z = playerPos.z + Math.cos(angle) * r;
      const [cx, cz] = [Math.max(-WORLD.half, Math.min(WORLD.half, x)), Math.max(-WORLD.half, Math.min(WORLD.half, z))];
      const cruiser = this.traffic.spawnCar(cx, cz, 0, true);
      cruiser.speed = 20;
      this.cruisers.push(cruiser);
      this.traffic.cars.push(cruiser);
    }
    while (this.cruisers.length > want) {
      const c = this.cruisers.pop();
      this.traffic.removeCar(c);
    }
    this.flashTime += dt;
    const flashOn = Math.floor(this.flashTime * 6) % 2 === 0;
    for (const c of this.cruisers) {
      // Steer toward the player, faster with more stars.
      const dx = playerPos.x - c.pos.x;
      const dz = playerPos.z - c.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 1.4));
      const topSpeed = 26 + stars * 3.5;
      const throttle = c.speed < topSpeed ? 1 : 0.15;
      c.drive(dt, throttle, steer, false);
      // Ram: shove the player when touching.
      if (dist < 4.5) {
        c.speed *= 0.92;
      }
      if (c.mesh.userData.lightRed) {
        c.mesh.userData.lightRed.material.color.setHex(flashOn ? 0xff2020 : 0x440000);
        c.mesh.userData.lightBlue.material.color.setHex(flashOn ? 0x111188 : 0x2040ff);
      }
    }
    return this.cruisers.length > 0;
  }

  // Distance of the closest cruiser — the HUD uses it for the "cops near" pulse.
  closestDistance(playerPos) {
    let best = Infinity;
    for (const c of this.cruisers) best = Math.min(best, Math.hypot(c.pos.x - playerPos.x, c.pos.z - playerPos.z));
    return best;
  }

  clearAll() {
    for (const c of [...this.cruisers]) this.traffic.removeCar(c);
    this.cruisers = [];
  }
}
