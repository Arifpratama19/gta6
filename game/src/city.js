// SOLMAR BAY — the city itself: ground, roads, buildings, palms, beach and sea.
// One job: turn the grid in config.js into three.js meshes, plus the mission beacon.

import * as THREE from 'three';
import { WORLD, PALETTE } from './config.js';

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// A building facade texture: lit windows on a pastel wall, drawn once on a canvas.
function facadeTexture(baseColor, litRatio, rand) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 0, 128, 10);
  for (let y = 18; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 20) {
      const lit = rand() < litRatio;
      g.fillStyle = lit ? (rand() < 0.5 ? '#ffd97a' : '#9fe8ff') : 'rgba(20,20,40,0.55)';
      g.fillRect(x, y, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.buildings = [];   // { mesh, x, z, halfW, halfD } for collision
    this.palms = [];
    this.beacon = null;
    this.rand = seededRandom(20261118);
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildBeachAndSea();
    this.buildPalms();
    this.buildBeacon();
  }

  buildGround() {
    const size = WORLD.span + WORLD.beachDepth + WORLD.oceanDepth + 120;
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a7f70 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = (WORLD.beachDepth + WORLD.oceanDepth) / 2 - 40;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  // Dark asphalt strips with pale centre dashes, laid on the grid lines.
  buildRoads() {
    const half = WORLD.half;
    const pitch = WORLD.block + WORLD.road;
    const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.95 });
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
    const n = WORLD.blocks + 1;
    for (let i = 0; i < n; i++) {
      const c = -half + WORLD.road / 2 + i * pitch;
      for (const horizontal of [true, false]) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.span, WORLD.road), roadMat);
        road.rotation.x = -Math.PI / 2;
        road.rotation.z = horizontal ? 0 : Math.PI / 2;
        road.position.set(horizontal ? 0 : c, 0.02, horizontal ? c : 0);
        road.receiveShadow = true;
        this.scene.add(road);
        // Centre dashes.
        for (let d = -half + 8; d < half - 4; d += 12) {
          const dash = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.5), dashMat);
          dash.rotation.x = -Math.PI / 2;
          dash.rotation.z = horizontal ? 0 : Math.PI / 2;
          dash.position.set(horizontal ? d : c, 0.04, horizontal ? c : d);
          this.scene.add(dash);
        }
      }
    }
  }

  buildBlocks() {
    const rand = this.rand;
    const pitch = WORLD.block + WORLD.road;
    const half = WORLD.half;
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 });
    for (let bx = 0; bx < WORLD.blocks; bx++) {
      for (let bz = 0; bz < WORLD.blocks; bz++) {
        const cx = -half + WORLD.road + WORLD.block / 2 + bx * pitch;
        const cz = -half + WORLD.road + WORLD.block / 2 + bz * pitch;
        // Sidewalk slab for the whole block.
        const slab = new THREE.Mesh(new THREE.BoxGeometry(WORLD.block, 0.3, WORLD.block), sidewalkMat);
        slab.position.set(cx, 0.15, cz);
        slab.receiveShadow = true;
        this.scene.add(slab);
        // 1-3 towers per block, casino strip blocks get neon.
        const isCasino = cx > 120 && cz > -60 && cz < 160;
        const count = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < count; k++) {
          const w = 8 + rand() * 9;
          const d = 8 + rand() * 9;
          const h = 12 + rand() * rand() * 46;
          const ox = (rand() - 0.5) * (WORLD.block - w - 4);
          const oz = (rand() - 0.5) * (WORLD.block - d - 4);
          const color = PALETTE.building[Math.floor(rand() * PALETTE.building.length)];
          const tex = facadeTexture('#' + color.toString(16).padStart(6, '0'), 0.45, rand);
          const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
          const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          tower.position.set(cx + ox, h / 2 + 0.3, cz + oz);
          tower.castShadow = true;
          tower.receiveShadow = true;
          this.scene.add(tower);
          this.buildings.push({ mesh: tower, x: cx + ox, z: cz + oz, halfW: w / 2, halfD: d / 2, height: h });
          if (isCasino || rand() < 0.22) this.addNeonSign(cx + ox, h + 0.3, cz + oz, w);
        }
        // Low shops fill the rest of some blocks.
        if (rand() < 0.5) {
          const shop = new THREE.Mesh(
            new THREE.BoxGeometry(10, 4, 7),
            new THREE.MeshStandardMaterial({ color: PALETTE.building[Math.floor(rand() * PALETTE.building.length)], roughness: 0.9 }));
          shop.position.set(cx + (rand() - 0.5) * 16, 2.3, cz + (rand() - 0.5) * 16);
          shop.castShadow = true;
          this.scene.add(shop);
          this.buildings.push({ mesh: shop, x: shop.position.x, z: shop.position.z, halfW: 5, halfD: 3.5, height: 4 });
        }
      }
    }
  }

  addNeonSign(x, y, z, width) {
    const color = PALETTE.neon[Math.floor(this.rand() * PALETTE.neon.length)];
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(width, 12), 1.6, 0.5),
      new THREE.MeshBasicMaterial({ color }));
    sign.position.set(x, y + 0.8, z);
    this.scene.add(sign);
    // Real point lights are expensive: only a few signs get one.
    this.neonLights = (this.neonLights || 0);
    if (this.neonLights < 8) {
      this.neonLights++;
      const glow = new THREE.PointLight(color, 12, 26);
      glow.position.set(x, y + 1.5, z + 3);
      this.scene.add(glow);
    }
  }

  buildBeachAndSea() {
    const half = WORLD.half;
    const beachZ = half + WORLD.beachDepth / 2;
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.span + 160, WORLD.beachDepth),
      new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.03, beachZ);
    sand.receiveShadow = true;
    this.scene.add(sand);
    // The sea: a big animated plane, teal with a sunset tint.
    const seaGeo = new THREE.PlaneGeometry(WORLD.span + 400, WORLD.oceanDepth, 24, 8);
    const seaMat = new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.35, metalness: 0.25, transparent: true, opacity: 0.94 });
    this.sea = new THREE.Mesh(seaGeo, seaMat);
    this.sea.rotation.x = -Math.PI / 2;
    this.sea.position.set(0, -0.4, half + WORLD.beachDepth + WORLD.oceanDepth / 2);
    this.scene.add(this.sea);
    this.seaBase = seaGeo.attributes.position.array.slice();
    // A boardwalk strip between city and sand.
    const walk = new THREE.Mesh(
      new THREE.BoxGeometry(WORLD.span, 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 1 }));
    walk.position.set(0, 0.25, half + 3);
    this.scene.add(walk);
  }

  buildPalms() {
    const rand = this.rand;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2fae5f, roughness: 0.9, side: THREE.DoubleSide });
    const spots = [];
    const pitch = WORLD.block + WORLD.road;
    const half = WORLD.half;
    for (let i = 0; i < WORLD.blocks + 1; i++) {
      const c = -half + WORLD.road / 2 + i * pitch;
      for (let d = -half + 20; d < half; d += 48) {
        if (rand() < 0.6) spots.push([c + 8, d]);
        if (rand() < 0.6) spots.push([d, c + 8]);
      }
    }
    for (let x = -half; x < half; x += 26) spots.push([x, half + 12 + rand() * 26]);
    for (const [x, z] of spots) this.addPalm(x, z, trunkMat, leafMat, rand);
  }

  addPalm(x, z, trunkMat, leafMat, rand) {
    const g = new THREE.Group();
    const h = 5 + rand() * 3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, h, 6), trunkMat);
    trunk.position.y = h / 2;
    trunk.rotation.z = (rand() - 0.5) * 0.18;
    trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.1), leafMat);
      leaf.position.y = h;
      leaf.rotation.y = (i / 6) * Math.PI * 2;
      leaf.rotation.x = -0.5;
      leaf.translateZ(1.2);
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.palms.push(g);
  }

  // A tall glowing pillar marking the current objective.
  buildBeacon() {
    const geo = new THREE.CylinderGeometry(1.6, 1.6, 90, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc300, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.set(0, 45, 0);
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.2, 32),
      new THREE.MeshBasicMaterial({ color: 0xffc300, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    this.beaconRing = ring;
    this.beaconRing.visible = false;
    this.scene.add(ring);
  }

  setBeacon(x, z, visible) {
    this.beacon.position.x = x;
    this.beacon.position.z = z;
    this.beacon.visible = visible;
    this.beaconRing.position.x = x;
    this.beaconRing.position.z = z;
    this.beaconRing.visible = visible;
  }

  update(dt, time) {
    // Gentle sea swell.
    if (this.sea) {
      const pos = this.sea.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = this.seaBase[i * 3];
        const by = this.seaBase[i * 3 + 1];
        pos.setZ(i, Math.sin(bx * 0.08 + time * 0.9) * 0.35 + Math.cos(by * 0.12 + time * 0.7) * 0.3);
      }
      pos.needsUpdate = true;
      this.sea.geometry.computeVertexNormals();
    }
    if (this.beacon && this.beacon.visible) {
      this.beacon.rotation.y += dt * 0.6;
      const s = 1 + Math.sin(time * 3) * 0.08;
      this.beaconRing.scale.set(s, s, 1);
    }
  }

  // Circle-vs-building collision: push the circle out, return true on hit.
  collideCircle(x, z, radius) {
    for (const b of this.buildings) {
      const dx = x - b.x;
      const dz = z - b.z;
      if (Math.abs(dx) < b.halfW + radius && Math.abs(dz) < b.halfD + radius) return b;
    }
    return null;
  }

  // Keep a point inside the playable land (city + beach).
  clampToLand(x, z) {
    const m = WORLD.half + WORLD.beachDepth - 2;
    return [Math.max(-WORLD.half - 4, Math.min(WORLD.half + 4, x)), Math.max(-WORLD.half - 4, Math.min(m, z))];
  }
}
