// --- Basic Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');
const loadingText = document.getElementById('loadingText');

console.log("Mobile Simple Script Initialized."); // Initial log

// --- Asset Loading (Identical to previous version) ---
const images = {};
const sounds = {};
let assetsLoaded = 0;
const totalAssets = 15; // 12 images + 3 sounds

function assetLoaded() {
    assetsLoaded++;
    const progressText = `正在加載資源... (${assetsLoaded}/${totalAssets})`;
    if (loadingText) loadingText.textContent = progressText;

    if (assetsLoaded >= totalAssets) {
        console.log("All assets loaded.");
        if (startButton) {
            startButton.disabled = false;
            startButton.textContent = "開始遊戲";
            if (loadingText) loadingText.textContent = "資源加載完成! 請點擊開始。";
        } else {
            console.error("Start Button not found after assets loaded!");
        }
    }
}

function loadImage(name, src) { /* ... identical ... */
    images[name] = new Image();
    images[name].onload = assetLoaded;
    images[name].onerror = () => { console.error(`Image load failed: ${src}`); assetLoaded(); };
    images[name].src = src;
}
function loadSound(name, elementId) { /* ... identical ... */
    sounds[name] = document.getElementById(elementId);
    if (sounds[name]) {
        sounds[name].addEventListener('loadeddata', assetLoaded, { once: true });
        sounds[name].addEventListener('error', (e) => { console.error(`Sound load failed: ${elementId}`, e); assetLoaded(); });
        sounds[name].load();
    } else { console.error(`Audio element not found: ${elementId}`); assetLoaded(); }
}

// --- Game Settings ---
let gameWidth, gameHeight;
let scaleRatio = 1;
// *** Performance Note: Set USE_DEVICE_PIXEL_RATIO to false if performance is poor on target device ***
const USE_DEVICE_PIXEL_RATIO = true; // Keep true for sharpness initially

function resizeCanvas() {
    // Recalculate dimensions based on current window size
    const desiredWidth = window.innerWidth;
    const desiredHeight = window.innerHeight;
    console.log(`Window dimensions: ${desiredWidth}x${desiredHeight}`); // Log window size

    // Maintain aspect ratio (e.g., 16:9) - crucial for consistent layout
    const aspectRatio = 16 / 9;
    let newWidth, newHeight;

    // Determine dimensions based on aspect ratio and window size
    if (desiredWidth / desiredHeight >= aspectRatio) { // Window is wider than aspect ratio or equal
        newHeight = desiredHeight;
        newWidth = newHeight * aspectRatio;
    } else { // Window is taller than aspect ratio
        newWidth = desiredWidth;
        newHeight = newWidth / aspectRatio;
    }

    // Apply DPR scaling conditionally
    scaleRatio = (USE_DEVICE_PIXEL_RATIO && window.devicePixelRatio) ? window.devicePixelRatio : 1;

    canvas.width = newWidth * scaleRatio;
    canvas.height = newHeight * scaleRatio;
    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;

    // Update game's internal knowledge of dimensions
    gameWidth = canvas.width;
    gameHeight = canvas.height;

    // Recalculate dynamic elements like button positions
    defineButtonAreas();

    console.log(`Canvas resized: Style=${newWidth}x${newHeight}, Internal=${canvas.width}x${canvas.height}, ScaleRatio=${scaleRatio}`);

    // Redraw end screen if game is over and resize occurs
    if (!gameRunning && (gameOver || gameWon)) {
        displayEndScreen();
    }
}

// --- Load Assets (Calls are identical) ---
if(startButton) startButton.disabled = true;
loadImage('playerIdle', '1.png');
loadImage('playerRun1', '2.png');
loadImage('playerRun2', '2-1.png');
loadImage('playerJump', '3.png');
loadImage('playerShoot', '4.png');
loadImage('enemyA', 'a.png');
loadImage('enemyAShoot', 'a-1.png');
loadImage('enemyB1', 'b.png');
loadImage('enemyB2', 'b-1.png');
loadImage('enemyC', 'c.png');
loadImage('enemyCShoot', 'c-1.png');
loadImage('background', 'bk.png');
loadImage('obstacle', 'bk-1.png');
loadSound('bgMusic', 'bgMusic');
loadSound('shootSound', 'shootSound');
loadSound('jumpSound', 'jumpSound');

window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Initial size calculation on load


// --- Game Variables (Identical) ---
let player;
let enemies = [];
let bullets = [];
let enemyBullets = [];
let obstacles = [];
let backgroundX = 0;
let score = 0; // Not used currently, but available
let playerHealth = 3;
let gameOver = false;
let gameWon = false;
let gameRunning = false;
let animationFrameId;

const gravity = 0.6 * scaleRatio;
const playerSpeed = 6 * scaleRatio;
const jumpStrength = -14 * scaleRatio;
const bulletSpeed = 9 * scaleRatio;
const enemyBulletSpeed = 4 * scaleRatio;

