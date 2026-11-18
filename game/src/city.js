// SOLMAR BAY — the city itself: a 9x9 grid of blocks on a sun-soaked coast,
// with roads, sidewalks, towers, a beach, the ocean, a pier, palms, lamps and
// the landmarks the missions point at. One seeded layout, the same every load.

import * as THREE from 'three';
import { WORLD, PITCH, roadLines, COLORS } from './config.js';
import { mulberry32, randRange, buildingTexture, roadTexture, sandTexture, waterTexture, canvasTexture, clamp } from './util.js';

export class City {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(WORLD.seed);
    this.buildings = [];   // { x, z, w, d, h, mesh } — AABB collision
    this.palms = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildBeach();
    this.buildPier();
    this.buildYacht();
    this.buildProps();
    this.buildSkyline();
  }

  // ---- ground: grass base, sand strip, ocean plane -----------------------
  buildGround() {
    const rng = this.rng;
    // The grass base stops at the beach: the ground must never pave over
    // the ocean, which sits lower and would be hidden under it.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 636),
      new THREE.MeshLambertMaterial({ color: COLORS.grass }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, -82);
    ground.receiveShadow = true;
    this.group.add(ground);

    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 46),
      new THREE.MeshLambertMaterial({ map: sandTexture(THREE) }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.02, WORLD.beachZ + 8);
    sand.receiveShadow = true;
    this.group.add(sand);

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 500),
      new THREE.MeshLambertMaterial({ map: waterTexture(THREE) }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.4, WORLD.oceanZ + 240);
    this.group.add(water);

    // Distant hills to close the horizon on the north side.
    for (let i = 0; i < 7; i++) {
      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(randRange(rng, 60, 110), randRange(rng, 45, 90), 7),
        new THREE.MeshLambertMaterial({ color: 0x4d7a52 }),
      );
      hill.position.set(-420 + i * 140 + randRange(rng, -30, 30), 0, -360 - randRange(rng, 0, 60));
      this.group.add(hill);
    }
  }

  // ---- roads: dark strips with markings, plus sidewalks ------------------
  // A north-south road at x = c is a 13-wide, full-length strip; an
  // east-west road at z = c is the same strip turned 90 degrees.
  buildRoads() {
    const lines = roadLines();
    const texEW = roadTexture(THREE);
    texEW.wrapS = texEW.wrapT = THREE.RepeatWrapping;
    texEW.repeat.set(38, 1);
    const texNS = texEW.clone();
    texNS.needsUpdate = true;
    // Turn the texture 90 degrees so its dashes run along the road's length.
    texNS.center.set(0.5, 0.5);
    texNS.rotation = Math.PI / 2;
    texNS.repeat.set(38, 1);
    const roadMatEW = new THREE.MeshLambertMaterial({ map: texEW });
    const roadMatNS = new THREE.MeshLambertMaterial({ map: texNS });
    const walkMat = new THREE.MeshLambertMaterial({ color: COLORS.sidewalk });
    const len = WORLD.grid * PITCH + WORLD.roadWidth;
    for (const c of lines) {
      // North-south road (constant x).
      const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, len), roadMatNS);
      roadNS.rotation.x = -Math.PI / 2;
      roadNS.position.set(c, 0.04, 0);
      roadNS.receiveShadow = true;
      this.group.add(roadNS);
      // East-west road (constant z).
      const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(len, WORLD.roadWidth), roadMatEW);
      roadEW.rotation.x = -Math.PI / 2;
      roadEW.position.set(0, 0.04, c);
      roadEW.receiveShadow = true;
      this.group.add(roadEW);
      // Sidewalk strips flanking each road.
      const off = WORLD.roadWidth / 2 + 1.2;
      for (const side of [-1, 1]) {
        const walkNS = new THREE.Mesh(new THREE.PlaneGeometry(2.4, len), walkMat);
        walkNS.rotation.x = -Math.PI / 2;
        walkNS.position.set(c + side * off, 0.06, 0);
        this.group.add(walkNS);
        const walkEW = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.4), walkMat);
        walkEW.rotation.x = -Math.PI / 2;
        walkEW.position.set(0, 0.06, c + side * off);
        this.group.add(walkEW);
      }
    }
  }

  // ---- blocks: buildings, plazas, a park, the bank, the motel ------------
  buildBlocks() {
    const rng = this.rng;
    const half = (WORLD.grid * PITCH) / 2;
    const palette = ['#c96f4a', '#d9a441', '#7fa3b8', '#b87a8a', '#8a9a6b', '#e0cfa8', '#6b8cae', '#d98a5f'];
    let idx = 0;
    for (let bx = 0; bx < WORLD.grid; bx++) {
      for (let bz = 0; bz < WORLD.grid; bz++) {
        const cx = -half + bx * PITCH + PITCH / 2;
        const cz = -half + bz * PITCH + PITCH / 2;
        idx++;
        // The central park, the bank plaza and the motel court stay open.
        if (bx === 4 && bz === 4) { this.buildPark(cx, cz); continue; }
        if (bx === 5 && bz === 4) { this.buildBank(cx, cz); continue; }
        if (bx === 2 && bz === 6) { this.buildMotel(cx, cz); continue; }
        const n = 1 + Math.floor(rng() * 2); // 1-2 towers per block
        for (let k = 0; k < n; k++) {
          const w = randRange(rng, 14, 24);
          const d = randRange(rng, 14, 24);
          const h = randRange(rng, 10, 46) * (1 + (rng() < 0.12 ? 1.1 : 0));
          const x = cx + (k === 0 ? -7 : 8) + randRange(rng, -3, 3);
          const z = cz + randRange(rng, -6, 6);
          const tex = buildingTexture(THREE, rng, palette[idx % palette.length]);
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 22)));
          // The texture carries the colour; a white material shows it as painted.
          const mat = new THREE.MeshLambertMaterial({ map: tex });
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          mesh.position.set(x, h / 2, z);
          mesh.castShadow = true; mesh.receiveShadow = true;
          this.group.add(mesh);
          // Rooftop box so the skyline reads at a distance.
          if (rng() < 0.5) {
            const roof = new THREE.Mesh(
              new THREE.BoxGeometry(w * 0.4, 2.5, d * 0.4),
              new THREE.MeshLambertMaterial({ color: 0x5a6068 }),
            );
            roof.position.set(x, h + 1.2, z);
            this.group.add(roof);
          }
          this.buildings.push({ x, z, w, d, h, mesh });
        }
      }
    }
  }

  buildPark(cx, cz) {
    const rng = this.rng;
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.blockSize, WORLD.blockSize),
      new THREE.MeshLambertMaterial({ color: 0x5da24f }),
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(cx, 0.07, cz);
    this.group.add(lawn);
    for (let i = 0; i < 9; i++) this.addPalm(cx + randRange(rng, -18, 18), cz + randRange(rng, -18, 18));
    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(7, 20),
      new THREE.MeshLambertMaterial({ color: 0x3d9ec9 }),
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(cx + 6, 0.09, cz - 5);
    this.group.add(pond);
  }

  buildBank(cx, cz) {
    // Solmar National Bank: a white-columned landmark at the plaza centre.
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(26, 12, 20),
      new THREE.MeshLambertMaterial({ color: 0xe8e2d4 }),
    );
    base.position.set(cx, 6, cz); base.castShadow = true;
    this.group.add(base);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(11, 5, 4),
      new THREE.MeshLambertMaterial({ color: 0x2f6f4f }),
    );
    roof.position.set(cx, 14.5, cz); roof.rotation.y = Math.PI / 4;
    this.group.add(roof);
    for (let i = -2; i <= 2; i++) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.9, 10, 10),
        new THREE.MeshLambertMaterial({ color: 0xf5f0e0 }),
      );
      col.position.set(cx + i * 4.6, 5, cz + 11);
      this.group.add(col);
    }
    const sign = this.makeSign('SOLMAR NATIONAL BANK', 0xffd23e);
    sign.position.set(cx, 12.5, cz + 11.5);
    this.group.add(sign);
    this.buildings.push({ x: cx, z: cz, w: 26, d: 20, h: 12, mesh: base });
  }

  buildMotel(cx, cz) {
    // Sunset Motel: an L of low rooms around a pool.
    const rng = this.rng;
    const mat = new THREE.MeshLambertMaterial({ color: 0xe07a5f });
    for (let i = 0; i < 6; i++) {
      const room = new THREE.Mesh(new THREE.BoxGeometry(7, 4.5, 6), mat);
      room.position.set(cx - 14 + i * 5.6, 2.25, cz - 12);
      room.castShadow = true;
      this.group.add(room);
      this.buildings.push({ x: cx - 14 + i * 5.6, z: cz - 12, w: 7, d: 6, h: 4.5, mesh: room });
    }
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 9),
      new THREE.MeshLambertMaterial({ color: 0x37b6d9 }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(cx, 0.08, cz + 6);
    this.group.add(pool);
    const sign = this.makeSign('SUNSET MOTEL', 0xff5d8f);
    sign.position.set(cx, 8, cz - 12);
    this.group.add(sign);
    for (let i = 0; i < 3; i++) this.addPalm(cx + randRange(rng, -16, 16), cz + randRange(rng, 2, 14));
  }

  makeSign(text, color) {
    const tex = canvasTexture(THREE, 512, 64, (g, w, h) => {
      g.fillStyle = '#14181f'; g.fillRect(0, 0, w, h);
      g.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      g.font = 'bold 40px Trebuchet MS, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2);
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 2),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    return mesh;
  }

  // ---- beach, pier, yacht -------------------------------------------------
  buildBeach() {
    const rng = this.rng;
    for (let i = 0; i < 26; i++) {
      this.addPalm(-230 + rng() * 460, WORLD.beachZ + 4 + rng() * 22);
    }
    // Lifeguard tower and umbrellas.
    const tower = new THREE.Group();
    const legs = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4, 2.4), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    legs.position.y = 2; tower.add(legs);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2, 3), new THREE.MeshLambertMaterial({ color: 0xff5d5d }));
    cabin.position.y = 5; tower.add(cabin);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 1.6, 4), new THREE.MeshLambertMaterial({ color: 0xffd23e }));
    roof.position.y = 6.8; roof.rotation.y = Math.PI / 4; tower.add(roof);
    tower.position.set(-40, 0, WORLD.beachZ + 12);
    this.group.add(tower);
    for (let i = 0; i < 8; i++) {
      const x = -200 + i * 55 + randRange(rng, -8, 8);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6),
        new THREE.MeshLambertMaterial({ color: 0x8a6d3b }),
      );
      pole.position.set(x, 1.2, WORLD.beachZ + 14);
      const top = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 1.2, 8),
        new THREE.MeshLambertMaterial({ color: [0xff5d8f, 0x19d3c5, 0xffd23e][i % 3] }),
      );
      top.position.set(x, 2.9, WORLD.beachZ + 14);
      this.group.add(pole, top);
    }
  }

  buildPier() {
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1, 64),
      new THREE.MeshLambertMaterial({ color: 0x8a6d3b }),
    );
    deck.position.set(14, 0.6, WORLD.beachZ + 34);
    deck.castShadow = true;
    this.group.add(deck);
    for (let z = WORLD.beachZ + 8; z < WORLD.beachZ + 66; z += 8) {
      for (const x of [10, 18]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 3, 8),
          new THREE.MeshLambertMaterial({ color: 0x5d4a26 }),
        );
        post.position.set(x, -0.5, z);
        this.group.add(post);
      }
    }
    // Pier bar hut at the end, with its neon sign.
    const hut = new THREE.Mesh(
      new THREE.BoxGeometry(8, 4.5, 6),
      new THREE.MeshLambertMaterial({ color: 0x2ec4b6 }),
    );
    hut.position.set(14, 3.2, WORLD.beachZ + 58);
    hut.castShadow = true;
    this.group.add(hut);
    const sign = this.makeSign('PIER BAR', 0xff5d8f);
    sign.position.set(14, 6.4, WORLD.beachZ + 61);
    this.group.add(sign);
    this.buildings.push({ x: 14, z: WORLD.beachZ + 58, w: 8, d: 6, h: 4.5, mesh: hut });
  }

  buildYacht() {
    // "Golden Hour" at the marina, east of the pier.
    const yacht = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(8, 2.4, 22),
      new THREE.MeshLambertMaterial({ color: 0xf5f0e0 }),
    );
    hull.position.y = 0.8; yacht.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(6, 2.4, 10),
      new THREE.MeshLambertMaterial({ color: 0xd9e6f2 }),
    );
    cabin.position.set(0, 3, -3); yacht.add(cabin);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0x333333 }),
    );
    mast.position.set(0, 7, 2); yacht.add(mast);
    yacht.position.set(120, -0.2, 252);
    yacht.rotation.y = 0.4;
    this.group.add(yacht);
  }

  // ---- street props: palms, lamps, hydrants, benches ----------------------
  buildProps() {
    const rng = this.rng;
    const lines = roadLines();
    // Palms along Ocean Drive.
    for (const x of lines) {
      if (rng() < 0.7) this.addPalm(x + 9, 196 + randRange(rng, -4, 4));
      if (rng() < 0.7) this.addPalm(x - 9, 196 + randRange(rng, -4, 4));
    }
    // Street lamps at every other intersection.
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x2f3542 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    for (let i = 0; i < lines.length; i += 2) {
      for (let j = 0; j < lines.length; j += 2) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), lampMat);
        pole.position.set(lines[i] + 7.5, 3.5, lines[j] + 7.5);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
        bulb.position.set(lines[i] + 7.5, 7.1, lines[j] + 7.5);
        this.group.add(pole, bulb);
      }
    }
  }

  addPalm(x, z) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 6.5, 7),
      new THREE.MeshLambertMaterial({ color: 0x8a6d3b }),
    );
    trunk.position.set(x, 3.25, z);
    trunk.rotation.z = (Math.random() - 0.5) * 0.14;
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 2.2, 7),
      new THREE.MeshLambertMaterial({ color: 0x2f9e4f }),
    );
    leaves.position.set(x, 7, z);
    this.group.add(trunk, leaves);
    this.palms.push({ x, z });
  }

  // ---- far skyline silhouettes (never over the ocean to the south) --------
  buildSkyline() {
    const rng = this.rng;
    const mat = new THREE.MeshLambertMaterial({ color: 0x7d94b5 });
    for (let i = 0; i < 26; i++) {
      const w = randRange(rng, 18, 34);
      const h = randRange(rng, 40, 110);
      const angle = (i / 26) * Math.PI * 2;
      const r = randRange(rng, 420, 520);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r + 40;
      if (z > 120) continue; // the south side is ocean, not towers
      const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
      tower.position.set(x, h / 2 - 2, z);
      this.group.add(tower);
    }
  }

  // ---- queries ------------------------------------------------------------
  // Is (x, z) on a road surface? Traffic and spawning use this.
  isRoad(x, z) {
    const lines = roadLines();
    for (const c of lines) {
      if (Math.abs(x - c) < WORLD.roadWidth / 2 + 1) return true;
      if (Math.abs(z - c) < WORLD.roadWidth / 2 + 1) return true;
    }
    return false;
  }

  // Nearest road centre line to a coordinate, on one axis.
  nearestRoad(v) {
    const lines = roadLines();
    let best = lines[0];
    for (const c of lines) if (Math.abs(v - c) < Math.abs(v - best)) best = c;
    return best;
  }

  // Push a circle (x, z, radius) out of every building AABB. Returns true on hit.
  collideCircle(pos, radius) {
    let hit = false;
    for (const b of this.buildings) {
      const nx = clamp(pos.x, b.x - b.w / 2, b.x + b.w / 2);
      const nz = clamp(pos.z, b.z - b.d / 2, b.z + b.d / 2);
      const dx = pos.x - nx, dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        hit = true;
        const d = Math.sqrt(d2) || 0.001;
        const push = radius - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      }
    }
    return hit;
  }

  // A random point on a road, for spawning traffic and pedestrians.
  randomRoadPoint(rng) {
    const lines = roadLines();
    const horizontal = rng() < 0.5;
    const line = lines[Math.floor(rng() * lines.length)];
    const along = randRange(rng, -220, 220);
    return horizontal ? { x: along, z: line } : { x: line, z: along };
  }
}
