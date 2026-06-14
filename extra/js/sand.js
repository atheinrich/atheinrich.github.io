// -----------------------------------------------------------------------------
/*  Sand / Water Reveal Simulation

	Overview for construction:
	- Set up the canvas and its context.
	- Initialize the grid and revealed arrays.
	- Create the hidden barriers.
	- Add a small HTML control panel from JavaScript.
	- Let the cursor spawn either sand-like or water-like particles.
*/


// Grab the <canvas id="sand-screen"> element from index.html.
// The canvas is the drawable region where the particle simulation appears.
const canvas = document.getElementById("sand-screen");

// Get the 2D drawing context.
// This is the ordinary, widely-supported Canvas API.
// It lets JavaScript draw rectangles, images, paths, text, etc. onto the canvas.
const ctx = canvas.getContext("2d");


// -----------------------------------------------------------------------------
// Simulation settings
// -----------------------------------------------------------------------------

// Each simulated cell is drawn as a cellSize × cellSize pixel square.
// Larger cellSize = fewer cells = faster, chunkier particles.
// Smaller cellSize = more cells = slower, finer particles.
const cellSize = 4;

// Water tries to move horizontally when it cannot move downward.
// Larger values make water spread out more aggressively.
const waterSpread = 5;

// These will be assigned during resize(), once the browser window size is known.
let cols;
let rows;

// grid stores the actual state of the world:
// air, sand, water, or barrier.
let grid;

// moved stores whether a cell has already moved during the current frame.
// This prevents a particle from moving multiple times in one animation frame.
let moved;

// revealed stores whether a hidden barrier cell has been discovered by particles.
// This lets barriers exist physically before they are visually shown.
let revealed;


// Cell type labels.
// Numbers are used because typed arrays store numbers efficiently.
const AIR = 0;
const SAND = 1;
const BARRIER = 2;
const WATER = 3;

// The current brush selected by the user.
// This is changed by the Sand/Water buttons created below.
let activeMaterial = SAND;


// -----------------------------------------------------------------------------
// Material selector UI
// -----------------------------------------------------------------------------

function makeMaterialSelector() {
	// This function creates the selector entirely from JavaScript.
	// That means you do not need to add new HTML by hand.
	const panel = document.createElement("div");
	panel.id = "material-selector";

	// Inline styles are fine for a small self-contained widget.
	// For a larger project, these would usually move into the CSS file.
	panel.style.position = "fixed";
	panel.style.top = "1rem";
	panel.style.left = "1rem";
	panel.style.zIndex = "10";
	panel.style.display = "flex";
	panel.style.gap = "0.5rem";
	panel.style.padding = "0.5rem";
	panel.style.background = "rgba(0, 0, 0, 0.45)";
	panel.style.backdropFilter = "blur(4px)";
	panel.style.border = "1px solid rgba(255, 255, 255, 0.25)";
	panel.style.borderRadius = "999px";

	const materials = [
		{ label: "Sand", value: SAND },
		{ label: "Water", value: WATER },
	];

	for (const material of materials) {
		const button = document.createElement("button");
		button.textContent = material.label;
		button.type = "button";
		button.dataset.material = material.value;

		button.style.border = "0";
		button.style.borderRadius = "999px";
		button.style.padding = "0.45rem 0.8rem";
		button.style.font = "inherit";

		button.addEventListener("click", () => {
			setActiveMaterial(material.value);
		});

		panel.appendChild(button);
	}

	document.body.appendChild(panel);
	setActiveMaterial(activeMaterial);
}

function setActiveMaterial(material) {
	activeMaterial = material;

	// Remove old cursor classes.
	document.body.classList.remove("brush-sand", "brush-water");

	// Add the class corresponding to the selected material.
	if (activeMaterial === SAND) {
		document.body.classList.add("brush-sand");
	} else if (activeMaterial === WATER) {
		document.body.classList.add("brush-water");
	}

	// Update the button appearance so the selected material is obvious.
	const buttons = document.querySelectorAll("#material-selector button");

	for (const button of buttons) {
		const selected = Number(button.dataset.material) === activeMaterial;

		button.style.background = selected ? "#ffffff" : "rgba(255, 255, 255, 0.2)";
		button.style.color = selected ? "#111111" : "#ffffff";
	}
}

// -----------------------------------------------------------------------------
// Canvas/grid setup
// -----------------------------------------------------------------------------