let frameCount = 0;
const runFrameSpeed = 8;
const enemyBFrameSpeed = 12;

// --- Button States and Definitions (Identical) ---
let moveLeftPressed = false;
let moveRightPressed = false;
let jumpPressed = false;
let shootPressed = false;
let leftButtonRect = {}, rightButtonRect = {}, shootButtonRect = {}, jumpButtonRect = {};
let buttonSize = 0, buttonMargin = 0;

function defineButtonAreas() { /* ... identical calculation logic ... */
    buttonSize = Math.min(gameWidth, gameHeight) * 0.13;
    buttonMargin = buttonSize * 0.15;
    const bottomMargin = buttonMargin * 2;
    const shootX = gameWidth - buttonMargin - buttonSize * 1.5;
    const shootY = gameHeight - bottomMargin - buttonSize;
    const leftX = shootX - buttonMargin - buttonSize;
    const rightX = shootX + buttonMargin + buttonSize;
    const jumpY = shootY - buttonMargin - buttonSize;
    const minX = buttonMargin; const minY = buttonMargin; // Prevent going off screen
    leftButtonRect = { x: Math.max(minX, leftX), y: Math.max(minY, shootY), width: buttonSize, height: buttonSize, pressed: false };
    rightButtonRect = { x: Math.max(minX, rightX), y: Math.max(minY, shootY), width: buttonSize, height: buttonSize, pressed: false };
    shootButtonRect = { x: Math.max(minX, shootX), y: Math.max(minY, shootY), width: buttonSize, height: buttonSize, pressed: false };
    jumpButtonRect = { x: Math.max(minX, shootX), y: Math.max(minY, jumpY), width: buttonSize, height: buttonSize, pressed: false };
}
defineButtonAreas(); // Initial definition


