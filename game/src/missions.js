// Missions: Rico's five jobs for Mara Solis. A small step engine drives each
// job — reach a marker, steal a car, pick something up, defeat a set number
// of shooters — and pays out on completion.

import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { dist2 } from './util.js';

export class Missions {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.index = 0;
    this.stepIndex = 0;
    this.completed = 0;
    this.done = false;
    this.killsNeeded = 0;
    this.killsDone = 0;
    this.pickupTaken = false;
    this.marker = null;
    this.beacon = null;
    this.beaconLight = null;
    this.buildMarker();
  }

  buildMarker() {
    const geo = new THREE.CylinderGeometry(2.2, 2.2, 0.5, 24);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc300, transparent: true, opacity: 0.75 });
    this.marker = new THREE.Mesh(geo, mat);
    this.marker.position.y = 0.3;
    this.marker.visible = false;
    this.scene.add(this.marker);
    const beamGeo = new THREE.CylinderGeometry(1.1, 1.1, 60, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffc300, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(beamGeo, beamMat);
    this.beacon.position.y = 30;
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    this.beaconLight = new THREE.PointLight(0xffc300, 12, 30);
    this.beaconLight.position.y = 4;
    this.beaconLight.visible = false;
    this.scene.add(this.beaconLight);
  }

  current() {
    return MISSIONS[this.index] || null;
  }

  currentStep() {
    const m = this.current();
    return m ? m.steps[this.stepIndex] : null;
  }

  objectiveText() {
    if (this.done) return 'Story complete — Solmar Bay is yours, Rico.';
    const m = this.current();
    if (!m) return '';
    const step = this.currentStep();
    let text = step ? step.text : '';
    if (step && step.type === 'eliminate') {
      text = `Defeat the Coral Kings shooters (${this.killsDone}/${this.killsNeeded})`;
    }
    return `${m.title} — ${text}`;
  }

  start(index) {
    this.index = index;
    this.stepIndex = 0;
    this.done = false;
    this.killsDone = 0;
    this.pickupTaken = false;
    const m = this.current();
    if (!m) {
      this.done = true;
      return;
    }
    if (m.heat) this.game.police.setWanted(m.heat);
    this.game.hud.message(`${m.title}: ${m.brief}`);
    this.game.audio.pickup();
    this.syncMarker();
  }

  syncMarker() {
    const step = this.currentStep();
    if (!step || step.type === 'enterCar') {
      this.marker.visible = false;
      this.beacon.visible = false;
      this.beaconLight.visible = false;
      return;
    }
    if (step.x !== undefined) {
      this.marker.position.set(step.x, 0.3, step.z);
      this.beacon.position.set(step.x, 30, step.z);
      this.beaconLight.position.set(step.x, 4, step.z);
      this.marker.visible = true;
      this.beacon.visible = true;
      this.beaconLight.visible = true;
    }
  }

  onEnemyKilled() {
    const step = this.currentStep();
    if (!step || step.type !== 'eliminate') return;
    this.killsDone++;
    if (this.killsDone >= this.killsNeeded) this.advance();
    else this.game.hud.message(`Shooters left: ${this.killsNeeded - this.killsDone}`);
  }

  advance() {
    const m = this.current();
    if (!m) return;
    this.stepIndex++;
    if (this.stepIndex >= m.steps.length) {
      this.completeMission(m);
      return;
    }
    const step = this.currentStep();
    if (step.type === 'eliminate') {
      this.killsNeeded = step.count;
      this.killsDone = 0;
      const cx = step.x;
      const cz = step.z;
      for (let i = 0; i < step.count; i++) {
        this.game.combat.spawnEnemy(cx + (Math.random() - 0.5) * 36, cz + (Math.random() - 0.5) * 36);
      }
      this.game.hud.message('Coral Kings shooters on the pier — take them down!');
    }
    this.syncMarker();
  }

  completeMission(m) {
    this.game.cash += m.reward;
    this.completed++;
    this.game.audio.cash();
    this.game.hud.message(`Mission complete: ${m.title} — +$${m.reward.toLocaleString('en-US')}`);
    this.game.combat.clearEnemies();
    if (this.index + 1 >= MISSIONS.length) {
      this.done = true;
      this.marker.visible = false;
      this.beacon.visible = false;
      this.beaconLight.visible = false;
      this.game.hud.showBanner('STORY COMPLETE', 'The debt is paid. Solmar Bay is yours, Rico.');
      this.game.saveGame();
      return;
    }
    this.index++;
    this.stepIndex = 0;
    this.killsDone = 0;
    this.pickupTaken = false;
    const next = this.current();
    if (next.heat) this.game.police.setWanted(next.heat);
    this.game.hud.message(`${next.title}: ${next.brief}`);
    this.syncMarker();
    this.game.saveGame();
  }

  update(dt) {
    if (this.done || this.game.state !== 'playing') return;
    const m = this.current();
    if (!m) return;
    const step = this.currentStep();
    if (!step) return;
    const p = this.game.player.pos;
    // Marker pulse.
    if (this.marker.visible) {
      const s = 1 + Math.sin(this.game.time * 4) * 0.12;
      this.marker.scale.set(s, 1, s);
      this.marker.rotation.y += dt;
    }
    if (step.type === 'enterCar') {
      if (this.game.player.driving) this.advance();
    } else if (step.type === 'reach' || step.type === 'pickup') {
      if (dist2(p.x, p.z, step.x, step.z) < step.radius) {
        if (step.type === 'pickup') {
          if (!this.pickupTaken) {
            this.pickupTaken = true;
            this.game.audio.pickup();
            this.game.hud.message('Package secured. Now deliver it.');
            this.advance();
          }
        } else {
          this.game.audio.pickup();
          this.advance();
        }
      }
    }
  }
}
