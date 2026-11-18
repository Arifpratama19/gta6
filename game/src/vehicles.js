// Vehicles: the car mesh factory, street traffic that follows the road grid,
// and the arcade driving physics for the car the player is driving.

import * as THREE from 'three';
import { CONFIG, CAR_COLORS } from './config.js';
import { clamp, damp, pick, rand, randInt } from './util.js';

export function makeCarMesh(color, kind = 'sedan') {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x10151f });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const isSport = kind === 'sport';
  const isCop = kind === 'cop';
  const bodyLen = isSport ? 4.6 : 4.3;
  const bodyWid = 2.0;
  const bodyH = 0.72;

  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyLen, bodyH, bodyWid), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(bodyLen * 0.48, 0.62, bodyWid * 0.86),
    isCop ? paint : glass
  );
  cabin.position.set(isSport ? -0.25 : -0.15, 1.24, 0);
  cabin.castShadow = true;
  group.add(cabin);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(bodyLen * 0.99, 0.1, bodyWid * 0.4), dark);
  stripe.position.set(0, 0.98, 0);
  group.add(stripe);

  // Headlights and taillights.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const z of [-0.62, 0.62]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.42), lightMat);
    hl.position.set(bodyLen / 2, 0.66, z);
    group.add(hl);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const z of [-0.62, 0.62]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.42), tailMat);
    tl.position.set(-bodyLen / 2, 0.66, z);
    group.add(tl);
  }

  if (isCop) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 1.1), dark);
    bar.position.set(-0.15, 1.62, 0);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.15, 1.62, -0.3);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(-0.15, 1.62, 0.3);
    group.add(blue);
    group.userData.copRed = red;
    group.userData.copBlue = blue;
  }

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0d10 });
  const wheels = [];
  for (const [wx, wz] of [
    [bodyLen / 2 - 0.7, -0.95], [bodyLen / 2 - 0.7, 0.95],
    [-bodyLen / 2 + 0.7, -0.95], [-bodyLen / 2 + 0.7, 0.95],
  ]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
  }
  group.userData.wheels = wheels;
  group.userData.kind = kind;
  return group;
}

// A drivable car: position, heading, speed and arcade handling.
export class PlayerCar {
  constructor(mesh) {
    this.mesh = mesh;
    this.pos = mesh.position;
    // The mesh's forward is its local +x; movement heading h satisfies
    // rotation.y = h - PI/2, so inherit h from the mesh we took over.
    this.heading = (mesh.rotation.y || 0) + Math.PI / 2;
    this.speed = 0;
    this.steer = 0;
    this.crashed = 0; // seconds of crash shake left
  }

  update(dt, input, game) {
    const cfg = CONFIG.car;
    const fwd = input.axis('KeyS', 'KeyW');
    const steerIn = input.axis('KeyA', 'KeyD');
    const handbrake = input.down('Space');
    const targetSteer = steerIn * (this.speed >= 0 ? 1 : -1);
    this.steer = damp(this.steer, targetSteer, 8, dt);

    if (fwd > 0) this.speed += cfg.accel * dt;
    else if (fwd < 0) {
      if (this.speed > 0.5) this.speed -= cfg.brake * dt;
      else this.speed -= cfg.reverseAccel * dt;
    } else {
      this.speed = damp(this.speed, 0, 1.4, dt);
    }
    if (handbrake) this.speed = damp(this.speed, 0, 6, dt);
    this.speed = clamp(this.speed, -cfg.maxReverse, cfg.maxSpeed);

    const turn = this.steer * cfg.steer * dt * clamp(Math.abs(this.speed) / 9, 0, 1);
    this.heading -= turn * Math.sign(this.speed || 1);

    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const fixed = game.city.collide(nx, nz, 2.4);
    if (fixed.x !== nx || fixed.z !== nz) {
      if (Math.abs(this.speed) > 9 && this.crashed <= 0) {
        game.audio.crash();
        game.damagePlayer(0);
        game.addHeat(0);
      }
      this.speed *= 0.35;
      this.crashed = 0.25;
    }
    this.pos.x = clamp(fixed.x, -445, 445);
    this.pos.z = clamp(fixed.z, -445, 445);
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading - Math.PI / 2;
    const lean = this.steer * clamp(this.speed / cfg.maxSpeed, -1, 1) * 0.05;
    this.mesh.rotation.z = lean;
    const spin = (this.speed * dt) / 0.38;
    for (const w of this.mesh.userData.wheels) w.rotation.y += spin;
    if (this.crashed > 0) this.crashed -= dt;
    game.audio.setEngine(Math.abs(this.speed) / cfg.maxSpeed, true);
  }
}