function resize() {
	// Match the internal canvas resolution to the browser window size.
	// CSS makes the canvas fill the page visually; these values define the
	// actual drawing resolution used by JavaScript.
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	// Convert screen pixels into simulation grid dimensions.
	// Example: a 1000px-wide canvas with cellSize = 4 gives 250 columns.
	cols = Math.floor(canvas.width / cellSize);
	rows = Math.floor(canvas.height / cellSize);

	// Uint8Array is a compact array of small integers.
	// It is perfect here because each cell only needs values like 0, 1, 2, 3.
	grid = new Uint8Array(cols * rows);
	moved = new Uint8Array(cols * rows);

	// Separate reveal layer.
	// A barrier may exist in grid, but only becomes visible if revealed[i] = 1.
	revealed = new Uint8Array(cols * rows);

	// Add the preset hidden barriers after making a fresh grid.
	makeBarriers();
}


// Convert 2D grid coordinates into a 1D array index.
// Arrays are one-dimensional, so cell (x, y) is stored at y * cols + x.
function index(x, y) {
	return y * cols + x;
}


// Simple boundary check to avoid reading/writing outside the grid.
function inBounds(x, y) {
	return x >= 0 && x < cols && y >= 0 && y < rows;
}


// -----------------------------------------------------------------------------
// Buttons
// -----------------------------------------------------------------------------

// Is the pointer inside this rectangle?
function pointInsideRect(px, py, rect) {
	return (
		px >= rect.x &&
		px <= rect.x + rect.width &&
		py >= rect.y &&
		py <= rect.y + rect.height
	);
}

let enterButton;

// -----------------------------------------------------------------------------
// Hidden barrier construction
// -----------------------------------------------------------------------------

const enterSignPattern = [
	"111111111111111111111111111111111111111",
	"1.....................................1",
	"1.1111.1...1.11111.11111.1111.........1",
	"1.1....11..1...1...1.....1...1........1",
	"1.111..1.1.1...1...111...1111.........1",
	"1.1....1..11...1...1.....1..1.........1",
	"1.1111.1...1...1...11111.1...1........1",
	"1.....................................1",
	"1.............1...1.1111.1111.11111...1",
	"1.............1...1.1....1..1.1.......1",
	"1.............11111.111..1111.111.....1",
	"1.............1...1.1....1.1..1.......1",
	"1.............1...1.1111.1..1.11111...1",
	"1.....................................1",
	"111111111111111111111111111111111111111",
];

function makeBarriers() {
	// Barriers are part of the physical simulation from the beginning.
	// Sand and water will collide with them immediately.
	//
	// However, they are not drawn until revealed[i] = 1.
	// This gives the "particles reveal the hidden structure" effect.

	const scale = 3;

	const signWidthCells = enterSignPattern[0].length * scale;
	const signHeightCells = enterSignPattern.length * scale;

	const signXCells = Math.floor((cols - signWidthCells) / 2);
	const signYCells = Math.floor(rows * 0.38);

	addBarrierPattern(enterSignPattern, signXCells, signYCells, scale);

	// The pointer event gives us pixel coordinates.
	// The barrier pattern uses grid-cell coordinates.
	// So we multiply by cellSize to convert from grid cells back to pixels.
	enterButton = {
		x: signXCells * cellSize,
		y: signYCells * cellSize,
		width: signWidthCells * cellSize,
		height: signHeightCells * cellSize,
	};

	/* Old
	// Bowl-shaped barrier near the bottom.
	for (let x = 0; x < cols; x++) {
		// dx measures horizontal distance from the center.
		const dx = x - cols * 0.5;

		// A simple parabola: y = base + curvature * dx^2.
		// This creates a shallow bowl.
		const y = Math.floor(rows * 0.72 + 0.003 * dx * dx);

		// Give the barrier a few cells of thickness so particles cannot slip through.
		for (let t = 0; t < 3; t++) {
			if (inBounds(x, y + t)) {
				grid[index(x, y + t)] = BARRIER;
			}
		}
	}


	// Left slanted ramp.
	for (let x = Math.floor(cols * 0.1); x < Math.floor(cols * 0.42); x++) {
		// Linear function in x.
		// As x increases, y increases, so the ramp slopes downward right.
		const y = Math.floor(rows * 0.45 + 0.35 * (x - cols * 0.1));

		for (let t = 0; t < 3; t++) {
			if (inBounds(x, y + t)) {
				grid[index(x, y + t)] = BARRIER;
			}
		}
	}


	// Right slanted ramp.
	for (let x = Math.floor(cols * 0.58); x < Math.floor(cols * 0.9); x++) {
		// This slope has the opposite sign, so it leans the other way.
		const y = Math.floor(rows * 0.58 - 0.32 * (x - cols * 0.58));

		for (let t = 0; t < 3; t++) {
			if (inBounds(x, y + t)) {
				grid[index(x, y + t)] = BARRIER;
			}
		}
	}
	*/
}

