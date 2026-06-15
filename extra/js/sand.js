// -----------------------------------------------------------------------------
/*  Sand / Water Reveal Simulation

	Overview for construction:
	- Set up the canvas and its context
	- Initialize the grid and revealed arrays
	- Create the hidden barriers
	- Add a small HTML control panel from JavaScript
	- Let the cursor spawn either sand-like or water-like particles

	Water and sand are drawn on the grid.
	Sand falls down and settles.
	Water spreads horizontally and can flow over sand.
	Bees are drawn on top of the grid and move around.
*/
// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// Canvas setup
// -----------------------------------------------------------------------------

/// Get "sand-screen" element from index.html
const canvas = document.getElementById("sand-screen");

/// Let JavaScript draw rectangles, images, text, etc. onto the canvas.
const ctx = canvas.getContext("2d");


// -----------------------------------------------------------------------------
// Adjustable parameters
// -----------------------------------------------------------------------------

// Set size parameters
const cellSize = 4; // global size: water/sand/bees and signs
const signSize = 1; // local size: signs
const gapCells = 2; // local size: gap between signs

// Sets spread rate of water
const waterSpread = 5;

// Sets rate of bee spawning
const beeSpawnRate = 1000; // milliseconds between bee spawns

// All colors
const COLORS = {
	background:           "#111",
	sand:                 "#3B2D20",
	water:                "#102759",
	barrier:              "#d8d8d8",
	bee:                  "#967B11",

	buttonSelectedBg:     "#ffffff",
	buttonSelectedText:   "#111111",
	buttonUnselectedBg:   "rgba(255, 255, 255, 0.2)",
	buttonUnselectedText: "#ffffff",};

// -----------------------------------------------------------------------------
// Canvas/grid setup
// -----------------------------------------------------------------------------

// Number of columns and rows in the grid, assigned during resize()
let cols;
let rows;

// Grid and its state, including air, sand, water, bees, or barrier
let grid;

// Status: if a cell has already moved during the current frame
let moved;

// Status: if a hidden barrier cell has been discovered
let revealed;

// Cursor position and status; see updateCursorPosition
let cursorX = 0;
let cursorY = 0;
let cursorInsideCanvas = false;

// Update canvas and grid when the window is resized
function resize() {

	// Match the internal canvas resolution to the browser window size
	canvas.width  = window.innerWidth;
	canvas.height = window.innerHeight;

	// Convert screen pixels into simulation grid dimensions.
	cols = Math.floor(canvas.width / cellSize);
	rows = Math.floor(canvas.height / cellSize);

	// Uint8Array is a compact array of small integers: 0, 1, 2, 3, 4
	grid  = new Uint8Array(cols * rows);
	moved = new Uint8Array(cols * rows);

	// Revealed layer, visible if revealed[i] = 1
	revealed = new Uint8Array(cols * rows);

	// Add barriers after making a fresh grid
	makeBarriers();}

// Convert 2D grid coordinates into a 1D array index.
/// Arrays are one-dimensional, so cell (x, y) is stored at y * cols + x.
function index(x, y) {
	return y * cols + x;}

// Simple boundary check to avoid reading/writing outside the grid.
function inBounds(x, y) {
	return x >= 0 && x < cols && y >= 0 && y < rows;}


// -----------------------------------------------------------------------------
// Grid, material variables, and functional parameters
// -----------------------------------------------------------------------------

// Cell types
const AIR     = 0;
const SAND    = 1;
const BARRIER = 2;
const WATER   = 3;
const BEES    = 4;

// Current brush selected by the user
let activeMaterial = WATER;


// -----------------------------------------------------------------------------
// Bees
// -----------------------------------------------------------------------------

// Array to store all active bees
let bees = [];

// Time tracking for bee spawning
let lastBeeSpawnTime = 0;
let nextBeeSpawnDelay = beeSpawnRate + Math.random() * beeSpawnRate;