// Street traffic: cars cruise the road grid, turn at intersections and slow
// for the car ahead. They can be stolen.
export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    this.spawnTimer = 0;
  }

  spawnCar(x, z, road, dir) {
    const color = pick(CAR_COLORS);
    const mesh = makeCarMesh(color, Math.random() < 0.12 ? 'sport' : 'sedan');
    mesh.position.set(x, 0, z);
    const d = dir || (Math.random() < 0.5 ? 1 : -1);
    // Mesh forward is local +x: face along the direction of travel.
    mesh.rotation.y = road === 'h' ? (d > 0 ? 0 : Math.PI) : (d > 0 ? -Math.PI / 2 : Math.PI / 2);
    this.scene.add(mesh);
    const car = {
      mesh,
      road, // 'h' means it travels along a horizontal road (varying x)
      dir: d,
      speed: rand(CONFIG.traffic.minSpeed, CONFIG.traffic.maxSpeed),
      lane: Math.random() < 0.5 ? 3.4 : -3.4,
      color,
    };
    mesh.userData.roadLine = road === 'h' ? z : x;
    this.cars.push(car);
    return car;
  }

  populate(n) {
    for (let i = 0; i < n; i++) {
      const horiz = Math.random() < 0.5;
      const line = pick(horiz ? this.city.roadsH : this.city.roadsV);
      const along = rand(-380, 380);
      const x = horiz ? along : line;
      const z = horiz ? line : along;
      if (x > 375) continue;
      this.spawnCar(x, z, horiz ? 'h' : 'v');
    }
  }

  removeCar(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }

  addParked(mesh, x, z, heading) {
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const car = { mesh, road: 'parked', dir: 1, speed: 0, lane: 0, color: 0xffffff, parked: true };
    this.cars.push(car);
    return car;
  }

  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      const dx = c.mesh.position.x - x;
      const dz = c.mesh.position.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  update(dt, playerPos) {
    // Keep the streets full.
    if (this.cars.length < CONFIG.traffic.count) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 1.2;
        const horiz = Math.random() < 0.5;
        const line = pick(horiz ? this.city.roadsH : this.city.roadsV);
        const edge = Math.random() < 0.5 ? -400 : 400;
        this.spawnCar(horiz ? edge : line, horiz ? line : edge, horiz ? 'h' : 'v');
      }
    }
    for (const c of this.cars) {
      if (c.parked) continue;
      // Slow for the car ahead on the same road.
      let target = c.speed;
      for (const o of this.cars) {
        if (o === c || o.road !== c.road) continue;
        const alongC = c.road === 'h' ? c.mesh.position.x : c.mesh.position.z;
        const alongO = o.road === 'h' ? o.mesh.position.x : o.mesh.position.z;
        const lineC = c.road === 'h' ? c.mesh.position.z : c.mesh.position.x;
        const lineO = o.road === 'h' ? o.mesh.position.z : o.mesh.position.x;
        if (Math.abs(lineC - lineO) > 8) continue;
        const gap = (alongO - alongC) * c.dir;
        if (gap > 0 && gap < 13) target = Math.min(target, 2);
      }
      const p = c.mesh.position;
      if (c.road === 'h') {
        p.x += c.dir * target * dt;
        p.z = damp(p.z, c.mesh.userData.roadLine + c.lane, 2, dt);
        if (Math.abs(p.x) > 405) {
          // Turn onto a random crossing road instead of vanishing.
          const cross = pick(this.city.roadsV);
          p.x = clamp(p.x, -400, 400);
          p.z = cross + (Math.random() < 0.5 ? 3.4 : -3.4);
          c.road = 'v';
          c.mesh.userData.roadLine = cross;
          c.dir = Math.random() < 0.5 ? 1 : -1;
          c.lane = Math.random() < 0.5 ? 3.4 : -3.4;
        }
        c.mesh.rotation.y = c.dir > 0 ? 0 : Math.PI;
      } else {
        p.z += c.dir * target * dt;
        p.x = damp(p.x, c.mesh.userData.roadLine + c.lane, 2, dt);
        if (Math.abs(p.z) > 405) {
          const cross = pick(this.city.roadsH);
          p.z = clamp(p.z, -400, 400);
          p.x = cross + (Math.random() < 0.5 ? 3.4 : -3.4);
          c.road = 'h';
          c.mesh.userData.roadLine = cross;
          c.dir = Math.random() < 0.5 ? 1 : -1;
          c.lane = Math.random() < 0.5 ? 3.4 : -3.4;
        }
        c.mesh.rotation.y = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      const spin = (target * dt) / 0.38;
      for (const w of c.mesh.userData.wheels) w.rotation.y += spin;
    }
  }
}
