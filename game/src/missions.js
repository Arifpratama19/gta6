// missions.js — Rico Vega's 5-mission story chain.
import { MISSIONS } from "./config.js";
import { LANDMARKS } from "./city.js";
import { createCar } from "./vehicles.js";
import { createEnemy } from "./combat.js";
import { addWanted } from "./police.js";
import { dist } from "./util.js";
import { sfxMission, sfxPickup } from "./audio.js";

export function createMissionState() {
  return {
    index: 0,            // 0..4 active, 5 = story complete
    phase: "go",
    target: null,        // {x, y, label}
    data: {},            // per-mission scratch (timers, target car, kills left)
    banner: null,        // {text, sub, t} shown by the HUD
    completeTimer: 0,    // delay before the next mission starts
  };
}

function showBanner(state, text, sub) {
  state.mission.banner = { text, sub: sub || "", t: 3.2 };
}

export function startMission(state, i) {
  const m = state.mission;
  m.index = i;
  m.phase = "go";
  m.data = {};
  const def = MISSIONS[i];
  if (!def) { m.target = null; return; }
  showBanner(state, "MISSION: " + def.title, def.brief);
  if (i === 0) {
    m.target = { x: LANDMARKS.marina.x, y: LANDMARKS.marina.y, label: "Meet your contact" };
  } else if (i === 1) {
    // the red coupe parked by the Pier
    const car = createCar(LANDMARKS.pier.x - 60, LANDMARKS.pier.y + 30, Math.PI / 2, { color: "#d43d2a", parked: true });
    state.cars.push(car);
    m.data.targetCar = car;
    m.target = { x: car.x, y: car.y, label: "Steal the red coupe" };
  } else if (i === 2) {
    const spots = [
      { x: 2240, y: 600 }, { x: 2290, y: 760 }, { x: 2220, y: 1020 }, { x: 2300, y: 1180 },
    ];
    m.data.enemies = spots.map(s => { const e = createEnemy(s.x, s.y); state.enemies.push(e); return e; });
    m.data.killsLeft = 4;
    m.target = { x: 2260, y: 880, label: "Clear the beach" };
  } else if (i === 3) {
    addWanted(state, 3, state.player.x, state.player.y);
    m.phase = "evade";
    m.target = { x: state.player.x, y: state.player.y, label: "Lose the cops" };
    showBanner(state, "MISSION: " + def.title, "3 stars on you. Break line of sight and stay clean until the heat dies down.");
  } else if (i === 4) {
    m.target = { x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, label: "Hit the Solmar Bank" };
    m.data.hold = 0;
  }
}

function completeMission(state) {
  const m = state.mission;
  const def = MISSIONS[m.index];
  state.player.money += def.pay;
  sfxMission();
  showBanner(state, "MISSION COMPLETE", def.title + "  —  +$" + def.pay);
  state.events.push({ type: "missionDone", mission: m.index + 1 });
  m.completeTimer = 3.5;
  m.phase = "done";
  m.target = null;
}

export function updateMissions(state, dt) {
  const m = state.mission;
  const p = state.player;
  if (m.banner) { m.banner.t -= dt; if (m.banner.t <= 0) m.banner = null; }
  if (m.index >= MISSIONS.length) return; // story done
  if (m.phase === "done") {
    m.completeTimer -= dt;
    if (m.completeTimer <= 0) {
      const next = m.index + 1;
      if (next >= MISSIONS.length) {
        m.index = next;
        showBanner(state, "SOLMAR BAY — STORY COMPLETE", "Rico Vega owns this town now. Free roam: keep driving, keep the heat low.");
        state.events.push({ type: "storyDone" });
      } else {
        startMission(state, next);
      }
    }
    return;
  }
  // count mission-3 kills
  if (m.index === 2 && m.data.enemies) {
    m.data.killsLeft = m.data.enemies.filter(e => !e.dead).length;
    if (m.data.killsLeft <= 0) { completeMission(state); return; }
  }
  const t = m.target;
  if (!t) return;
  const d = dist(p.x, p.y, t.x, t.y);
  if (m.index === 0) {
    if (d < 70) completeMission(state);
  } else if (m.index === 1) {
    if (m.phase === "go") {
      if (!p.onFoot && p.car === m.data.targetCar) {
        m.phase = "deliver";
        m.target = { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, label: "Deliver to the garage" };
        showBanner(state, "Nice wheels.", "Now get it to the garage — in one piece.");
      }
    } else if (m.phase === "deliver") {
      if (!p.onFoot && p.car === m.data.targetCar && d < 80) completeMission(state);
    }
  } else if (m.index === 2) {
    // kills drive this mission; the marker is just a guide
  } else if (m.index === 3) {
    if (m.phase === "evade") {
      if (state.wanted === 0) {
        m.phase = "go";
        m.target = { x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, label: "Reach the safehouse" };
        showBanner(state, "Heat's off.", "Now slip away to the safehouse up north.");
      }
    } else if (m.phase === "go") {
      if (d < 70) completeMission(state);
    }
  } else if (m.index === 4) {
    if (m.phase === "go") {
      if (p.onFoot && d < 60) {
        m.data.hold += dt;
        if (m.data.hold >= 5) {
          m.phase = "escape";
          m.target = { x: LANDMARKS.marina.x, y: LANDMARKS.marina.y, label: "Escape to the marina" };
          addWanted(state, 4, p.x, p.y);
          sfxPickup();
          showBanner(state, "Cash grabbed!", "4 stars. Lose them and get to the marina — now!");
        }
      } else {
        m.data.hold = Math.max(0, m.data.hold - dt * 2);
      }
    } else if (m.phase === "escape") {
      if (d < 70) completeMission(state);
    }
  }
}