// Bee spawning
function maybeSpawnBee(time) {

	// Check conditions for spawning
	if (activeMaterial !== BEES) return;                     // active material
	if (!cursorInsideCanvas) return;                         // cursor location
	if (time - lastBeeSpawnTime < nextBeeSpawnDelay) return; // time between spawns

	// Spawn location
	const x = Math.floor(cursorX / cellSize);
	const y = Math.floor(cursorY / cellSize);

	// Check conditions for spawning
	if (!inBounds(x, y)) return;           // bounds
	if (grid[index(x, y)] !== AIR) return; // air

	// Initial conditions
	const angle = Math.random() * 2 * Math.PI;
	const speed = 0.35 + Math.random() * 0.35;

	// Spawn
	bees.push({
		x:        x + 0.5,
		y:        y + 0.5,
		vx:       speed * Math.cos(angle),
		vy:       speed * Math.sin(angle),
		nextTurn: time + 80 + Math.random() * 160,});

	// Prepare for next bee
	lastBeeSpawnTime = time;
	nextBeeSpawnDelay = beeSpawnRate + Math.random() * beeSpawnRate;}

// Bee motion: keep in bounds
function cellBlocksBee(x, y) {
	if (!inBounds(x, y)) return true;

	const i = index(x, y);
	return grid[i] !== AIR;}

// Bee motion: buzz around
function updateBees(time) {
	for (const bee of bees) {

		// Random turning
		if (time >= bee.nextTurn) {
			const turn = (Math.random() - 0.5) * 1.4;

			const cos = Math.cos(turn);
			const sin = Math.sin(turn);

			const vx = bee.vx;
			const vy = bee.vy;

			bee.vx = vx * cos - vy * sin;
			bee.vy = vx * sin + vy * cos;

			// Slight random speed variation.
			const speed = 0.35 + Math.random() * 0.35;
			const norm = Math.hypot(bee.vx, bee.vy) || 1;

			bee.vx = speed * bee.vx / norm;
			bee.vy = speed * bee.vy / norm;

			bee.nextTurn = time + 60 + Math.random() * 180;}

		const oldX = bee.x;
		const oldY = bee.y;

		const newX = bee.x + bee.vx;
		const newY = bee.y + bee.vy;

		const oldCellX = Math.floor(oldX);
		const oldCellY = Math.floor(oldY);

		const newCellX = Math.floor(newX);
		const newCellY = Math.floor(newY);

		// Try x movement separately so reflection feels wall-like.
		if (cellBlocksBee(newCellX, oldCellY)) {
			revealAround(newCellX, oldCellY);
			bee.vx *= -1;}
		else {
			bee.x = newX;}

		// Try y movement separately.
		if (cellBlocksBee(Math.floor(bee.x), newCellY)) {
			revealAround(Math.floor(bee.x), newCellY);
			bee.vy *= -1;}
		else {
			bee.y = newY;}

		// Keep bees inside the world.
		if (bee.x < 0.5) {
			bee.x = 0.5;
			bee.vx = Math.abs(bee.vx);}

		if (bee.x > cols - 1.5) {
			bee.x = cols - 1.5;
			bee.vx = -Math.abs(bee.vx);}

		if (bee.y < 0.5) {
			bee.y = 0.5;
			bee.vy = Math.abs(bee.vy);}

		if (bee.y > rows - 1.5) {
			bee.y = rows - 1.5;
			bee.vy = -Math.abs(bee.vy);}
	}
}

// -----------------------------------------------------------------------------
// Material selector UI
// -----------------------------------------------------------------------------

/// Create the material selector UI
function makeMaterialSelector() {

	// Define the panel element for the material selector
	const panel = document.createElement("div");

	// Inherit CSS properties
	panel.id = "material-selector";

	// Create buttons for each material defined earlier
	const materials = [
		{ label: "Sand",  value: SAND  },
		{ label: "Water", value: WATER },
		{ label: "Bees",  value: BEES  },];

	// Loop through each material and create a button for it
	for (const material of materials) {
		const button = document.createElement("button");
		button.textContent = material.label;
		button.type = "button";
		button.dataset.material = material.value;

		button.addEventListener("click", () => {
			setActiveMaterial(material.value);});

		panel.appendChild(button);}

	document.body.appendChild(panel);
	setActiveMaterial(activeMaterial);}

