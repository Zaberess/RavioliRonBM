const FISHING_SPOT_ID = 1542;
const FISH_IDS = [11328, 11330, 11332];
const ROD_ID = 11323;
const BAIT_ID = 314;
const FISHING_ANIM = 9350;
const INV_SLOTS = 28;
const FAIL_LIMIT = 5;

var state = "IDLE";
var timeout = 0;
var failCount = 0;
var dropEnabled = true;
var dropIndex = 0;
var lastDropStateLogged = false;
var inVerify = false;
var verifyIndex = 0;
var nextAfkTick = 0;
var afkTicksRemaining = 0;

const snakeOrder = [
  1, 2, 3, 4, 8, 7, 6, 5, 9, 10, 11, 12, 16, 15, 14, 13, 17, 18, 19, 20, 24, 23,
  22, 21, 25, 26, 27, 28,
];

function onStart() {
  bot.printGameMessage("Ravioli Ron’s Barbarian Fisher started!");
  bot.printLogMessage("[START] Script initialised.");
  bot.breakHandler.setBreakHandlerStatus(true);
  state = "IDLE";
  failCount = 0;
  timeout = 0;
}

function onEnd() {
  bot.printGameMessage("Ravioli Ron’s Barbarian Fisher stopped.");
  bot.printLogMessage("[END] Script ended cleanly.");
  bot.breakHandler.setBreakHandlerStatus(false);
  state = "IDLE";
  timeout = 0;
}

// === Utility ===
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// === Main Loop ===
function onGameTick() {
  // Handle random AFK breaks
  if (handleRandomAfk()) return;

  if (timeout > 0) {
    timeout--;
    return;
  }

  switch (state) {
    case "IDLE":
      bot.breakHandler.setBreakHandlerStatus(true);
      bot.printLogMessage("[STATE] Idle → Searching for fishing spot...");
      timeout = randomDelay(3, 12);
      findFishingSpot();
      break;

    case "After Drop":
      timeout = randomDelay(1, 2);
      findFishingSpot();
      break;

    case "FISHING":
      bot.breakHandler.setBreakHandlerStatus(true);
      monitorFishing();
      break;

    case "DROPPING":
      bot.breakHandler.setBreakHandlerStatus(false);
      if (!lastDropStateLogged) {
        bot.printLogMessage("[STATE] Dropping fish...");
        bot.printGameMessage("Dropping fish.");
        lastDropStateLogged = true;
      }
      if (!dropFish()) {
        bot.printLogMessage(
          "[STATE] Inventory cleared → Returning to fishing."
        );
        state = "After Drop";
        lastDropStateLogged = false; // reset for next time
      }
      break;
  }
}

function findFishingSpot() {
  if (bot.inventory.getEmptySlots() === 0) {
    bot.printLogMessage("[INFO] Inventory full → switching to drop mode.");
    state = dropEnabled ? "DROPPING" : "STOP";
    return;
  }

  const spots = bot.npcs.getWithIds([FISHING_SPOT_ID]);
  const spot = bot.npcs.getClosest(spots);

  if (!spot) {
    failCount++;
    if (failCount >= FAIL_LIMIT) {
      bot.printGameMessage("No fishing spots found repeatedly — terminating.");
      bot.terminate();
    } else {
      bot.printLogMessage(
        `[WARN] No fishing spots found (${failCount}/${FAIL_LIMIT}).`
      );
    }
    timeout = randomDelay(2, 5);
    return;
  }

  if (
    !bot.inventory.containsAnyIds([ROD_ID]) ||
    !bot.inventory.containsAnyIds([BAIT_ID])
  ) {
    failCount++;
    bot.printLogMessage(
      `[WARN] Missing rod or bait (${failCount}/${FAIL_LIMIT}).`
    );
    if (failCount >= FAIL_LIMIT) {
      bot.printGameMessage("Rod or bait missing repeatedly — terminating.");
      bot.terminate();
    }
    return;
  }

  failCount = 0;
  bot.printLogMessage("[ACTION] Found fishing spot → Interacting.");
  bot.npcs.interactSupplied(spot, "Use-rod");
  bot.printGameMessage("Fishing...");
  state = "FISHING";
  timeout = randomDelay(8, 15);
}