// --- Object Classes (Player, Bullet, Enemy, EnemyBullet, Obstacle) ---
// --- These classes remain IDENTICAL to the previous corrected version ---
// --- Ensure all draw methods use offsetX and collision checks are correct ---
class GameObject { /* ... */
    constructor(x, y, width, height, image) {
        this.x = x; // Store original unscaled position? Maybe not needed if init uses scaleRatio
        this.y = y;
        this.width = width * scaleRatio; // Scale dimensions on creation
        this.height = height * scaleRatio;
        this.image = image;

         // Adjust x/y based on scaleRatio IF they were passed unscaled
         // If positions passed to constructor are already scaled (like in initGame), remove these lines
         // this.x *= scaleRatio;
         // this.y *= scaleRatio;
    }
     draw(offsetX = 0) {
         if (this.image && this.image.complete && this.image.naturalWidth > 0) {
             const drawX = this.x - offsetX;
             // Basic culling
             if (drawX + this.width > 0 && drawX < gameWidth) {
                 ctx.drawImage(this.image, drawX, this.y, this.width, this.height);
             }
        } else { // Placeholder drawing
             // Use different colors for different object types for debugging
             let color = 'grey';
             if (this instanceof Player) color = 'blue';
             else if (this instanceof Enemy) color = 'red';
             else if (this instanceof Obstacle) color = '#8B4513';
             ctx.fillStyle = color;
             const drawX = this.x - offsetX;
              if (drawX + this.width > 0 && drawX < gameWidth){
                 ctx.fillRect(drawX, this.y, this.width, this.height);
              }
        }
    }
}
class Player extends GameObject { /* ... identical ... */
    constructor(x, y) {
        const playerWidth = 80; const playerHeight = 80;
        // Pass unscaled width/height, GameObject constructor handles scaling
        super(x, y, playerWidth, playerHeight, images.playerIdle);
        // Other player properties...
        this.vx = 0; this.vy = 0; this.onGround = false; this.facingRight = true;
        this.shooting = false; this.shootingCooldown = 0; this.runFrame = 0;
        this.invulnerable = false; this.invulnerableTimer = 0; this.invulnerableDuration = 120;
        this.shootFrameTimer = 0; this.shootFrameDuration = 15;
    }
     update(worldScrollX) { /* ... identical physics and input logic ... */
        // --- Apply button states ---
        this.vx = 0;
        if (leftButtonRect.pressed) { this.vx = -playerSpeed; this.facingRight = false; }
        if (rightButtonRect.pressed) { this.vx = playerSpeed; this.facingRight = true; }
         // --- Physics ---
        this.x += this.vx; this.vy += gravity; this.y += this.vy; this.onGround = false;
        if (this.x < worldScrollX) this.x = worldScrollX;
        // Ground check
        const groundY = gameHeight - this.height - 10 * scaleRatio;
        if (this.y >= groundY && this.vy >= 0) { this.y = groundY; this.vy = 0; this.onGround = true; }
         // Obstacle collision
         obstacles.forEach(obstacle => {
             const collideData = this.checkCollision(obstacle, worldScrollX);
             if (collideData.colliding) {
                 if (collideData.fromAbove && this.vy > 0) { this.y = obstacle.y - this.height; this.vy = 0; this.onGround = true; }
                 else if (!collideData.fromAbove && this.vy >= 0) {
                     if (this.vx > 0 && this.x + this.width > obstacle.x && this.x < obstacle.x) { this.x = obstacle.x - this.width; this.vx = 0; }
                     else if (this.vx < 0 && this.x < obstacle.x + obstacle.width && this.x + this.width > obstacle.x + obstacle.width) { this.x = obstacle.x + obstacle.width; this.vx = 0; }
                 }
             }
         });
         // Jump trigger
         if (jumpPressed && this.onGround) { this.vy = jumpStrength; this.onGround = false; playSound(sounds.jumpSound); jumpPressed = false; jumpButtonRect.pressed = false; }
         // Shoot trigger & cooldown
         if (this.shootingCooldown > 0) this.shootingCooldown--;
         if (shootPressed && this.shootingCooldown <= 0) { this.shoot(); this.shooting = true; this.shootFrameTimer = this.shootFrameDuration; this.shootingCooldown = 18; shootPressed = false; shootButtonRect.pressed = false; }
         if (this.shootFrameTimer > 0) { this.shootFrameTimer--; if (this.shootFrameTimer <= 0) this.shooting = false; }
         // Invulnerability
         if (this.invulnerable) { this.invulnerableTimer--; if (this.invulnerableTimer <= 0) this.invulnerable = false; }
     }
     draw(offsetX = 0) { /* ... identical drawing logic with image selection & flipping ... */
         let currentImage; frameCount++;
         if (this.shooting && images.playerShoot) { currentImage = images.playerShoot; }
         else if (!this.onGround && images.playerJump) { currentImage = images.playerJump; }
         else if (this.vx !== 0 && images.playerRun1 && images.playerRun2) { const frameIndex = Math.floor(frameCount / runFrameSpeed) % 2; currentImage = (frameIndex === 0) ? images.playerRun1 : images.playerRun2; }
         else { currentImage = images.playerIdle; }
         if (!currentImage || !currentImage.complete || currentImage.naturalWidth === 0) { super.draw(offsetX); return; } // Fallback to placeholder draw
         ctx.save(); const drawX = this.x - offsetX;
         if (this.invulnerable && Math.floor(this.invulnerableTimer / 5) % 2 === 0) ctx.globalAlpha = 0.5;
         if (!this.facingRight) { ctx.scale(-1, 1); ctx.drawImage(currentImage, -(drawX + this.width), this.y, this.width, this.height); }
         else { ctx.drawImage(currentImage, drawX, this.y, this.width, this.height); }
         ctx.restore();
     }
     shoot() { /* ... identical bullet creation logic ... */
         const bulletXOffset = this.width * 0.8; const bulletYOffset = this.height * 0.4;
         const bulletX = this.facingRight ? this.x + bulletXOffset : this.x + (this.width - bulletXOffset);
         const bulletY = this.y + bulletYOffset;
         const bulletVx = this.facingRight ? bulletSpeed : -bulletSpeed;
         // Note: Bullet dimensions are scaled here directly, not in constructor
         bullets.push(new Bullet(bulletX, bulletY, 12 * scaleRatio, 6 * scaleRatio, bulletVx));
         playSound(sounds.shootSound);
     }
     takeDamage() { /* ... identical ... */
          if (!this.invulnerable) { playerHealth--; console.log(`Player health: ${playerHealth}`); this.invulnerable = true; this.invulnerableTimer = this.invulnerableDuration; if (playerHealth <= 0) gameOver = true; }
     }
     checkCollision(other, offsetX = 0) { /* ... identical AABB logic ... */
          const playerLeft = this.x; const playerRight = this.x + this.width;
          const playerTop = this.y; const playerBottom = this.y + this.height;
          // Use other object's *scaled* dimensions (assuming they are also scaled on creation)
          const otherLeft = other.x; const otherRight = other.x + other.width;
          const otherTop = other.y; const otherBottom = other.y + other.height;
          const colliding = playerRight > otherLeft && playerLeft < otherRight && playerBottom > otherTop && playerTop < otherBottom;
          let fromAbove = false;
          if (colliding && this.vy > 0 && (playerBottom - this.vy * 1.1) <= otherTop) { fromAbove = true; }
          return { colliding, fromAbove };
      }
}
class Bullet extends GameObject { /* ... identical ... */
    // Pass scaled dimensions to super constructor? No, we set them directly here
     constructor(x, y, scaledWidth, scaledHeight, vx) {
         // Override GameObject constructor scaling logic for bullets
         super(x, y, 0, 0, null); // Pass 0 width/height, null image
         this.width = scaledWidth;
         this.height = scaledHeight;
         this.vx = vx;
     }
     update() { this.x += this.vx; }
     draw(offsetX = 0) { /* ... identical drawing logic (yellow rect) ... */
          ctx.fillStyle = 'yellow';
          const drawX = this.x - offsetX;
          if (drawX + this.width > 0 && drawX < gameWidth) {
              ctx.fillRect(drawX, this.y, this.width, this.height);
          }
      }
}
class Enemy extends GameObject { /* ... identical ... */
     constructor(x, y, width, height, image, health, type) {
         super(x, y, width, height, image); // Pass unscaled width/height
         this.initialHealth = health; this.health = health; this.type = type;
         // Other enemy properties...
         this.shootCooldown = 0; this.shootTimer = Math.random() * 100 + 100; this.vx = 0;
         this.moveDirection = 1; this.moveRange = 100 * scaleRatio; this.initialX = this.x; // Store scaled initial X
         this.animationFrame = 0; this.actionFrameTimer = 0; this.actionFrameDuration = 20; this.isShooting = false;
     }
      update(playerX, worldScrollX) { /* ... identical AI logic ... */
          this.actionFrameTimer--; if (this.actionFrameTimer <= 0) this.isShooting = false;
          const playerCenterX = player.x + player.width / 2; // Use player center for distance checks
          const enemyCenterX = this.x + this.width / 2;
          const horizontalDist = Math.abs(enemyCenterX - playerCenterX);

          if (this.type === 'A') {
              this.shootTimer--;
              const verticalDiff = Math.abs(player.y + player.height / 2 - (this.y + this.height / 2));
              if (this.shootTimer <= 0 && verticalDiff < gameHeight * 0.6 && horizontalDist < gameWidth * 0.9) { // Check vertical proximity
                  this.shoot(playerX); this.shootTimer = 120 + Math.random() * 60; this.isShooting = true; this.actionFrameTimer = this.actionFrameDuration;
              }
          } else if (this.type === 'B') {
              this.vx = 2 * scaleRatio * this.moveDirection; this.x += this.vx;
              if (Math.abs(this.x - this.initialX) > this.moveRange) { this.moveDirection *= -1; this.x += this.vx; } // Move back in range
              this.animationFrame++;
          } else if (this.type === 'C') {
              this.shootTimer--;
              if (this.shootTimer <= 0 && horizontalDist < gameWidth * 1.1) { // Wide range for boss
                  this.shootSpread(); this.shootTimer = 150 + Math.random() * 80; this.isShooting = true; this.actionFrameTimer = this.actionFrameDuration;
              }
          }
      }
      draw(offsetX = 0) { /* ... identical drawing logic with health bar ... */
           let currentImage = this.image;
           if (this.isShooting) { if (this.type === 'A' && images.enemyAShoot) currentImage = images.enemyAShoot; if (this.type === 'C' && images.enemyCShoot) currentImage = images.enemyCShoot; }
           else if (this.type === 'B' && images.enemyB1 && images.enemyB2) { const frameIndex = Math.floor(this.animationFrame / enemyBFrameSpeed) % 2; currentImage = (frameIndex === 0) ? images.enemyB1 : images.enemyB2; }
           if (!currentImage || !currentImage.complete || currentImage.naturalWidth === 0) { super.draw(offsetX); return; } // Fallback draw
           // Regular draw + health bar
           const drawX = this.x - offsetX;
           if (drawX + this.width > 0 && drawX < gameWidth) {
                 ctx.save();
                 if (this.type === 'B' && this.moveDirection < 0) { ctx.scale(-1, 1); ctx.drawImage(currentImage, -(drawX + this.width), this.y, this.width, this.height); }
                 else { ctx.drawImage(currentImage, drawX, this.y, this.width, this.height); }
                 ctx.restore();
                 // Health bar
                 const healthBarWidth = this.width * 0.8; const healthBarHeight = 6 * scaleRatio;
                 const healthBarX = drawX + (this.width - healthBarWidth) / 2; const healthBarY = this.y - healthBarHeight - 6 * scaleRatio;
                 const healthPercentage = Math.max(0, this.health / this.initialHealth);
                 ctx.fillStyle = '#555'; ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
                 ctx.fillStyle = healthPercentage > 0.5 ? 'lime' : (healthPercentage > 0.2 ? 'yellow' : 'red');
                 ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercentage, healthBarHeight);
                 ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
           }
       }
      shoot(playerX) { /* ... identical ... */
           const bulletX = this.x + this.width / 2; const bulletY = this.y + this.height / 2;
           const angle = Math.atan2((player.y + player.height/2) - (this.y + this.height/2), (player.x + player.width/2) - (this.x + this.width/2));
           const bulletVx = Math.cos(angle) * enemyBulletSpeed; const bulletVy = Math.sin(angle) * enemyBulletSpeed;
           enemyBullets.push(new EnemyBullet(bulletX, bulletY, 8 * scaleRatio, 8 * scaleRatio, bulletVx, bulletVy)); // Pass scaled dimensions
       }
       shootSpread() { /* ... identical ... */
            const bulletX = this.x + this.width / 2; const bulletY = this.y + this.height / 2;
            const numBullets = 5; const angleSpread = Math.PI / 4;
            const baseAngle = Math.atan2((player.y + player.height/2) - (this.y + this.height/2), (player.x + player.width/2) - (this.x + this.width/2));
            const startAngle = baseAngle - angleSpread / 2;
            for (let i = 0; i < numBullets; i++) {
                const angle = startAngle + (angleSpread / (numBullets - 1)) * i;
                const bulletVx = Math.cos(angle) * enemyBulletSpeed * 1.1; const bulletVy = Math.sin(angle) * enemyBulletSpeed * 1.1;
                enemyBullets.push(new EnemyBullet(bulletX, bulletY, 10 * scaleRatio, 10 * scaleRatio, bulletVx, bulletVy)); // Pass scaled dimensions
            }
        }
      takeDamage(amount) { /* ... identical ... */ this.health -= amount; }
}
class EnemyBullet extends GameObject { /* ... identical ... */
     constructor(x, y, scaledWidth, scaledHeight, vx, vy) {
         super(x, y, 0, 0, null); // Pass 0s
         this.width = scaledWidth; this.height = scaledHeight;
         this.vx = vx; this.vy = vy;
     }
     update() { this.x += this.vx; this.y += this.vy; }
     draw(offsetX = 0) { /* ... identical drawing logic (orange rect) ... */
          ctx.fillStyle = 'orange'; const drawX = this.x - offsetX;
          if (drawX + this.width > 0 && drawX < gameWidth && this.y + this.height > 0 && this.y < gameHeight) {
              ctx.fillRect(drawX, this.y, this.width, this.height);
          }
      }
}
class Obstacle extends GameObject { /* ... identical ... */
     constructor(x, y, width, height) {
         super(x, y, width, height, images.obstacle); // Pass unscaled
     }
     // Inherits draw from GameObject, which handles placeholder if image fails
}