// Set the active material for the brush
function setActiveMaterial(material) {
	activeMaterial = material;

	// Remove old cursor classes.
	document.body.classList.remove("brush-sand", "brush-water", "brush-bees");

	// Add the class corresponding to the selected material.
	if (activeMaterial === SAND) {
		document.body.classList.add("brush-sand");}
	
	else if (activeMaterial === WATER) {
		document.body.classList.add("brush-water");}
	
	else if (activeMaterial === BEES) {
		document.body.classList.add("brush-bees");}

	// Update the button to highlight selected material
	const buttons = document.querySelectorAll("#material-selector button");

	for (const button of buttons) {
		const selected = Number(button.dataset.material) === activeMaterial;

		button.style.background = selected ? COLORS.buttonSelectedBg : "rgba(255, 255, 255, 0.2)";
		button.style.color = selected ? COLORS.buttonSelectedText : COLORS.buttonUnselectedText;}
}

// -----------------------------------------------------------------------------
// Buttons
// -----------------------------------------------------------------------------

// List of all clickable regions on the canvas
const canvasButtons = [];

// Is the pointer inside this rectangle?
function pointInsideRect(px, py, rect) {
	return (
		px >= rect.x &&
		px <= rect.x + rect.width &&
		py >= rect.y &&
		py <= rect.y + rect.height);}

// Add a new button to the canvas
function addCanvasButton(name, x, y, width, height, onClick) {
	canvasButtons.push({
		name,
		x,
		y,
		width,
		height,
		onClick,});}

// Change cursor for clickable regions
function updateCursorRegion(px, py) {
	for (const button of canvasButtons) {
		if (pointInsideRect(px, py, button)) {
			document.body.classList.add("over-canvas-button");
			return;}}

	document.body.classList.remove("over-canvas-button");}

// -----------------------------------------------------------------------------
// Hidden barrier construction
// -----------------------------------------------------------------------------

const enterSignPattern = [
	"11111111111111111111111111111111111111111111111111111111111111111111111111111111111",
	"1.................................................................................1",
	"1.....................111111..11.....11.11111111..1111..111111....................1",
	"1....................11....11.11.....11.11.....11.1111.11....11...................1",
	"1....................11.......11.....11.11.....11..11..11.........................1",
	"1....................11.......11.....11.11111111..11....111111....................1",
	"1....................11.......11.....11.11...................11...................1",
	"1....................11....11.11.....11.11.............11....11...................1",
	"1.....................111111...1111111..11..............111111....................1",
	"1.................................................................................1",
	"1...111111..11.....11.11111111..11111111...1111111.....111....11111111..11111111..1",
	"1..11....11.11.....11.11.....11.11.....11.11.....11...11.11...11.....11.11.....11.1",
	"1..11.......11.....11.11.....11.11.....11.11.....11..11...11..11.....11.11.....11.1",
	"1..11.......11.....11.11111111..11111111..11.....11.11.....11.11111111..11.....11.1",
	"1..11.......11.....11.11........11.....11.11.....11.111111111.11...11...11.....11.1",
	"1..11....11.11.....11.11........11.....11.11.....11.11.....11.11....11..11.....11.1",
	"1...111111...1111111..11........11111111...1111111..11.....11.11.....11.11111111..1",
	"1.................................................................................1",
	"11111111111111111111111111111111111111111111111111111111111111111111111111111111111",];

const aboutSignPattern = [
	"1111111111111111111111111111111111111",
	"1...................................1",
	"1...11...11111...1111..1....1.11111.1",
	"1..1..1..1....1.1....1.1....1...1...1",
	"1.1....1.11111..1....1.1....1...1...1",
	"1.111111.1....1.1....1.1....1...1...1",
	"1.1....1.1....1.1....1.1....1...1...1",
	"1.1....1.11111...1111...1111....1...1",
	"1...................................1",
	"1111111111111111111111111111111111111",];

const blogSignPattern = [
	"1111111111111111111111111111111",
	"1.............................1",
	"1.11111..1.......1111...1111..1",
	"1.1....1.1......1....1.1....1.1",
	"1.11111..1......1....1.1......1",
	"1.1....1.1......1....1.1..111.1",
	"1.1....1.1......1....1.1....1.1",
	"1.11111..111111..1111...1111..1",
	"1.............................1",
	"1111111111111111111111111111111",];

