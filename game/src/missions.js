// SOLMAR BAY — the story: five jobs from fixer Vic Marlowe.
// One job: mission definitions, objectives, timers and rewards.
// Each mission is a list of steps; a step is { text, at: [x, z], radius, time?,
// onArrive } and the game advances when the player reaches the marker.

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'JOB 1 — FIRST WHEELS',
    giver: 'Vic Marlowe',
    brief: 'Vic needs a driver he can trust. Jack any car on the street and bring it to the garage on Neon Row. No cops, no dents — well, fewer dents.',
    reward: 500,
    steps: [
      { text: 'Steal any car on the street (walk up to one and press E).', needCar: true },
      { text: 'Drive the car to Vic’s garage on Neon Row.', at: [196, -130], radius: 7 },
    ],
  },
  {
    id: 'sunset-courier',
    title: 'JOB 2 — SUNSET COURIER',
    giver: 'Vic Marlowe',
    brief: 'Three packages, three drop-offs, one sunset. The clients pay in cash and ask no questions. Beat the clock and Vic doubles the tip.',
    reward: 900,
    steps: [
      { text: 'Drop-off 1: the marina kiosk. Follow the gold beacon.', at: [-150, 190], radius: 7, time: 150 },
      { text: 'Drop-off 2: the rooftop bar in Palm Heights.', at: [-150, 30], radius: 7 },
      { text: 'Drop-off 3: the boardwalk arcade on South Beach.', at: [60, 205], radius: 7 },
    ],
  },
  {
    id: 'bank-getaway',
    title: 'JOB 3 — THE GETAWAY',
    giver: 'Vic Marlowe',
    brief: 'The crew hits the Solmar Central Bank at dusk. Your job is the wheel: get Dana to the bank, wait for the crew, then lose the whole Solmar PD and reach the safehouse.',
    reward: 2500,
    steps: [
      { text: 'Drive to the Solmar Central Bank downtown.', at: [30, 30], radius: 8 },
      { text: 'The crew is inside! Hold position — 20 seconds until they’re out.', wait: 20 },
      { text: 'GO! Two stars and counting. Reach the safehouse in Harbor Point.', at: [-160, 190], radius: 8, wanted: 2 },
    ],
  },
  {
    id: 'street-heat',
    title: 'JOB 4 — STREET HEAT',
    giver: 'Vic Marlowe',
    brief: 'A rival crew is muscling in on the Strip. Vic wants a message sent: take out three of their cars. Ramming counts. The pistol counts more.',
    reward: 1800,
    steps: [
      { text: 'Wreck 3 rival crew cars on the Casino Strip. Ram them or shoot them.', rivalCars: 3 },
    ],
  },
  {
    id: 'big-score',
    title: 'JOB 5 — THE BIG SCORE',
    giver: 'Vic Marlowe',
    brief: 'The Palmera Casino vault. One night, one crew, one way out: through the whole Solmar PD and down to the yacht at the marina. Pull this off and Dana never drives for anyone again.',
    reward: 8000,
    steps: [
      { text: 'Reach the Palmera Casino on the Strip.', at: [196, 30], radius: 8 },
      { text: 'Inside! Grab the vault cash — 25 seconds.', wait: 25 },
      { text: 'THREE STARS. Get to the yacht at the marina — don’t stop for anything.', at: [-196, 196], radius: 9, wanted: 3 },
    ],
  },
];

export class MissionRunner {
  constructor(onEvent) {
    this.onEvent = onEvent; // (type, data) — 'step' | 'complete' | 'fail' | 'start'
    this.index = 0;         // which mission is active
    this.step = 0;
    this.active = false;
    this.timer = null;      // seconds left, or null
    this.waitLeft = 0;
    this.rivalsDown = 0;
    this.state = 'idle';    // idle | playing | done
  }

  get mission() { return MISSIONS[this.index] || null; }
  get currentStep() { return this.mission ? this.mission.steps[this.step] : null; }
  get finishedAll() { return this.index >= MISSIONS.length; }

  start(index = 0) {
    this.index = index;
    this.step = 0;
    this.active = true;
    this.state = 'playing';
    const first = this.currentStep;
    this.timer = first && first.time ? first.time : null;
    this.waitLeft = 0;
    this.rivalsDown = 0;
    this.onEvent('start', { mission: this.mission });
    return this.mission;
  }

  // Advance when a step's condition is met; returns true when a step completed.
  stepDone(game) {
    const step = this.currentStep;
    if (!step) return false;
    if (step.needCar && !game.inCar) return false;
    if (step.rivalCars && this.rivalsDown < step.rivalCars) return false;
    if (step.wait && this.waitLeft > 0) return false;
    this.step++;
    this.waitLeft = 0;
    if (this.step >= this.mission.steps.length) {
      const reward = this.mission.reward;
      this.onEvent('complete', { mission: this.mission, reward });
      this.index++;
      this.active = false;
      this.state = this.finishedAll ? 'done' : 'idle';
      this.timer = null;
      return true;
    }
    const next = this.currentStep;
    this.timer = next && next.time ? next.time : null;
    if (next && next.wait) this.waitLeft = next.wait;
    this.onEvent('step', { mission: this.mission, step: next, stepIndex: this.step });
    return true;
  }

  // Per-frame: timers, wait steps, and arrival checks.
  update(dt, game) {
    if (!this.active || !this.mission) return;
    const step = this.currentStep;
    if (!step) return;
    if (this.timer !== null) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = null;
        this.active = false;
        this.state = 'idle';
        this.onEvent('fail', { mission: this.mission, reason: 'Out of time — the clients found another driver.' });
        return;
      }
    }
    if (step.wait) {
      if (this.waitLeft <= 0) this.waitLeft = step.wait;
      // A wait step with a location only counts down while the player stays there;
      // one without a location just counts down.
      let here = true;
      if (step.at) {
        const d = Math.hypot(game.playerPos.x - step.at[0], game.playerPos.z - step.at[1]);
        here = d < (step.radius || 10);
      }
      if (here) {
        this.waitLeft -= dt;
        if (this.waitLeft <= 0) this.stepDone(game);
      }
      return;
    }
    if (step.at) {
      const d = Math.hypot(game.playerPos.x - step.at[0], game.playerPos.z - step.at[1]);
      if (d < step.radius) {
        if (step.wanted) game.setWantedAtLeast(step.wanted);
        this.stepDone(game);
      }
      return;
    }
    // Steps with no position (needCar, rivalCars) are checked in stepDone by the game.
    this.stepDone(game);
  }

  rivalDestroyed() {
    const step = this.currentStep;
    if (!this.active || !step || !step.rivalCars) return;
    this.rivalsDown++;
    this.onEvent('rival', { down: this.rivalsDown, need: step.rivalCars });
    if (this.rivalsDown >= step.rivalCars) this.stepDone({ inCar: true, playerPos: { x: 0, z: 0 } });
  }

  objectiveText() {
    if (!this.active || !this.mission) return null;
    const step = this.currentStep;
    return step ? step.text : null;
  }

  markerPos() {
    if (!this.active || !this.mission) return null;
    const step = this.currentStep;
    if (!step) return null;
    if (step.at) return step.at;
    return null;
  }
}
