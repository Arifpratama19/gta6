// SOLMAR BAY — cars: the mesh builder, arcade driving physics for the
// player, and the traffic AI that cruises the road grid.

import * as THREE from 'three';
import { VEHICLES, WORLD, roadLines } from './config.js';
import { clamp, lerp, angleDiff, angleLerp, pick, randRange } from './util.js';

// Build a low-poly car from boxes: body, cabin, wheels, lights, and for the
// police a light bar. Returns a THREE.Group facing +Z... (heading 0 = north).
export function buildCarMesh(def) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: def.color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a2027 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8ef });
  const chrome = new THREE.MeshLambertMaterial({ color: 0xd7dee8 });

  const len = def.kind === 'van' ? 5.4 : def.kind === 'pickup' ? 5.0 : 4.4;
  const wid = 2.0;
  const bodyH = def.kind === 'van' ? 1.5 : 0.85;

  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, bodyH, len), paint);
  body.position.y = 0.55 + bodyH / 2 - 0.4;
  body.castShadow = true;
  g.add(body);

  if (def.kind !== 'van') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.35, 0.75, len * 0.45), glass);
    cabin.position.set(0, 1.25, -len * 0.05);
    cabin.castShadow = true;
    g.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.3, 0.12, len * 0.4), paint);
    roof.position.set(0, 1.68, -len * 0.05);
    g.add(roof);
  } else {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.1, 0.15, len * 0.9), paint);
    roof.position.set(0, 1.75, 0);
    g.add(roof);
  }
  if (def.kind === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.2, 0.4, len * 0.35), dark);
    bed.position.set(0, 1.05, len * 0.28);
    g.add(bed);
  }

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  g.userData.wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z * (len / 4.4));
    g.add(w);
    g.userData.wheels.push(w);
  }

  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const x of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.08), headMat);
    h.position.set(x, 0.75, len / 2 + 0.02);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.08), tailMat);
    t.position.set(x, 0.75, -len / 2 - 0.02);
    g.add(t);
  }
  // Taxi sign / police light bar.
  if (def.kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    sign.position.set(0, 1.95, 0);
    g.add(sign);
  }
  if (def.kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.5), chrome);
    bar.position.set(0, 1.8, -0.1);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.35, 1.95, -0.1);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
    blue.position.set(0.35, 1.95, -0.1);
    g.add(red, blue);
    g.userData.lightRed = red; g.userData.lightBlue = blue;
  }
  g.userData.def = def;
  return g;
}

export class Car {
  constructor(def, x, z, heading) {
    this.def = def;
    this.mesh = buildCarMesh(def);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;           // signed, units/second
    this.steer = 0;
    this.isPlayer = false;
    this.isPolice = def.kind === 'police';
    this.isTraffic = false;
    this.driver = null;       // a pedestrian who owns this car, if any
    this.stuck = 0;
    this.route = null;        // traffic: { axis, line, dir }
    this.updateMesh();
  }

  updateMesh() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.016 * 2.6;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }

  // Arcade driving: throttle, steering that bites harder at low speed,
  // gentle auto-brake, handbrake slide.
  drive(dt, input, city) {
    const def = this.def;
    const forward = input.forward ? 1 : 0;
    const back = input.back ? 1 : 0;
    const handbrake = input.handbrake;
    if (forward) this.speed += def.accel * dt;
    if (back) this.speed -= this.speed > 1 ? def.accel * 1.4 * dt : def.accel * 0.7 * dt;
    if (!forward && !back) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 9 * dt);
    if (handbrake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 26 * dt);
    this.speed = clamp(this.speed, -def.top * 0.45, def.top);

    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer = angleLerp(this.steer, steerTarget * 0.55, dt * 8);
    const grip = handbrake ? def.grip * 0.45 : def.grip;
    this.heading += this.steer * clamp(Math.abs(this.speed) / 14, 0, 1) * grip * dt * Math.sign(this.speed || 1);

    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const probe = { x: nx, z: nz };
    const hit = city.collideCircle(probe, 1.4);
    if (hit) {
      this.pos.x = probe.x; this.pos.z = probe.z;
      if (Math.abs(this.speed) > 12) this.crashed = true;
      this.speed *= 0.35;
    } else {
      this.pos.x = nx; this.pos.z = nz;
    }
    // Stay inside the world; the beach is drivable, the sea is not.
    this.pos.x = clamp(this.pos.x, -WORLD.cityHalf, WORLD.cityHalf);
    this.pos.z = clamp(this.pos.z, -WORLD.cityHalf, WORLD.oceanZ - 6);
    this.updateMesh();
  }
}