// Premade barriers, drawn when revealed[i] = 1
function makeBarriers() {

	// Clear previous buttons.
	canvasButtons.length = 0;

	// -------------------------------------------------------------------------
	// ENTER sign
	// -------------------------------------------------------------------------

	const enterWidthCells = enterSignPattern[0].length * signSize;
	const enterHeightCells = enterSignPattern.length * signSize;

	const enterXCells = Math.floor((cols - enterWidthCells) / 2);
	const enterYCells = Math.floor(rows * 0.28);

	addBarrierPattern(enterSignPattern, enterXCells, enterYCells, signSize);

	addCanvasButton(
		"enter",
		enterXCells * cellSize,
		enterYCells * cellSize,
		enterWidthCells * cellSize,
		enterHeightCells * cellSize,
		() => {
			window.location.href = "../home.html";});

	// -------------------------------------------------------------------------
	// ABOUT and BLOG signs
	// -------------------------------------------------------------------------

	const aboutWidthCells = aboutSignPattern[0].length * signSize;
	const aboutHeightCells = aboutSignPattern.length * signSize;

	const blogWidthCells = blogSignPattern[0].length * signSize;
	const blogHeightCells = blogSignPattern.length * signSize;

	const totalLowerWidthCells = aboutWidthCells + gapCells + blogWidthCells;

	const lowerYCells = enterYCells + enterHeightCells + gapCells;
	const lowerRowOffsetCells = -1;
	const aboutXCells = Math.floor((cols - totalLowerWidthCells) / 2) + lowerRowOffsetCells;
	const blogXCells = aboutXCells + aboutWidthCells + gapCells;

	addBarrierPattern(aboutSignPattern, aboutXCells, lowerYCells, signSize);
	addBarrierPattern(blogSignPattern, blogXCells, lowerYCells, signSize);

	addCanvasButton(
		"about",
		aboutXCells * cellSize,
		lowerYCells * cellSize,
		aboutWidthCells * cellSize,
		aboutHeightCells * cellSize,
		() => {
			window.location.href = "../about.html";});

	addCanvasButton(
		"blog",
		blogXCells * cellSize,
		lowerYCells * cellSize,
		blogWidthCells * cellSize,
		blogHeightCells * cellSize,
		() => {
			window.location.href = "../blog/index.html";});
}

// Place a barrier according to each pattern
function addBarrierPattern(pattern, x0, y0, scale = 1) {
	// 1 means barrier and . means air

	for (let row = 0; row < pattern.length; row++) {
		for (let col = 0; col < pattern[row].length; col++) {

			// Barrier cells
			if (pattern[row][col] !== "1") continue;

			// Apply scaling
			for (let sy = 0; sy < scale; sy++) {
				for (let sx = 0; sx < scale; sx++) {
					const x = x0 + col * scale + sx;
					const y = y0 + row * scale + sy;

					if (inBounds(x, y)) {
						grid[index(x, y)] = BARRIER;}
				}
			}
		}
	}
}

// -----------------------------------------------------------------------------
// User interaction: cursor creates particles
// -----------------------------------------------------------------------------

function updateCursorPosition(e) {
	cursorX = e.clientX;
	cursorY = e.clientY;
	cursorInsideCanvas = true;}

function spawnMaterial(px, py) {
	/* Sets the active material for the brush. */

	// Bees
	if (activeMaterial === BEES) return;

	// px, py are browser pixel coordinates from the pointer event.
	// Convert them to grid coordinates by dividing by cellSize.
	const cx = Math.floor(px / cellSize);
	const cy = Math.floor(py / cellSize);

	// Radius of the circular brush, measured in grid cells.
	const radius = 3;

	// Loop over a square region around the cursor.
	for (let dy = -radius; dy <= radius; dy++) {
		for (let dx = -radius; dx <= radius; dx++) {

			// Circular brush
			if (dx * dx + dy * dy > radius * radius) continue;

			const x = cx + dx;
			const y = cy + dy;

			if (!inBounds(x, y)) continue;

			const i = index(x, y);

			// Only place material into empty air
			if (grid[i] === AIR) {
				grid[i] = activeMaterial;}
		}
	}
}