// --- 遊戲初始化 (initGame) ---
function initGame() {
    console.log("initGame: Initializing game state...");
    // Reset state variables
    gameOver = false; gameWon = false; playerHealth = 3; score = 0;
    backgroundX = 0; enemies = []; bullets = []; enemyBullets = []; obstacles = [];

    // Create player - Pass *unscaled* coords/dims if GameObject constructor handles scaling
    // Or pass *scaled* coords/dims if constructor doesn't scale them
    // Let's assume constructor scales dims, but we pre-scale coords here for clarity
    const playerStartX = 100 * scaleRatio;
    const playerStartY = gameHeight - (80 + 10) * scaleRatio; // Use scaled player height
    player = new Player(playerStartX, playerStartY);

    // Create obstacles - Pass unscaled X, Y, Width, Height
    // Let GameObject constructor handle scaling based on scaleRatio
    obstacles.push(new Obstacle(350, gameHeight / scaleRatio - 100, 80, 50)); // Y relative to unscaled height
    obstacles.push(new Obstacle(650, gameHeight / scaleRatio - 160, 120, 80));
    obstacles.push(new Obstacle(1000, gameHeight / scaleRatio - 80, 60, 60));

    // Create enemies - Pass unscaled X, Y, Width, Height
    const enemyAW = 40; const enemyAH = 40; const enemyBW = 45; const enemyBH = 45; const enemyCW = 80; const enemyCH = 80;
    enemies.push(new Enemy(550, gameHeight / scaleRatio - (10 + enemyAH), enemyAW, enemyAH, images.enemyA, 2, 'A'));
    enemies.push(new Enemy(850, gameHeight / scaleRatio - (10 + enemyBH), enemyBW, enemyBH, images.enemyB1, 1, 'B')); // Initial X needs recalc in constructor
    enemies.push(new Enemy(1150, gameHeight / scaleRatio - (10 + enemyAH), enemyAW, enemyAH, images.enemyA, 2, 'A'));
    enemies.push(new Enemy(1600, gameHeight / scaleRatio - (10 + enemyCH), enemyCW, enemyCH, images.enemyC, 15, 'C')); // Boss

    console.log("initGame: Initialization complete.");
}


