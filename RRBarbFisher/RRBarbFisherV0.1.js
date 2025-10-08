// Initial Config
var timeout = 0;
var state = 'IDLE'; // initial state
var fishingSpotID = 1542; // Barbarian Fishing spot ID
var fishIDs = [11328, 11330, 11332]; // Leaping trout, salmon, sturgeon
var rodID = 11323; // Barbarian rod
var baitID = 314; // Feather
var bugCounterMin = 0; // consecutive failure counter
var bugCounterMax = 5; // stop after this many fails
var dropEnabled = true;

// Start Script
function onStart() {
	bot.printGameMessage("Ravioli Ron's Barbarian Fishing Script started!");
	bot.printLogMessage('[START] State set to IDLE.');
	state = 'IDLE';
}

// Random delay function
function randomDelay(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Main loop
function onGameTick() {
	bot.printLogMessage(`[TICK] Current state: ${state}, Timeout: ${timeout}`);

	if (timeout > 0) {
		timeout--;
		bot.printLogMessage(`[WAIT] Waiting ${timeout} more tick(s).`);
		return;
	}

	switch (state) {
		case 'IDLE':
			bot.printLogMessage('[STATE] Executing findFishingSpot()');
			findFishingSpot();
			break;

		case 'FISHING':
			bot.printLogMessage('[STATE] Executing monitorFishing()');
			monitorFishing();
			break;

		case 'DROPPING':
			bot.printLogMessage('[STATE] Executing dropFish()');
			var stillFish = dropFish();
			if (!stillFish) {
				bot.printLogMessage(
					'[DROPPING] Inventory cleared. Returning to IDLE.',
				);
				state = 'IDLE';
				break;
			}
	}
}
// Find fishing spot
function findFishingSpot() {
	bot.printLogMessage('[findFishingSpot] Searching for fishing spot...');

	// Get all fishing spot's
	var fishingSpots = bot.npcs.getWithIds([fishingSpotID]);

	// Pass that array to getClosest()
	var spot = bot.npcs.getClosest(fishingSpots);

	// Handle missing spot
	if (!spot) {
		bugCounterMin++;
		bot.printLogMessage(
			`[findFishingSpot] No fishing spot found. Fail count: ${bugCounterMin}`,
		);
		timeout = randomDelay(2, 5);

		if (bugCounterMin >= bugCounterMax) {
			bot.printLogMessage(
				'[findFishingSpot] Too many failures — stopping script.',
			);
			bot.terminate();
		}
		return;
	}

	// Check for equipment and bait
	if (
		!bot.inventory.containsAnyIds([baitID]) ||
		!bot.inventory.containsAnyIds([rodID])
	) {
		bugCounterMin++;
		bot.printLogMessage(
			`[findFishingSpot] Missing feathers or rod! Fail count: ${bugCounterMin}`,
		);
		timeout = randomDelay(2, 10);

		if (bugCounterMin >= bugCounterMax) {
			bot.printLogMessage(
				'[findFishingSpot] Too many missing-gear errors — stopping script.',
			);
			bot.terminate();
		}
		return;
	}

	// Interact with the found spot
	bugCounterMin = 0;
	bot.printLogMessage(`[findFishingSpot] Interacting with fishing spot`);
	bot.printLogMessage(
		`[findFishingSpot] ${spot.getName()} at ${spot.getWorldLocation()}`,
	);

	bot.npcs.interactSupplied(spot, 'Use-rod');
	bot.printLogMessage(
		'[findFishingSpot] Interaction sent. Switching to FISHING state.',
	);
	bot.printGameMessage("Let's catch them fishies!");
	state = 'FISHING';
	timeout = randomDelay(8, 15);
}

// Monitor fishing
function monitorFishing() {
	var anim = client.getLocalPlayer().getAnimation();
	bot.printLogMessage(`[monitorFishing] Animation: ${anim}`);

	if (anim === 9350) {
		bot.printLogMessage('[monitorFishing] Currently fishing.');
		return;
	}

	if (bot.inventory.getEmptySlots() === 0) {
		bot.printLogMessage('[monitorFishing] Inventory full!');
		if (dropEnabled) {
			state = 'DROPPING';
			bot.printLogMessage(
				'[monitorFishing] Drop mode enabled — switching to DROPPING state.',
			);
		} else {
			bot.printLogMessage(
				'[monitorFishing] Drop disabled — stopping script.',
			);
			bot.terminate();
		}
		return;
	}

	bot.printLogMessage(
		'[monitorFishing] Not fishing or inventory not full — switching to IDLE.',
	);
	state = 'IDLE';
}

// Drop fish
function dropFish() {
	var inventoryWidgets = bot.inventory.getAllWidgets();
	var dropsThisTick = Math.floor(Math.random() * (3 - 2 + 1)) + 2;
	var droppedCount = 0;
	bot.printLogMessage(
		`[dropFish] Attempting to drop ${dropsThisTick} fish this tick.`,
	);

	for (var i = 0; i < inventoryWidgets.length; i++) {
		if (droppedCount >= dropsThisTick) break;

		var widget = inventoryWidgets[i];
		var itemId = widget.getItemId();

		if (fishIDs.includes(itemId)) {
			var itemName = client.getItemDefinition(itemId).getName();
			bot.inventory.interactAtIndex(widget.getIndex(), ['Drop']);
			bot.printLogMessage(
				`[dropFish] Dropping ${itemName} (slot ${widget.getIndex()}).`,
			);
			droppedCount++;
		}
	}

	// Check if any fish remain
	var fishLeft = false;
	var widgets = bot.inventory.getAllWidgets();
	for (var j = 0; j < widgets.length; j++) {
		var itemId2 = widgets[j].getItemId();
		if (fishIDs.includes(itemId2)) {
			fishLeft = true;
			break;
		}
	}

	if (!fishLeft) {
		bot.printLogMessage('[dropFish] Inventory clear — all fish dropped.');
		bot.printGameMessage('Fish dropped, back to work!');
	}

	return fishLeft;
}