// -----------------------------------------------------------------------------
// Reveal logic
// -----------------------------------------------------------------------------

function revealAround(x, y) {
	// When a particle hits something, reveal nearby barrier cells.
	// This makes the hidden structure appear gradually around contact points.

	for (let dy = -4; dy <= 4; dy++) {
		for (let dx = -4; dx <= 4; dx++) {
			const nx = x + dx;
			const ny = y + dy;

			if (!inBounds(nx, ny)) continue;

			const i = index(nx, ny);

			if (grid[i] === BARRIER) {
				revealed[i] = 1;}
		}
	}
}

// -----------------------------------------------------------------------------
// Particle physics helpers
// -----------------------------------------------------------------------------

function moveParticle(fromIndex, toIndex, material) {
	// Move one particle and mark the destination as already updated.
	// The moved array is reset once per frame in updateParticles().
	grid[toIndex] = material;
	grid[fromIndex] = AIR;
	moved[toIndex] = 1;}

function swapParticles(indexA, indexB) {
	// Swap two cells in the grid.
	// This is useful for density-like behavior:
	// sand is "heavier" than water, so sand can trade places with water.
	const temp = grid[indexA];

	grid[indexA] = grid[indexB];
	grid[indexB] = temp;

	// Mark both cells as moved this frame.
	// This prevents the swapped particles from moving again immediately.
	moved[indexA] = 1;
	moved[indexB] = 1;}

function tryMove(x, y, nx, ny, material) {
	/* A small helper so the sand and water rules can share movement code. */

	if (!inBounds(nx, ny)) return false;

	const fromIndex = index(x, y);
	const toIndex   = index(nx, ny);

	// Normal movement: particles can move into empty air
	if (grid[toIndex] === AIR) {
		moveParticle(fromIndex, toIndex, material);
		return true;}

	// Sand falling into water
	if (material === SAND && grid[toIndex] === WATER) {

		// First try to move the WATER sideways, not the sand.
		// The water is at (nx, ny), so displacement should start there.
		if (tryMove(nx, ny, nx + 1, ny, WATER)) {
			moveParticle(fromIndex, toIndex, SAND);
			return true;}

		if (tryMove(nx, ny, nx - 1, ny, WATER)) {
			moveParticle(fromIndex, toIndex, SAND);
			return true;}

		// Last recourse: vertical swap
		swapParticles(fromIndex, toIndex);
		return true;}

	return false;}


// -----------------------------------------------------------------------------
// Sand and water physics
// -----------------------------------------------------------------------------

// Make sand fall or flow
function updateSandCell(x, y) {

	// Current location
	const i = index(x, y);

	// Allow sand to fall into AIR or swap with WATER
	if (tryMove(x, y, x, y + 1, SAND)) return;

	// Reveal hidden barriers if blocked below
	revealAround(x, y + 1);

	// Randomize diagonal direction
	const dir = Math.random() < 0.5 ? -1 : 1;

	if (tryMove(x, y, x + dir, y + 1, SAND)) return;
	if (tryMove(x, y, x - dir, y + 1, SAND)) return;}

// Make water fall or flow
function updateWaterCell(x, y) {

	// Current location and cell directly below	
	const i     = index(x, y);
	const below = index(x, y + 1);

	// Reveals barriers
	revealAround(x, y + 1);

	// Move downward: no barriers or particles below
	if (grid[below] === AIR) {
		moveParticle(i, below, WATER);
		return;}

	// Move downward diagonal: 0.5 sets equal probability for left (-1) and right (1)
	const dir = Math.random() < 0.5 ? -1 : 1;
	if (tryMove(x, y, x + dir, y + 1, WATER)) return;
	if (tryMove(x, y, x - dir, y + 1, WATER)) return;

	// Move horizontal: checks farther cells one by one, so water can flow across ledges
	// While distance is less than waterSpread, try to move
	for (let distance = 1; distance <= waterSpread; distance++) {
		const x1 = x + dir * distance;
		const x2 = x - dir * distance;

		if (tryMove(x, y, x1, y, WATER)) return;
		if (tryMove(x, y, x2, y, WATER)) return;}}

