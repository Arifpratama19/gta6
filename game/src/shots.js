// SOLMAR BAY — screenshot staging: ?shot=N sets up a scene for the dossier
// screenshots so each one shows a different system of the game at its best.
// 1 = the title screen over the city, 2 = driving in traffic, 3 = a police
// chase at 3 stars, 4 = on foot at the pier with a mission marker.

import { VEHICLES } from './config.js';
import { Car } from './vehicles.js';

export function shotNumber() {
  const n = Number(new URLSearchParams(location.search).get('shot'));
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : 0;
}

export function autoPlay() {
  return new URLSearchParams(location.search).get('autoplay') === '1';
}

// Put the player in a car at (x, z) facing `heading`, and give traffic a
// moment to fill the street around them. The camera snaps behind the car so
// the shot is framed from the first frame (no slow lerp across the scene).
function giveCar(game, x, z, heading, defId) {
  const def = VEHICLES.find((v) => v.id === defId) || VEHICLES[1];
  const car = new Car(def, x, z, heading);
  car.isPlayer = true;
  game.scene.add(car.mesh);
  game.player.car = car;
  game.player.mesh.visible = false;
  game.player.pos.set(x, 0, z);
  game.followCam.yaw = heading;
  game.followCam.smoothed.set(
    x - Math.sin(heading) * 8.1,
    3.9,
    z - Math.cos(heading) * 8.1,
  );
  return car;
}

export function stageShot(game, n) {
  const player = game.player;
  if (n === 1) {
    // Title screen: the menu stays up; park the camera above Ocean Drive.
    game.followCam.smoothed.set(60, 26, 150);
    game.followCam.yaw = Math.PI * 0.9;
    return 'menu';
  }
  if (n === 2) {
    // Driving down the main avenue in the Comet GT, traffic all around.
    // x = -21 is a road line; heading 0 drives south along it.
    giveCar(game, -21, 60, 0, 'comet');
    game.autoDrive = true;
    player.addCash(3250);
    game.missions.start(1);
    game.missions.stepIndex = 1; // already stole it: now deliver it
    game.hud.feed('Nice wheels. Rico\'s garage is in Westside.', 'gold');
    return 'drive';
  }
  if (n === 3) {
    // A three-star chase on the z = -21 avenue: cruisers ahead as a
    // roadblock and more on the tail, sirens up.
    const car = giveCar(game, 30, -21, -Math.PI / 2, 'muscle');
    car.speed = 30;
    game.autoDrive = true;
    game.police.setStars(3);
    const ahead1 = game.police.spawnCruiser(car.pos);
    ahead1.pos.set(car.pos.x - 30, 0, -21);
    ahead1.heading = Math.PI / 2;
    ahead1.speed = 30;
    const ahead2 = game.police.spawnCruiser(car.pos);
    ahead2.pos.set(car.pos.x - 42, 0, -21);
    ahead2.heading = Math.PI / 2;
    ahead2.speed = 30;
    for (let i = 0; i < 2; i++) game.police.spawnCruiser(car.pos);
    game.missions.start(3);
    game.hud.feed('The SPPD is on you — lose them!', 'warn');
    return 'chase';
  }
  // 4: on foot on the pier, facing the Pier Bar and its gold beacon, the
  // ocean and the yacht behind it.
  player.pos.set(14, 0, 250);
  player.heading = 0;
  game.missions.start(0);
  game.hud.feed('Rico is waiting at the Pier Bar.', 'gold');
  game.followCam.yaw = 0;
  game.followCam.pitch = 0.45;
  game.followCam.distance = 11;
  game.followCam.smoothed.set(14, 5.2, 239.5);
  return 'foot';
}