function addBarrierPattern(pattern, x0, y0, scale = 1) {
	// pattern is an array of strings.
	// Each character represents one tiny "pixel" of the hidden barrier.
	//
	// Example:
	// "111"
	// "1.1"
	// "111"
	//
	// Here, "1" means barrier and "." means empty space.

	for (let row = 0; row < pattern.length; row++) {
		for (let col = 0; col < pattern[row].length; col++) {
			// Only the marked cells become barriers.
			// Everything else is ignored, leaving whatever was already in the grid.
			if (pattern[row][col] !== "1") continue;

			// scale lets each pattern cell become a larger block.
			// scale = 1 gives tiny pixel art.
			// scale = 3 makes every pattern cell a 3x3 block.
			for (let sy = 0; sy < scale; sy++) {
				for (let sx = 0; sx < scale; sx++) {
					const x = x0 + col * scale + sx;
					const y = y0 + row * scale + sy;

					if (inBounds(x, y)) {
						grid[index(x, y)] = BARRIER;
					}
				}
			}
		}
	}
}

// -----------------------------------------------------------------------------
// User interaction: cursor creates particles
// -----------------------------------------------------------------------------

function spawnMaterial(px, py) {
	// px, py are browser pixel coordinates from the pointer event.
	// Convert them to grid coordinates by dividing by cellSize.
	const cx = Math.floor(px / cellSize);
	const cy = Math.floor(py / cellSize);

	// Radius of the circular brush, measured in grid cells.
	const radius = 3;

	// Loop over a square region around the cursor.
	for (let dy = -radius; dy <= radius; dy++) {
		for (let dx = -radius; dx <= radius; dx++) {
			// Keep only points inside a circle.
			// This avoids a square-looking brush.
			if (dx * dx + dy * dy > radius * radius) continue;

			const x = cx + dx;
			const y = cy + dy;

			if (!inBounds(x, y)) continue;

			const i = index(x, y);

			// Only place material into empty air.
			// This prevents the cursor from overwriting barriers or existing particles.
			if (grid[i] === AIR) {
				grid[i] = activeMaterial;
			}
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
				revealed[i] = 1;
			}
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
	moved[toIndex] = 1;
}

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
	moved[indexB] = 1;
}

function tryMove(x, y, nx, ny, material) {
	// A small helper so the sand and water rules can share movement code.
	if (!inBounds(nx, ny)) return false;

	const fromIndex = index(x, y);
	const toIndex = index(nx, ny);

	// Normal movement: particles can move into empty air.
	if (grid[toIndex] === AIR) {
		moveParticle(fromIndex, toIndex, material);
		return true;
	}

	// Density rule:
	// sand is heavier than water, so sand can sink through water.
	//
	// Rather than deleting the water, we swap the two cells.
	// This makes the water appear displaced upward while sand falls downward.
	if (material === SAND && grid[toIndex] === WATER) {
		swapParticles(fromIndex, toIndex);
		return true;
	}

	return false;
}

// -----------------------------------------------------------------------------
// Sand physics
// -----------------------------------------------------------------------------

function updateSandCell(x, y) {
	// Sand is granular and denser than water:
	// 1. Fall straight down through air.
	// 2. Sink through water by swapping places with it.
	// 3. Otherwise, slide diagonally.
	// 4. If neither diagonal works, stay in place and form a pile.
	const i = index(x, y);

	// Use tryMove here instead of directly checking AIR.
	// This allows sand to fall into AIR or swap with WATER.
	if (tryMove(x, y, x, y + 1, SAND)) return;

	// If blocked below, reveal nearby hidden barriers.
	revealAround(x, y + 1);

	// Randomize which diagonal direction gets tried first.
	// This avoids making every pile lean the same way.
	const dir = Math.random() < 0.5 ? -1 : 1;

	if (tryMove(x, y, x + dir, y + 1, SAND)) return;
	if (tryMove(x, y, x - dir, y + 1, SAND)) return;
}