// Update the positions of all particles
function updateParticles() {

	// Reset per-frame movement bookkeeping.
	moved.fill(0);

	// Update from bottom to top
	for (let y = rows - 2; y >= 0; y--) {

		// Randomize horizontal scan direction for each row
		const leftToRight = Math.random() < 0.5;
		for (let n = 0; n < cols; n++) {

			// Identify current cell
			const x = leftToRight ? n : cols - 1 - n;
			const i = index(x, y);
			const cell = grid[i];

			// Wait until the next frame if moved
			if (moved[i]) continue;

			// Update the cell based on its type
			if (cell === SAND) {
				updateSandCell(x, y);}
			
			else if (cell === WATER) {
				updateWaterCell(x, y);}
		}
	}
}

// -----------------------------------------------------------------------------
// Drawing
// -----------------------------------------------------------------------------

function draw() {

	// Clear the full canvas each frame
	ctx.fillStyle = COLORS.background;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Draw every visible cell
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < cols; x++) {
			const i = index(x, y);
			const cell = grid[i];

			// Sand color
			if (cell === SAND) {
				ctx.fillStyle = COLORS.sand;

			// Water color
			} else if (cell === WATER) {
				ctx.fillStyle = COLORS.water;

			// Barrier color
			} else if (cell === BARRIER && revealed[i]) {
				ctx.fillStyle = COLORS.barrier;
			
			} else {
				// Air and unrevealed barriers are not drawn.
				continue;
			}

			// Draw one grid cell as a square on the canvas.
			// Multiplying by cellSize maps grid coordinates back to pixels.
			ctx.fillRect(
				x * cellSize,
				y * cellSize,
				cellSize,
				cellSize
			);
		}
	}

	// Draw bees after the grid, so they appear on top.
	for (const bee of bees) {
		ctx.fillStyle = COLORS.bee;

		ctx.fillRect(
			Math.floor(bee.x * cellSize),
			Math.floor(bee.y * cellSize),
			cellSize,
			cellSize
		);
	}
}


// -----------------------------------------------------------------------------
// Animation loop
// -----------------------------------------------------------------------------

function loop(time = 0) {

	// Bees (spawn)
	maybeSpawnBee(time);

	// Advance the simulation
	updateParticles();

	// Bees (move)
	updateBees(time);

	// Draw the current state of the simulation
	draw();

	// Ask the browser to call loop() again before the next repaint
	// This is the standard way to animate with JavaScript
	requestAnimationFrame(loop);
}


// -----------------------------------------------------------------------------
// Browser event hooks
// -----------------------------------------------------------------------------

let isDrawing = false;

canvas.addEventListener("pointerdown", (e) => {
	updateCursorPosition(e);

	const x = e.clientX;
	const y = e.clientY;

	for (const button of canvasButtons) {
		if (pointInsideRect(x, y, button)) {
			button.onClick();
			return;
		}
	}

	isDrawing = true;
	canvas.setPointerCapture(e.pointerId);
	spawnMaterial(x, y);
});

canvas.addEventListener("pointermove", (e) => {
	updateCursorPosition(e);

	// Enter a clickable region.
	updateCursorRegion(e.clientX, e.clientY);

	// On touchscreens, require touch-and-drag.
	if (e.pointerType === "touch" && !isDrawing) return;

	// On mouse, preserve the old behavior: just moving the cursor drops material.
	spawnMaterial(e.clientX, e.clientY);
});

// Leave a clickable region
canvas.addEventListener("pointerleave", () => {
	cursorInsideCanvas = false;
	document.body.classList.remove("over-canvas-button");
});

canvas.addEventListener("pointerup", (e) => {
	isDrawing = false;
	canvas.releasePointerCapture(e.pointerId);
});

canvas.addEventListener("pointercancel", () => {
	isDrawing = false;
});

window.addEventListener("resize", resize);
// If the browser window changes size, rebuild the canvas and grid.
// This keeps the canvas fullscreen, matching the CSS layout.


// -----------------------------------------------------------------------------
// Start the program
// -----------------------------------------------------------------------------

// Create the Sand/Water buttons.
makeMaterialSelector();

// Initialize canvas size, grid arrays, and hidden barriers.
resize();

// Begin the animation.
loop();

// -----------------------------------------------------------------------------