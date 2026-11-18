// SOLMAR BAY — the wanted system: stars rise with crimes, the SPPD answers
// with cruisers and officers, and the heat only cools when nobody can see
// you. Get busted on foot or rammed to a stop and the run is over.

import * as THREE from 'three';
import { WANTED, VEHICLES, WORLD } from './config.js';
import { clamp, angleLerp, randRange } from './util.js';
import { Car } from './vehicles.js';
import { Cop } from './people.js';

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.stars = 0;
    this.cruisers = [];     // police Cars chasing the player
    this.cops = [];         // officers on foot
    this.hiddenTimer = 0;   // seconds since any police last saw the player
    this.sirenOn = false;
    this.spawnTimer = 0;
    this.flash = 0;         // light-bar flash phase
  }

  get wanted() { return this.stars; }

  addStars(n, reason) {
    const before = this.stars;
    this.stars = clamp(this.stars + n, 0, WANTED.maxStars);
    if (this.stars > before) this.hiddenTimer = 0;
    return this.stars > before ? reason : null;
  }

  setStars(n) {
    this.stars = clamp(n, 0, WANTED.maxStars);
    this.hiddenTimer = 0;
  }

  clear() {
    this.stars = 0;
    this.hiddenTimer = 0;
    for (const c of this.cruisers) this.scene.remove(c.mesh);
    for (const c of this.cops) c.remove();
    this.cruisers = [];
    this.cops = [];
  }

  // A cop the player just shot: off the street.
  removeCop(cop) {
    const i = this.cops.indexOf(cop);
    if (i >= 0) this.cops.splice(i, 1);
    cop.remove();
  }

  // A cruiser spawns on a road a little way from the player, heading in.
  spawnCruiser(playerPos) {
    const def = VEHICLES.find((v) => v.kind === 'police');
    const angle = Math.random() * Math.PI * 2;
    const dist = randRange(Math.random, 45, 70);
    let x = playerPos.x + Math.cos(angle) * dist;
    let z = playerPos.z + Math.sin(angle) * dist;
    x = clamp(x, -220, 220); z = clamp(z, -220, 220);
    // Snap onto the nearest road so it arrives driving, not through blocks.
    if (this.city.isRoad(x, z)) {
      // already on a road: keep it
    } else if (Math.abs(x - this.city.nearestRoad(x)) < Math.abs(z - this.city.nearestRoad(z))) {
      x = this.city.nearestRoad(x);
    } else {
      z = this.city.nearestRoad(z);
    }
    const car = new Car(def, x, z, Math.atan2(playerPos.x - x, playerPos.z - z));
    car.isPolice = true;
    car.speed = 20;
    this.cruisers.push(car);
    this.scene.add(car.mesh);
    return car;
  }

  spawnCop(playerPos) {
    const angle = Math.random() * Math.PI * 2;
    const x = clamp(playerPos.x + Math.cos(angle) * randRange(Math.random, 18, 30), -230, 230);
    const z = clamp(playerPos.z + Math.sin(angle) * randRange(Math.random, 18, 30), -230, 230);
    const cop = new Cop(this.scene, x, z);
    this.cops.push(cop);
    return cop;
  }

  // One tick of the chase: keep the right number of cruisers, steer them at
  // the player, decay the heat when unseen, and report a bust.
  update(dt, player, playerCar, time) {
    this.flash += dt;
    this.sirenOn = this.stars > 0;
    const playerPos = playerCar ? playerCar.pos : player.pos;
    const wantCruisers = WANTED.policePerStar[this.stars];
    this.spawnTimer -= dt;

    // Keep the chase staffed.
    if (this.cruisers.length < wantCruisers && this.spawnTimer <= 0) {
      this.spawnCruiser(playerPos);
      this.spawnTimer = 1.2;
    }
    if (this.cruisers.length > wantCruisers) {
      const extra = this.cruisers.pop();
      this.scene.remove(extra.mesh);
    }
    // Officers on foot only join below 3 stars and when the player is on foot.
    if (this.stars >= 1 && this.stars <= 2 && !playerCar && this.cops.length < this.stars && this.spawnTimer <= 0) {
      this.spawnCop(playerPos);
      this.spawnTimer = 2;
    }
    if (this.stars === 0 || playerCar) {
      for (const c of this.cops) c.remove();
      this.cops = [];
    }

    // Cruisers chase: steer at the player, ram when close, and flash lights.
    let anySeePlayer = false;
    for (const car of this.cruisers) {
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 90) anySeePlayer = true;
      const desired = Math.atan2(dx, dz);
      car.heading = angleLerp(car.heading, desired, dt * 1.4);
      const targetSpeed = dist < 6 ? 8 : car.def.top * 0.95;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      const probe = { x: car.pos.x, z: car.pos.z };
      if (this.city.collideCircle(probe, 1.4)) {
        car.pos.x = probe.x; car.pos.z = probe.z;
        car.speed *= 0.4;
        car.heading += 0.9; // scrape along the wall and keep coming
      }
      car.pos.x = clamp(car.pos.x, -WORLD.cityHalf, WORLD.cityHalf);
      car.pos.z = clamp(car.pos.z, -WORLD.cityHalf, WORLD.oceanZ - 6);
      car.updateMesh();
      // Light bar alternates red/blue.
      const on = Math.floor(this.flash * 6) % 2 === 0;
      if (car.mesh.userData.lightRed) {
        car.mesh.userData.lightRed.material.color.setHex(on ? 0xff2020 : 0x550000);
        car.mesh.userData.lightBlue.material.color.setHex(on ? 0x000055 : 0x2050ff);
      }
      // A cruiser ramming the player's car hard is a bust risk.
      if (playerCar && dist < 2.6) {
        playerCar.speed *= 0.86;
        car.speed *= 0.7;
      }
    }

    // Officers chase on foot; a full bust hold ends the run.
    for (const cop of this.cops) {
      const progress = cop.update(dt, player.pos, !!playerCar);
      if (progress >= WANTED.bustHoldSeconds) return 'busted';
    }

    // Heat decay: unseen long enough, one star drops.
    if (this.stars > 0) {
      if (anySeePlayer) this.hiddenTimer = 0;
      else this.hiddenTimer += dt;
      const need = this.stars >= 3 ? WANTED.decaySecondsHigh : WANTED.decaySeconds;
      if (this.hiddenTimer > need) {
        this.stars--;
        this.hiddenTimer = 0;
        return 'cooled';
      }
    }
    return null;
  }
}