// --- Input Handling (getCanvasCoordinates, handleCanvasInputStart/End, isPointInRect) ---
// --- These functions remain IDENTICAL to the previous corrected version ---
function getCanvasCoordinates(event) { /* ... identical ... */
     try { const rect = canvas.getBoundingClientRect(); let clientX, clientY;
         if (event.touches && event.touches.length > 0) { clientX = event.touches[0].clientX; clientY = event.touches[0].clientY; }
         else if (event.changedTouches && event.changedTouches.length > 0) { clientX = event.changedTouches[0].clientX; clientY = event.changedTouches[0].clientY; }
         else if (event.clientX !== undefined) { clientX = event.clientX; clientY = event.clientY; } else return null;
         const x = clientX - rect.left; const y = clientY - rect.top;
         const currentScaleRatio = (USE_DEVICE_PIXEL_RATIO && window.devicePixelRatio) ? window.devicePixelRatio : 1;
         return { x: x * currentScaleRatio, y: y * currentScaleRatio };
     } catch (e) { console.error("Error in getCanvasCoordinates:", e); return null; }
 }
let activeTouches = {};
function handleCanvasInputStart(event) { /* ... identical ... */
     event.preventDefault(); const touches = event.changedTouches || [event];
     for (let i = 0; i < touches.length; i++) { const touch = touches[i]; const coords = getCanvasCoordinates(touch); const identifier = touch.identifier !== undefined ? touch.identifier : 'mouse'; if (!coords || activeTouches[identifier]) continue;
         if (isPointInRect(coords, leftButtonRect)) { leftButtonRect.pressed = true; activeTouches[identifier] = 'left'; }
         else if (isPointInRect(coords, rightButtonRect)) { rightButtonRect.pressed = true; activeTouches[identifier] = 'right'; }
         else if (isPointInRect(coords, shootButtonRect)) { shootPressed = true; shootButtonRect.pressed = true; activeTouches[identifier] = 'shoot'; }
         else if (isPointInRect(coords, jumpButtonRect)) { jumpPressed = true; jumpButtonRect.pressed = true; activeTouches[identifier] = 'jump'; }
     }
 }
 function handleCanvasInputEnd(event) { /* ... identical ... */
     event.preventDefault(); const touches = event.changedTouches || [event];
     for (let i = 0; i < touches.length; i++) { const touch = touches[i]; const identifier = touch.identifier !== undefined ? touch.identifier : 'mouse'; const pressedButton = activeTouches[identifier];
         if (pressedButton) { if (pressedButton === 'left') leftButtonRect.pressed = false; else if (pressedButton === 'right') rightButtonRect.pressed = false; else if (pressedButton === 'shoot') shootButtonRect.pressed = false; else if (pressedButton === 'jump') jumpButtonRect.pressed = false; delete activeTouches[identifier]; }
     }
 }
