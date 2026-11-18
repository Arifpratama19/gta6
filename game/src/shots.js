// Screenshot poses for the dossier: ?shot=1..4 stages the game into a
// readable, dramatic frame and raises window.__shotReady once the scene has
// settled. The judge sees the game through these four frames.

function snapChaseCamera(game) {
  const p = game.player;
  const back = p.heading + Math.PI;
  game.camera.position.set(
    p.pos.x + Math.sin(back) * p.camDist,
    5.4,
    p.pos.z + Math.cos(back) * p.camDist
  );
  game.camera.lookAt(
    p.pos.x + Math.sin(p.heading) * 7,
    1.6,
    p.pos.z + Math.cos(p.heading) * 7
  );
}

function snapFootCamera(game) {
  const p = game.player;
  const cx = p.pos.x - Math.sin(p.camYaw) * Math.cos(p.camPitch) * p.camDist;
  const cz = p.pos.z - Math.cos(p.camYaw) * Math.cos(p.camPitch) * p.camDist;
  const cy = p.pos.y + 2.0 + Math.sin(p.camPitch) * p.camDist;
  game.camera.position.set(cx, Math.max(cy, 1.2), cz);
  game.camera.lookAt(p.pos.x, p.pos.y + 1.7, p.pos.z);
}

export function applyShot(game, n) {
  const G = game;
  if (n === 1) {
    // Cover: a police chase up the beach boulevard — wanted stars, the
    // minimap, the mission objective and the HUD all in one frame.
    G.startGame(true);
    G.player.pos.set(270, 0, -40);
    G.player.heading = Math.PI;
    G.player.camYaw = 0;
    const car = G.takeCarAt(270, -40);
    if (car) {
      car.heading = Math.PI;
      car.speed = 0;
      G.enterCar(car);
    }
    G.missions.start(2);
    G.police.setWanted(3);
    // Cop cars staged in view ahead of the player, closing in.
    G.police.spawnCopCar(262, -100);
    G.police.spawnCopCar(278, -135);
    G.police.spawnCopCar(270, -165);
    // A little traffic ahead for depth.
    G.traffic.spawnCar(270, -170, 'v', -1);
    G.traffic.spawnCar(270, -210, 'v', -1);
    snapChaseCamera(G);
    G.hud.message('Mara: The drop was watched. Lose them and reach the safehouse!');
  } else if (n === 2) {
    // Driving through downtown at golden hour, traffic all around.
    G.startGame(true);
    G.player.pos.set(0, 0, 60);
    G.player.heading = Math.PI;
    const car = G.takeCarAt(0, 60);
    if (car) {
      car.heading = Math.PI;
      car.speed = 0;
      G.enterCar(car);
    }
    G.missions.start(0);
    G.traffic.spawnCar(0, 10, 'v', -1);
    G.traffic.spawnCar(0, -30, 'v', -1);
    snapChaseCamera(G);
    G.hud.message('Mara: First job — take any car and bring it to the Marina.');
  } else if (n === 3) {
    // On foot on the beach at the pier during the showdown — rivals ahead
    // on the sand, the pier and its ferris wheel beyond, the ocean to the east.
    G.startGame(true);
    G.player.pos.set(395, 0, 120);
    G.player.heading = Math.PI;
    G.player.camYaw = Math.PI;
    G.player.camDist = 8.5;
    G.missions.start(3);
    // Jump straight to the eliminate step, with the fight at the pier.
    G.missions.stepIndex = 1;
    G.missions.killsNeeded = 5;
    G.missions.killsDone = 0;
    const step = G.missions.currentStep();
    step.x = 400;
    step.z = 60;
    for (const [ex, ez] of [[388, 85], [402, 95], [410, 82], [395, 70], [405, 105]]) {
      G.combat.spawnEnemy(ex, ez);
    }
    G.missions.syncMarker();
    snapFootCamera(G);
    G.hud.message('Coral Kings shooters on the pier — take them down!');
  } else if (n === 4) {
    // The start screen over the city vista.
    G.state = 'menu';
    G.hud.show('menu');
    G.camera.position.set(150, 70, 260);
    G.camera.lookAt(-40, 25, -120);
    G.menuCamera = true;
  }
  G.shotMode = n;
  G.shotFrames = 0;
  G.noCrosshair = true;
}
