// The city of Solmar Bay: a seeded procedural coastal city — downtown towers,
// neon streets, a marina, a pier, beach and ocean. No external assets: window
// patterns and road markings are painted on canvases at load time.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, makeRng, rand } from './util.js';

function canvasTexture(w, h, painter) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  painter(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function windowTexture(seed) {
  const rng = makeRng(seed);
  return canvasTexture(128, 256, (g, w, h) => {
    // Light base so the building tint shows through; panes read as windows.
    g.fillStyle = '#b7bcc6';
    g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 22) {
      for (let x = 8; x < w - 8; x += 18) {
        const lit = rng();
        if (lit < 0.22) g.fillStyle = '#ffd97a';
        else if (lit < 0.38) g.fillStyle = '#9fd8ff';
        else g.fillStyle = '#39445c';
        g.fillRect(x, y, 12, 14);
      }
    }
  });
}

function dashTextureH() {
  // Dashes run along the road (horizontal canvas, repeated along x).
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#2e2f36';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7c948';
    g.fillRect(20, h / 2 - 2, 90, 4);
    g.fillStyle = '#e8e8e8';
    g.fillRect(0, 3, w, 2);
    g.fillRect(0, h - 5, w, 2);
  });
}

function dashTextureV() {
  // Dashes run along the road (vertical canvas, repeated along z).
  return canvasTexture(64, 256, (g, w, h) => {
    g.fillStyle = '#2e2f36';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7c948';
    g.fillRect(w / 2 - 2, 20, 4, 90);
    g.fillStyle = '#e8e8e8';
    g.fillRect(3, 0, 2, h);
    g.fillRect(w - 5, 0, 2, h);
  });
}

function waterTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#1b7fa8';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const y = Math.random() * h;
      const x = Math.random() * w;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 20 + Math.random() * 40, y);
      g.stroke();
    }
  });
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.roadsH = [];
    this.roadsV = [];
    for (let v = -360; v <= 360; v += CONFIG.world.roadStep) {
      this.roadsH.push(v);
      this.roadsV.push(v);
    }
    this.clouds = [];
    this.waterTex = null;
    this.build();
  }

  addCollider(x, z, hx, hz) {
    this.colliders.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
  }

  // Push a circle (x,z,r) out of every building AABB. Returns corrected pos.
  collide(x, z, r) {
    for (const b of this.colliders) {
      const cx = clamp(x, b.minX, b.maxX);
      const cz = clamp(z, b.minZ, b.maxZ);
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pl = x - (b.minX - r);
          const pr = (b.maxX + r) - x;
          const pt = z - (b.minZ - r);
          const pb = (b.maxZ + r) - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = b.minX - r;
          else if (m === pr) x = b.maxX + r;
          else if (m === pt) z = b.minZ - r;
          else z = b.maxZ + r;
        }
      }
    }
    return { x, z };
  }

  districtAt(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const d of CONFIG.districts) {
      const dx = x - d.cx;
      const dz = z - d.cz;
      const dd = dx * dx + dz * dz;
      if (dd < bestD) {
        bestD = dd;
        best = d;
      }
    }
    if (bestD > 220 * 220) return 'Solmar Bay';
    return best.name;
  }

  nearestRoad(x, z) {
    let bx = this.roadsV[0];
    let bz = this.roadsH[0];
    for (const v of this.roadsV) if (Math.abs(v - x) < Math.abs(bx - x)) bx = v;
    for (const v of this.roadsH) if (Math.abs(v - z) < Math.abs(bz - z)) bz = v;
    return { x: bx, z: bz };
  }

  build() {
    const scene = this.scene;
    const rng = makeRng(20261118);

    // --- sky, sun, fog -------------------------------------------------
    scene.background = new THREE.Color(0x87bfe8);
    scene.fog = new THREE.Fog(0xa8c8e8, 320, 1050);
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6f4d, 1.25);
    scene.add(hemi);
    // Warm fill from the opposite side so shadowed streets stay readable.
    const fill = new THREE.DirectionalLight(0xffe0b3, 0.55);
    fill.position.set(-220, 180, -120);
    scene.add(fill);
    const sun = new THREE.DirectionalLight(0xfff1c4, 2.1);
    sun.position.set(220, 320, 140);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -480;
    sun.shadow.camera.right = 480;
    sun.shadow.camera.top = 480;
    sun.shadow.camera.bottom = -480;
    sun.shadow.camera.far = 1200;
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    this.sun = sun;

    // --- ground, beach, ocean ------------------------------------------
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshLambertMaterial({ color: 0x8f8a80 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 900),
      new THREE.MeshLambertMaterial({ color: CONFIG.palette.sand })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(415, 0.05, 0);
    sand.receiveShadow = true;
    scene.add(sand);

    this.waterTex = waterTexture();
    this.waterTex.wrapS = THREE.RepeatWrapping;
    this.waterTex.wrapT = THREE.RepeatWrapping;
    this.waterTex.repeat.set(6, 6);
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 1000),
      new THREE.MeshLambertMaterial({ map: this.waterTex })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(800, 0.02, 0);
    scene.add(ocean);

    // --- roads -----------------------------------------------------------
    // Horizontal roads run along x (constant z); vertical roads along z.
    const dashH = dashTextureH();
    dashH.wrapS = THREE.RepeatWrapping;
    dashH.wrapT = THREE.RepeatWrapping;
    for (const z of this.roadsH) {
      const tex = dashH.clone();
      tex.needsUpdate = true;
      tex.repeat.set(14, 1);
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(900, CONFIG.world.roadWidth),
        new THREE.MeshLambertMaterial({ map: tex })
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.1, z);
      road.receiveShadow = true;
      scene.add(road);
    }
    const dashV = dashTextureV();
    dashV.wrapS = THREE.RepeatWrapping;
    dashV.wrapT = THREE.RepeatWrapping;
    for (const x of this.roadsV) {
      if (x >= CONFIG.world.beachX) continue;
      const tex = dashV.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, 14);
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(CONFIG.world.roadWidth, 760),
        new THREE.MeshLambertMaterial({ map: tex })
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0.1, -40);
      road.receiveShadow = true;
      scene.add(road);
    }

    // --- buildings -------------------------------------------------------
    const winTexs = [windowTexture(11), windowTexture(23), windowTexture(37)];
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const roofGeo = new THREE.BoxGeometry(1, 0.6, 1);
    const neonColors = [0xff2d78, 0x00e5ff, 0xffc300, 0x7cff4f];
    const parkBlocks = [[-225, 45], [135, -225], [-45, 225]];
    for (let gx = -360; gx <= 270; gx += 90) {
      for (let gz = -360; gz <= 270; gz += 90) {
        const cx = gx + 45;
        const cz = gz + 45;
        if (cx > 350) continue; // beach stays open
        if (parkBlocks.some(([px, pz]) => px === cx && pz === cz)) continue; // park block
        const downtown = Math.hypot(cx + 40, cz + 120) < 190;
        const n = downtown ? 1 : 1 + Math.floor(rng() * 2);
        for (let i = 0; i < n; i++) {
          const w = downtown ? rand(26, 40, rng) : rand(16, 30, rng);
          const d = downtown ? rand(26, 40, rng) : rand(16, 30, rng);
          const h = downtown ? rand(55, 130, rng) : rand(10, 34, rng);
          const ox = n === 1 ? 0 : (i === 0 ? -14 : 14);
          const oz = n === 1 ? 0 : (i === 0 ? -12 : 12);
          const bx = cx + ox;
          const bz = cz + oz;
          const tint = new THREE.Color().setHSL(rand(0.02, 0.14, rng), rand(0.25, 0.6, rng), rand(0.4, 0.62, rng));
          if (downtown && rng() < 0.5) tint.setHSL(rand(0.55, 0.65, rng), 0.45, rand(0.38, 0.58, rng));
          const mat = new THREE.MeshLambertMaterial({
            color: tint,
            map: winTexs[Math.floor(rng() * 3)],
          });
          const b = new THREE.Mesh(boxGeo, mat);
          b.scale.set(w, h, d);
          b.position.set(bx, h / 2, bz);
          b.castShadow = true;
          b.receiveShadow = true;
          scene.add(b);
          const roof = new THREE.Mesh(
            roofGeo,
            new THREE.MeshLambertMaterial({ color: 0x3a3f4a })
          );
          roof.scale.set(w * 0.92, 1, d * 0.92);
          roof.position.set(bx, h + 0.3, bz);
          scene.add(roof);
          // Neon trim on some downtown towers.
          if (downtown && rng() < 0.55) {
            const trim = new THREE.Mesh(
              new THREE.BoxGeometry(w + 0.4, 0.7, d + 0.4),
              new THREE.MeshBasicMaterial({ color: neonColors[Math.floor(rng() * neonColors.length)] })
            );
            trim.position.set(bx, h * rand(0.45, 0.9, rng), bz);
            scene.add(trim);
          }
          this.addCollider(bx, bz, w / 2, d / 2);
        }
      }
    }

    // --- pocket parks: green squares with trees between the blocks --------
    const parkMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3a });
    const treeMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
    const trunkMat2 = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
    for (const [parkX, parkZ] of parkBlocks) {
      const park = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), parkMat);
      park.rotation.x = -Math.PI / 2;
      park.position.set(parkX, 0.08, parkZ);
      park.receiveShadow = true;
      scene.add(park);
      for (let t = 0; t < 5; t++) {
        const tx = parkX + rand(-26, 26, rng);
        const tz = parkZ + rand(-26, 26, rng);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 4, 6), trunkMat2);
        trunk.position.set(tx, 2, tz);
        trunk.castShadow = true;
        scene.add(trunk);
        const crown = new THREE.Mesh(new THREE.SphereGeometry(rand(3, 4.6, rng), 8, 6), treeMat);
        crown.position.set(tx, 6, tz);
        crown.castShadow = true;
        scene.add(crown);
      }
    }

    // --- pier ------------------------------------------------------------
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6b45 });
    const pier = new THREE.Mesh(new THREE.BoxGeometry(95, 1.2, 12), pierMat);
    pier.position.set(425, 1.4, 60);
    pier.castShadow = true;
    pier.receiveShadow = true;
    scene.add(pier);
    for (let x = 392; x <= 468; x += 12) {
      for (const dz of [-5, 5]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.4, 6), pierMat);
        post.position.set(x, 0.4, 60 + dz);
        scene.add(post);
      }
    }
    // Pier end shack + ferris wheel silhouette on the pier.
    const shack = new THREE.Mesh(
      new THREE.BoxGeometry(10, 6, 8),
      new THREE.MeshLambertMaterial({ color: 0xff6d8a })
    );
    shack.position.set(462, 4.6, 60);
    shack.castShadow = true;
    scene.add(shack);
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(13, 0.9, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xffc300 })
    );
    wheel.position.set(440, 17, 44);
    scene.add(wheel);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 26, 0.5), new THREE.MeshBasicMaterial({ color: 0xffc300 }));
      spoke.position.set(440, 17, 44);
      spoke.rotation.z = a;
      scene.add(spoke);
    }
    this.ferrisWheel = wheel;

    // --- palms -----------------------------------------------------------
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e9e4f, side: THREE.DoubleSide });
    const palmSpots = [];
    for (let z = -420; z <= 420; z += 42) palmSpots.push([392, z]);
    for (let i = 0; i < 18; i++) {
      palmSpots.push([this.roadsV[Math.floor(rng() * this.roadsV.length)] + 11, this.roadsH[Math.floor(rng() * this.roadsH.length)] + 11]);
    }
    for (const [px, pz] of palmSpots) {
      if (px > 400) continue;
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 9, 6), trunkMat);
      trunk.position.y = 4.5;
      trunk.rotation.z = rand(-0.08, 0.08, rng);
      trunk.castShadow = true;
      palm.add(trunk);
      for (let f = 0; f < 6; f++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5.5, 4), leafMat);
        leaf.position.y = 9.2;
        leaf.rotation.z = Math.PI / 2.4;
        leaf.rotation.y = (f / 6) * Math.PI * 2;
        leaf.translateY(1.6);
        palm.add(leaf);
      }
      palm.position.set(px, 0, pz);
      scene.add(palm);
    }

    // --- street lamps ----------------------------------------------------
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x22242a });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    this.lamps = [];
    for (const z of this.roadsH) {
      for (let x = -360; x <= 360; x += 90) {
        if (x > 360) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 7, 6), poleMat);
        pole.position.set(x + 9, 3.5, z + 9);
        scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampMat);
        bulb.position.set(x + 9, 7.2, z + 9);
        scene.add(bulb);
        this.lamps.push(bulb);
      }
    }

    // --- beach umbrellas + sun loungers ----------------------------------
    const umbrellaCols = [0xff5d8f, 0x00b4d8, 0xffd166, 0xef476f];
    for (let i = 0; i < 10; i++) {
      const ux = rand(388, 420, rng);
      const uz = rand(-380, 380, rng);
      const umb = new THREE.Mesh(
        new THREE.ConeGeometry(3.2, 1.6, 8),
        new THREE.MeshLambertMaterial({ color: umbrellaCols[i % 4] })
      );
      umb.position.set(ux, 3.4, uz);
      scene.add(umb);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3, 5), poleMat);
      stick.position.set(ux, 1.6, uz);
      scene.add(stick);
    }

    // --- clouds ----------------------------------------------------------
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (let i = 0; i < 11; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(rand(9, 18, rng), 8, 6), cloudMat);
        s.scale.y = 0.45;
        s.position.set(j * 12 - 12, rand(-2, 2, rng), rand(-4, 4, rng));
        cloud.add(s);
      }
      cloud.position.set(rand(-450, 450, rng), rand(120, 180, rng), rand(-450, 450, rng));
      scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  update(dt) {
    for (const c of this.clouds) {
      c.position.x += dt * 2.2;
      if (c.position.x > 520) c.position.x = -520;
    }
    if (this.waterTex) this.waterTex.offset.y += dt * 0.012;
    if (this.ferrisWheel) this.ferrisWheel.rotation.z += dt * 0.12;
  }
}