function isPointInRect(point, rect) { /* ... identical ... */
    return point && rect && point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}
// Add/Remove Listeners (Identical)
canvas.removeEventListener('touchstart', handleCanvasInputStart); canvas.removeEventListener('touchend', handleCanvasInputEnd); canvas.removeEventListener('touchcancel', handleCanvasInputEnd); canvas.removeEventListener('mousedown', handleCanvasInputStart); canvas.removeEventListener('mouseup', handleCanvasInputEnd); canvas.removeEventListener('mouseleave', handleCanvasInputEnd);
canvas.addEventListener('touchstart', handleCanvasInputStart, { passive: false }); canvas.addEventListener('touchend', handleCanvasInputEnd, { passive: false }); canvas.addEventListener('touchcancel', handleCanvasInputEnd, { passive: false }); canvas.addEventListener('mousedown', handleCanvasInputStart, { passive: false }); canvas.addEventListener('mouseup', handleCanvasInputEnd, { passive: false }); canvas.addEventListener('mouseleave', handleCanvasInputEnd, { passive: false });


// --- Drawing Controls (drawControls - Identical) ---
function drawControls() { /* ... identical drawing logic ... */
    ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#888'; ctx.strokeStyle = '#FFF'; ctx.lineWidth = 2 * scaleRatio;
    ctx.font = `${buttonSize * 0.4}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // Draw Left
    ctx.fillStyle = leftButtonRect.pressed ? '#AAA' : '#888'; ctx.fillRect(leftButtonRect.x, leftButtonRect.y, leftButtonRect.width, leftButtonRect.height); ctx.strokeRect(leftButtonRect.x, leftButtonRect.y, leftButtonRect.width, leftButtonRect.height); ctx.fillStyle = '#FFF'; ctx.fillText('◀', leftButtonRect.x + leftButtonRect.width / 2, leftButtonRect.y + leftButtonRect.height / 2);
    // Draw Right
    ctx.fillStyle = rightButtonRect.pressed ? '#AAA' : '#888'; ctx.fillRect(rightButtonRect.x, rightButtonRect.y, rightButtonRect.width, rightButtonRect.height); ctx.strokeRect(rightButtonRect.x, rightButtonRect.y, rightButtonRect.width, rightButtonRect.height); ctx.fillStyle = '#FFF'; ctx.fillText('▶', rightButtonRect.x + rightButtonRect.width / 2, rightButtonRect.y + rightButtonRect.height / 2);
    // Draw Shoot
    ctx.fillStyle = shootButtonRect.pressed ? '#AAA' : '#888'; ctx.fillRect(shootButtonRect.x, shootButtonRect.y, shootButtonRect.width, shootButtonRect.height); ctx.strokeRect(shootButtonRect.x, shootButtonRect.y, shootButtonRect.width, shootButtonRect.height); ctx.fillStyle = '#FFF'; ctx.fillText('◎', shootButtonRect.x + shootButtonRect.width / 2, shootButtonRect.y + shootButtonRect.height / 2);
    // Draw Jump
    ctx.fillStyle = jumpButtonRect.pressed ? '#AAA' : '#888'; ctx.fillRect(jumpButtonRect.x, jumpButtonRect.y, jumpButtonRect.width, jumpButtonRect.height); ctx.strokeRect(jumpButtonRect.x, jumpButtonRect.y, jumpButtonRect.width, jumpButtonRect.height); ctx.fillStyle = '#FFF'; ctx.fillText('▲', jumpButtonRect.x + jumpButtonRect.width / 2, jumpButtonRect.y + jumpButtonRect.height / 2);
    ctx.restore();
 }

// --- Game Loop (gameLoop - Identical core logic) ---
function gameLoop() {
    if (gameOver || gameWon) { displayEndScreen(); gameRunning = false; return; }
    gameRunning = true;
    ctx.clearRect(0, 0, gameWidth, gameHeight);

    // Scrolling
    let targetScrollX = player.x - gameWidth / 3.5;
    const levelWidth = 2000 * scaleRatio; // Level width
    targetScrollX = Math.max(0, Math.min(targetScrollX, levelWidth - gameWidth));
    backgroundX += (targetScrollX - backgroundX) * 0.1;

    // Draw Background, Obstacles, Player, Enemies (Identical calls)
    if (images.background && images.background.complete) { /* ... bg drawing ... */
        const bgRatio = images.background.width / images.background.height; const bgWidth = gameHeight * bgRatio; const pattern = ctx.createPattern(images.background, 'repeat-x');
        ctx.save(); ctx.translate(-backgroundX % bgWidth, 0); ctx.fillStyle = pattern || '#abcdef'; ctx.fillRect(0, 0, gameWidth + bgWidth, gameHeight); ctx.restore();
    } else { ctx.fillStyle = '#abcdef'; ctx.fillRect(0, 0, gameWidth, gameHeight); }
    obstacles.forEach(obstacle => obstacle.draw(backgroundX));
    player.update(backgroundX); player.draw(backgroundX);
    enemies.forEach((enemy) => { enemy.update(player.x, backgroundX); enemy.draw(backgroundX); if (!player.invulnerable && player.checkCollision(enemy, backgroundX).colliding) player.takeDamage(); });

    // Bullet Filtering & Drawing (Identical logic)
    bullets = bullets.filter((bullet) => { /* ... bullet vs enemy collision & draw ... */
        bullet.update(); let hit = false;
        for (let i = 0; i < enemies.length; i++) { const enemy = enemies[i]; if (bullet.x < enemy.x + enemy.width && bullet.x + bullet.width > enemy.x && bullet.y < enemy.y + enemy.height && bullet.y + bullet.height > enemy.y) { hit = true; enemy.takeDamage(1); if (enemy.health <= 0) { if (enemy.type === 'C') gameWon = true; enemies.splice(i, 1); i--; } break; } }
        const bulletDrawX = bullet.x - backgroundX; const keepBullet = !hit && bulletDrawX < gameWidth && bulletDrawX + bullet.width > 0; if (keepBullet) bullet.draw(backgroundX); return keepBullet;
     });
    enemyBullets = enemyBullets.filter((bullet) => { /* ... enemy bullet vs player collision & draw ... */
         bullet.update(); let hitPlayer = false; if (!player.invulnerable && player.checkCollision(bullet, backgroundX).colliding) { player.takeDamage(); hitPlayer = true; }
         const bulletDrawX = bullet.x - backgroundX; const keepBullet = !hitPlayer && bulletDrawX < gameWidth && bulletDrawX + bullet.width > 0 && bullet.y < gameHeight && bullet.y + bullet.height > 0; if (keepBullet) bullet.draw(backgroundX); return keepBullet;
    });

    // Draw UI & Controls (Identical calls)
    displayUI();
    drawControls();

    // Request next frame
    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- UI Display (displayUI - Identical) ---
function displayUI() { /* ... identical drawing logic ... */
    ctx.save(); ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.font = `${Math.max(18, 22 * (gameHeight / 600))}px Arial`;
    ctx.textAlign = 'left'; ctx.shadowColor = 'black'; ctx.shadowBlur = 3; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
    ctx.fillText(`生命: ${playerHealth}`, 15 * scaleRatio, 35 * scaleRatio); ctx.restore();
 }

// --- End Screen (displayEndScreen - Identical) ---
function displayEndScreen() { /* ... identical drawing logic ... */
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'; ctx.fillRect(0, 0, gameWidth, gameHeight); ctx.fillStyle = 'white';
    ctx.font = `${Math.max(30, 45 * (gameHeight / 600))}px Arial`; ctx.textAlign = 'center'; ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
    if (gameWon) ctx.fillText('勝利!', gameWidth / 2, gameHeight / 2 - 50 * scaleRatio); else ctx.fillText('遊戲結束', gameWidth / 2, gameHeight / 2 - 50 * scaleRatio);
    ctx.font = `${Math.max(18, 25 * (gameHeight / 600))}px Arial`;
    ctx.fillText(`剩餘生命: ${playerHealth > 0 ? playerHealth : 0}`, gameWidth / 2, gameHeight / 2 + 10 * scaleRatio);
    ctx.fillText('點擊螢幕重新開始', gameWidth / 2, gameHeight / 2 + 60 * scaleRatio);
    if (sounds.bgMusic) { sounds.bgMusic.pause(); sounds.bgMusic.currentTime = 0; }
 }

// --- Audio Handling (unlockAudio, playSound - Identical robust version) ---
let audioContextUnlocked = false;
const DUMMY_AUDIO_SRC = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="; // Tiny silent WAV
function unlockAudio() {
    if (audioContextUnlocked) return;
    console.log("Attempting to unlock audio...");
    const dummySound = new Audio(DUMMY_AUDIO_SRC);
    dummySound.play().then(() => { console.log("Audio likely unlocked."); audioContextUnlocked = true; })
                     .catch(e => console.warn("Audio unlock failed:", e));
}
function playSound(soundElement) {
     if (!audioContextUnlocked) { unlockAudio(); } // Try unlocking if needed
     if (soundElement && soundElement.readyState >= 2) { // HAVE_CURRENT_DATA
        soundElement.currentTime = 0;
        soundElement.play().catch(e => { /* Ignore non-critical sound errors */ });
     }
}

// --- Game Start / Restart Logic (Simplified handleStartGameClick) ---
let gameHasStarted = false;
let isStarting = false; // Prevent double-clicks

// *** SIMPLIFIED Start Function ***
function handleStartGameClick() {
    console.log("handleStartGameClick triggered.");
    if (isStarting || (gameHasStarted && gameRunning)) {
        console.log(`Start ignored: isStarting=${isStarting}, gameHasStarted=${gameHasStarted}, gameRunning=${gameRunning}`);
        return;
    }
    if (assetsLoaded < totalAssets) {
        console.warn("Assets not loaded yet, cannot start.");
        if(loadingText) loadingText.textContent = "資源仍在加載...";
        return;
    }

    isStarting = true; // Mark as busy
    console.log("Starting game sequence...");

    // 1. Unlock Audio (Crucial first step on user interaction)
    unlockAudio();

    // 2. Hide Start Screen
    if (startScreen) startScreen.style.display = 'none';
    console.log("Start screen hidden.");

    // 3. Ensure Canvas Size is Correct (based on current screen)
    // resizeCanvas() was already called on load and on window resize events
    // Might call it again just to be absolutely sure, though potentially redundant
    console.log("Ensuring canvas size...");
    resizeCanvas();

    // 4. Initialize Game State
    console.log("Initializing game objects...");
    initGame();

    // 5. Try Playing Background Music
    console.log("Attempting background music...");
    if (sounds.bgMusic) {
        sounds.bgMusic.play().catch(e => console.error("Background music play failed:", e));
    } else {
        console.warn("Background music element not ready or found.");
    }

    // 6. Start Game Loop
    console.log("Starting game loop...");
    gameHasStarted = true; // Mark that initial start process completed
    gameRunning = true;
    gameOver = false;
    gameWon = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId); // Clear any previous loop
    gameLoop();
    console.log("Game loop should be running.");

    isStarting = false; // Finished starting attempt
}

// --- Restart Logic (Identical) ---
function restartGameOnce(event) {
     if (!gameRunning && (gameOver || gameWon)) {
         console.log("Restarting game...");
         gameOver = false; gameWon = false; // Reset flags
         initGame(); // Re-initialize state
         if (sounds.bgMusic) { sounds.bgMusic.currentTime = 0; sounds.bgMusic.play().catch(e => {}); } // Restart music
         gameRunning = true; // Set running before loop
         if (animationFrameId) cancelAnimationFrame(animationFrameId);
         gameLoop();
     }
}

// --- Event Listeners ---
// Start Button
if (startButton) {
    startButton.removeEventListener('click', handleStartGameClick);
    startButton.addEventListener('click', handleStartGameClick);
} else { console.error("Critical: Start button not found!"); }
// Canvas for Restart
canvas.removeEventListener('click', restartGameOnce);
canvas.addEventListener('click', restartGameOnce);

// Initial Setup Calls
resizeCanvas(); // Call resize on initial load
console.log("Mobile Simple script fully initialized. Waiting for assets and start click.");