// ---------------------------------------------------------------- traffic --

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    this.rng = Math.random;
    const defs = VEHICLES.filter((d) => d.kind !== 'police');
    for (let i = 0; i < 26; i++) {
      const def = pick(this.rng, defs);
      const p = city.randomRoadPoint(this.rng);
      const car = new Car(def, p.x, p.z, this.rng() * Math.PI * 2);
      car.isTraffic = true;
      car.speed = randRange(this.rng, 8, 15);
      car.route = this.newRoute();
      this.cars.push(car);
      scene.add(car.mesh);
    }
  }

  // Pick a road line and a direction along it, near the car's position.
  newRoute() {
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const line = pick(Math.random, roadLines());
    return { axis, line, dir: Math.random() < 0.5 ? 1 : -1 };
  }

  // Traffic cars cruise their lane, slow for the car ahead, and pick a new
  // road at random when they reach the edge of the city.
  update(dt, playerCar, policeCars) {
    for (const car of this.cars) {
      const r = car.route;
      const targetSpeed = 12;
      // Steer back onto the lane.
      const laneOffset = r.axis === 'x' ? car.pos.z - r.line : car.pos.x - r.line;
      const desired = r.axis === 'x'
        ? (r.dir > 0 ? 0 : Math.PI)
        : (r.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      car.heading = angleLerp(car.heading, desired + clamp(-laneOffset * 0.06, -0.4, 0.4), dt * 2.2);
      // Slow down for a car stopped ahead.
      let slow = false;
      for (const other of [...this.cars, playerCar, ...policeCars]) {
        if (!other || other === car) continue;
        const dx = other.pos.x - car.pos.x, dz = other.pos.z - car.pos.z;
        const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 9 && side < 2.2) { slow = true; break; }
      }
      car.speed = lerp(car.speed, slow ? 0 : targetSpeed, dt * 1.5);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      if (Math.abs(car.pos.x) > WORLD.cityHalf - 6 || Math.abs(car.pos.z) > WORLD.cityHalf - 6) {
        car.route = this.newRoute();
        car.pos.x = clamp(car.pos.x, -220, 220);
        car.pos.z = clamp(car.pos.z, -220, 220);
      }
      car.updateMesh();
    }
  }

  // The nearest drivable car to a point (for stealing), within range.
  nearestCar(x, z, maxDist) {
    let best = null, bestD = maxDist;
    for (const car of this.cars) {
      const d = Math.hypot(car.pos.x - x, car.pos.z - z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  // Take a car out of traffic (the player just stole it): it keeps its mesh
  // and stays in the world, now driven by the player.
  steal(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    car.isTraffic = false;
    if (car.driver) { car.driver.car = null; car.driver = null; }
  }

  // Spawn a fresh traffic car somewhere on the roads, to keep the streets busy.
  respawn() {
    const defs = VEHICLES.filter((d) => d.kind !== 'police');
    const def = pick(this.rng, defs);
    const p = this.city.randomRoadPoint(this.rng);
    const car = new Car(def, p.x, p.z, this.rng() * Math.PI * 2);
    car.isTraffic = true;
    car.speed = randRange(this.rng, 8, 15);
    car.route = this.newRoute();
    this.cars.push(car);
    this.scene.add(car.mesh);
    return car;
  }
}