function monitorFishing() {
  const player = client.getLocalPlayer();
  if (!player) return;

  const anim = player.getAnimation();

  if (anim === FISHING_ANIM) return;

  if (bot.inventory.getEmptySlots() === 0) {
    bot.printLogMessage("[INFO] Inventory full while fishing → dropping.");
    state = "DROPPING";
    timeout = randomDelay(2, 8);
    return;
  }

  if (anim === -1 && !bot.localPlayerMoving()) {
    bot.printLogMessage("[INFO] Player idle → re-searching for fishing spot.");
    state = "IDLE";
    timeout = randomDelay(3, 6);
    return;
  }
}

function dropFish() {
  const widgets = bot.inventory.getAllWidgets();
  const byIndex = {};
  for (var i = 0; i < widgets.length; i++) {
    byIndex[widgets[i].getIndex()] = widgets[i];
  }

  if (inVerify) {
    var dropsThisTick = Math.floor(Math.random() * 2) + 2;
    var droppedCount = 0;

    for (
      ;
      verifyIndex < INV_SLOTS && droppedCount < dropsThisTick;
      verifyIndex++
    ) {
      var w = byIndex[verifyIndex];
      if (w && FISH_IDS.includes(w.getItemId())) {
        bot.inventory.interactAtIndex(verifyIndex, ["Drop"]);
        droppedCount++;
      }
    }

    if (verifyIndex < INV_SLOTS) {
      timeout = randomDelay(2, 3);
      return true;
    }

    // Check inventory again
    var anyFishLeft = widgets.some((w) => FISH_IDS.includes(w.getItemId()));
    if (!anyFishLeft) {
      bot.printGameMessage("All fish dropped — back to fishing!");
      inVerify = false;
      verifyIndex = 0;
      dropIndex = 0;
      return false;
    }

    bot.printLogMessage(
      "[dropFish] Some fish left — restarting snake pattern."
    );
    inVerify = false;
    verifyIndex = 0;
    dropIndex = 0;
    return true;
  }

  if (dropIndex < snakeOrder.length) {
    var dropsThisTick2 = Math.floor(Math.random() * 2) + 2;
    var dropped2 = 0;

    while (dropped2 < dropsThisTick2 && dropIndex < snakeOrder.length) {
      var slot = snakeOrder[dropIndex] - 1;
      dropIndex++;

      var w3 = byIndex[slot];
      if (w3 && FISH_IDS.includes(w3.getItemId())) {
        bot.inventory.interactAtIndex(slot, ["Drop"]);
        dropped2++;
      }
    }

    return true;
  }

  bot.printLogMessage("[dropFish] Drop complete — double checking for fish!");
  inVerify = true;
  verifyIndex = 0;
  timeout = 1;
  return true;
}

function handleRandomAfk() {
  const tick = client.getTickCount();

  // If already AFKing
  if (afkTicksRemaining > 0) {
    afkTicksRemaining--;
    if (afkTicksRemaining === 0) {
      bot.printGameMessage("Break complete — back to fishing!");
      bot.printLogMessage("[AFK] Finished short AFK, resuming.");
      nextAfkTick = tick + randomDelay(2000, 4000); // schedule next AFK 2000–4000 ticks later
    }
    return true; // still AFKing
  }

  // Schedule first AFK if not set yet
  if (nextAfkTick === 0) {
    nextAfkTick = tick + randomDelay(2000, 4000);
    return false;
  }

  if (tick >= nextAfkTick) {
    afkTicksRemaining = randomDelay(40, 100); // AFK duration
    var afkSeconds = (afkTicksRemaining * 0.6).toFixed(1);
    bot.printGameMessage(`Taking a short break for ${afkSeconds} seconds.`);
    bot.printLogMessage(
      `[AFK] Pausing for ${afkTicksRemaining} ticks (~${afkSeconds}s).`
    );
    return true;
  }

  return false;
}