// -----------------------------------------------------------------------------
// Water physics
// -----------------------------------------------------------------------------

function updateWaterCell(x, y) {
	// Water is more fluid than sand:
	// 1. Fall straight down if possible.
	// 2. Otherwise, try diagonal downward motion.
	// 3. Otherwise, search sideways for an open cell.
	//
	// This is not a full fluid simulation. It is a cellular-automaton trick that
	// gives a convincing "fall and spread" behavior with very little code.
	const i = index(x, y);
	const below = index(x, y + 1);

	if (grid[below] === AIR) {
		moveParticle(i, below, WATER);
		return;
	}

	// Water also reveals barriers when it runs into them or other particles.
	revealAround(x, y + 1);

	// First try to slip downward diagonally, like sand.
	const dir = Math.random() < 0.5 ? -1 : 1;

	if (tryMove(x, y, x + dir, y + 1, WATER)) return;
	if (tryMove(x, y, x - dir, y + 1, WATER)) return;

	// If there is no downward option, spread horizontally.
	// The loop checks farther cells one by one, so water can flow across ledges.
	for (let distance = 1; distance <= waterSpread; distance++) {
		const x1 = x + dir * distance;
		const x2 = x - dir * distance;

		if (tryMove(x, y, x1, y, WATER)) return;
		if (tryMove(x, y, x2, y, WATER)) return;
	}
}


// -----------------------------------------------------------------------------
// Main physics update
// -----------------------------------------------------------------------------

function updateParticles() {
	// Reset per-frame movement bookkeeping.
	moved.fill(0);

	// We update from bottom to top.
	//
	// Why?
	// If we updated top to bottom, a particle could fall into a cell and then
	// immediately be updated again in the same frame, making it fall too fast.
	for (let y = rows - 2; y >= 0; y--) {
		// Randomize horizontal scan direction each row.
		// This reduces artificial left/right bias in the pile and flow shapes.
		const leftToRight = Math.random() < 0.5;

		for (let n = 0; n < cols; n++) {
			const x = leftToRight ? n : cols - 1 - n;
			const i = index(x, y);
			const cell = grid[i];

			// A cell that just moved into this location waits until the next frame.
			if (moved[i]) continue;

			if (cell === SAND) {
				updateSandCell(x, y);
			} else if (cell === WATER) {
				updateWaterCell(x, y);
			}
		}
	}
}


// -----------------------------------------------------------------------------
// Drawing
// -----------------------------------------------------------------------------

function draw() {
	// Clear the full canvas each frame.
	// The CSS gives the page its background, but the canvas itself is redrawn
	// every animation frame.
	ctx.fillStyle = "#111";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Draw every visible cell.
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < cols; x++) {
			const i = index(x, y);
			const cell = grid[i];

			if (cell === SAND) {
				// Sand color.
				ctx.fillStyle = "#d6b45f";
			} else if (cell === WATER) {
				// Water color.
				ctx.fillStyle = "#3aa7ff";
			} else if (cell === BARRIER && revealed[i]) {
				// Barrier color.
				// Hidden barriers are skipped until revealed[i] is true.
				ctx.fillStyle = "#d8d8d8";
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
}


// -----------------------------------------------------------------------------
// Animation loop
// -----------------------------------------------------------------------------

function loop() {
	// Advance the simulation.
	updateParticles();

	// Draw the current state of the simulation.
	draw();

	// Ask the browser to call loop() again before the next repaint.
	// This is the standard way to animate with JavaScript.
	requestAnimationFrame(loop);
}


// -----------------------------------------------------------------------------
// Browser event hooks
// -----------------------------------------------------------------------------

let isDrawing = false;

canvas.addEventListener("pointerdown", (e) => {
	const x = e.clientX;
	const y = e.clientY;

	if (pointInsideRect(x, y, enterButton)) {
		console.log("ENTER clicked");
		return;
	}

	isDrawing = true;
	canvas.setPointerCapture(e.pointerId);
	spawnMaterial(x, y);
});

canvas.addEventListener("pointermove", (e) => {
	// On touchscreens, require touch-and-drag.
	if (e.pointerType === "touch" && !isDrawing) return;

	// On mouse, preserve the old behavior: just moving the cursor drops material.
	spawnMaterial(e.clientX, e.clientY);
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