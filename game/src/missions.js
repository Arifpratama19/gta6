// SOLMAR BAY — the story: six jobs for Lucia Vega, each a chain of steps.
// A step is a place to reach, a car to steal, a thing to hold, or the cops to
// lose. The manager shows the marker, the beacon and the objective text, and
// pays out when a job is done.

import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { clamp } from './util.js';

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;                 // which mission is active
    this.stepIndex = 0;
    this.holdTimer = 0;
    this.active = false;
    this.done = false;              // whole story complete
    this.marker = null;             // { pos, radius, needCar }
    this.beacon = this.buildBeacon();
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.arrow = this.buildArrow();
    this.arrow.visible = false;
    scene.add(this.arrow);
  }

  buildBeacon() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 30;
    g.add(beam);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.28, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    g.add(ring);
    return g;
  }

  buildArrow() {
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 2.2, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    arrow.rotation.x = Math.PI; // point down
    return arrow;
  }

  get current() { return this.active ? MISSIONS[this.index] : null; }
  get step() { return this.current ? this.current.steps[this.stepIndex] : null; }

  start(index) {
    this.index = clamp(index, 0, MISSIONS.length - 1);
    this.stepIndex = 0;
    this.holdTimer = 0;
    this.active = true;
    this.done = false;
    this.current._heatApplied = false;
    return this.current;
  }

  startNext() {
    if (this.index + 1 >= MISSIONS.length) {
      this.active = false;
      this.done = true;
      this.hideMarker();
      return null;
    }
    return this.start(this.index + 1);
  }

  hideMarker() {
    this.beacon.visible = false;
    this.arrow.visible = false;
    this.marker = null;
  }

  // The beacon follows the current step's position; steps without a place
  // (steal a car, lose the cops) hide it.
  updateMarker() {
    const s = this.step;
    if (!s || !s.pos) { this.hideMarker(); return; }
    this.marker = { pos: new THREE.Vector3(s.pos[0], 0, s.pos[1]), radius: s.radius || 6, needCar: !!s.needCar };
    this.beacon.position.set(s.pos[0], 0, s.pos[1]);
    this.beacon.visible = true;
    this.arrow.position.set(s.pos[0], 9 + Math.sin(performance.now() / 300) * 0.7, s.pos[1]);
    this.arrow.visible = true;
  }

  // Advance the mission state for one frame. `events` carries what happened
  // this frame (entered a car, grabbed cash). Returns a status string or null.
  update(dt, playerPos, playerInCar, events) {
    if (!this.active) return null;
    const mission = this.current;
    const step = this.step;
    if (!step) return null;
    this.updateMarker();

    if (step.type === 'goto') {
      const d = Math.hypot(playerPos.x - step.pos[0], playerPos.z - step.pos[1]);
      if (d < (step.radius || 6) && (!step.needCar || playerInCar)) return this.advance();
    }
    if (step.type === 'enterCar' && events.enteredCar) return this.advance();
    if (step.type === 'grab') {
      const d = Math.hypot(playerPos.x - step.pos[0], playerPos.z - step.pos[1]);
      if (d < (step.radius || 10)) {
        this.holdTimer += dt;
        if (this.holdTimer >= (step.hold || 10)) return this.advance();
      } else {
        this.holdTimer = Math.max(0, this.holdTimer - dt * 2);
      }
    }
    if (step.type === 'escape' && events.wanted === 0) return this.advance();
    return null;
  }

  // Move to the next step; when the mission's steps are done, pay out and
  // hand back the completed mission.
  advance() {
    const mission = this.current;
    this.stepIndex++;
    this.holdTimer = 0;
    if (this.stepIndex >= mission.steps.length) {
      this.active = false;
      this.hideMarker();
      return { completed: mission };
    }
    return { step: this.step };
  }

  // Objective text for the HUD, with hold progress when relevant.
  objectiveText() {
    if (!this.active) {
      return this.done
        ? { title: 'STORY COMPLETE', text: 'Solmar Bay is yours — free roam', sub: 'Press Esc to save. Explore, steal, cause chaos.' }
        : { title: 'FREE ROAM', text: 'Explore Solmar Bay', sub: 'Start the next job from the pause menu, or just drive.' };
    }
    const mission = this.current;
    const step = this.step;
    let text = step ? step.text : '';
    let sub = `Job ${this.index + 1} of ${MISSIONS.length}  •  Reward $${mission.reward}`;
    if (step && step.type === 'grab') {
      const pct = Math.round((this.holdTimer / (step.hold || 10)) * 100);
      text = `${step.text} — ${pct}%`;
    }
    return { title: mission.title, text, sub };
  }

  // The mission's wanted level, applied when the job starts.
  wantedOnStart() {
    const m = this.current;
    return m && m.wanted ? m.wanted : 0;
  }
}
