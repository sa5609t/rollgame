const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');
const loadingText = document.getElementById('loadingText');


// --- 資源加載 ---
const images = {};
const sounds = {};
let assetsLoaded = 0;
// Total assets count remains the same (12 images + 3 sounds = 15)
const totalAssets = 15;

function assetLoaded() {
    assetsLoaded++;
    const progressText = `正在加載資源... (${assetsLoaded}/${totalAssets})`;
    if (loadingText) {
        loadingText.textContent = progressText;
    } else { // Fallback if loadingText isn't found immediately
        console.log(progressText);
    }

    if (assetsLoaded >= totalAssets) {
        console.log("所有資源已加載");
        if (startButton) {
            startButton.disabled = false; // Enable start button
            startButton.textContent = "開始遊戲";
        }
        if (loadingText) {
            loadingText.textContent = "資源加載完成!";
        }
        // Don't auto-start, wait for button click
    }
}

// drawLoadingScreen is no longer needed as we use the HTML overlay

function loadImage(name, src) {
    images[name] = new Image();
    images[name].onload = assetLoaded;
    images[name].onerror = () => console.error(`圖片加載失敗: ${src}`);
    images[name].src = src;
}

function loadSound(name, elementId) {
    sounds[name] = document.getElementById(elementId);
    if (sounds[name]) {
        // Using 'loadeddata' might be slightly faster than 'canplaythrough' sometimes
        sounds[name].addEventListener('loadeddata', assetLoaded, { once: true });
        sounds[name].addEventListener('error', (e) => {
             console.error(`音效加載失敗: ${elementId}`, e);
             // Still count as loaded to not block the game start
             assetLoaded();
        });
        sounds[name].load(); // Explicitly call load
    } else {
        console.error(`找不到 ID 為 ${elementId} 的音頻元素`);
        assetLoaded(); // Count as loaded
    }
}

// --- 遊戲設定 ---
let gameWidth, gameHeight;
let scaleRatio = 1;

function resizeCanvas() {
    // Try to fill the window in landscape mode
    // Use innerWidth/Height for better compatibility in fullscreen/mobile
    const desiredWidth = window.innerWidth;
    const desiredHeight = window.innerHeight;

    // We force landscape later, so assume width > height
    const aspectRatio = 16 / 9; // Maintain this aspect ratio

    let newWidth, newHeight;

    // Calculate dimensions based on aspect ratio trying to fit the screen
    if (desiredWidth / desiredHeight >= aspectRatio) {
        // Window is wider than aspect ratio, height is the limiting factor
        newHeight = desiredHeight;
        newWidth = newHeight * aspectRatio;
    } else {
        // Window is narrower than aspect ratio, width is the limiting factor
        newWidth = desiredWidth;
        newHeight = newWidth / aspectRatio;
    }

    // Use devicePixelRatio for sharper graphics on high-DPI screens
    scaleRatio = window.devicePixelRatio || 1;
    canvas.width = newWidth * scaleRatio;
    canvas.height = newHeight * scaleRatio;
    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;

    gameWidth = canvas.width;
    gameHeight = canvas.height;

    // Re-calculate button positions after resize
    defineButtonAreas();

    console.log(`Canvas resized: ${newWidth}x${newHeight} (Device Scale: ${scaleRatio})`);
}


// --- 加載資源 ---
// Disable start button initially
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

// Load sounds with updated extensions
loadSound('bgMusic', 'bgMusic');
loadSound('shootSound', 'shootSound');
loadSound('jumpSound', 'jumpSound');

window.addEventListener('resize', resizeCanvas);
// Call resize initially after assets start loading
resizeCanvas();


// --- 遊戲變數 ---
let player;
let enemies = [];
let bullets = [];
let enemyBullets = [];
let obstacles = [];
let backgroundX = 0;
let score = 0;
let playerHealth = 3;
let gameOver = false;
let gameWon = false;
let gameRunning = false;
let animationFrameId;

const gravity = 0.6 * scaleRatio; // Slightly increased gravity might feel better
const playerSpeed = 6 * scaleRatio; // Slightly faster speed
const jumpStrength = -14 * scaleRatio; // Stronger jump
const bulletSpeed = 9 * scaleRatio;
const enemyBulletSpeed = 4 * scaleRatio;

let frameCount = 0;
const runFrameSpeed = 8; // Faster run animation
const enemyBFrameSpeed = 12;

// --- Button States and Definitions ---
let moveLeftPressed = false;
let moveRightPressed = false;
let jumpPressed = false;
let shootPressed = false;

let leftButtonRect = {};
let rightButtonRect = {};
let shootButtonRect = {};
let jumpButtonRect = {};
let buttonSize = 0; // Base size, will be scaled
let buttonMargin = 0;

function defineButtonAreas() {
    // Define buttons in the bottom-right corner
    buttonSize = Math.min(gameWidth, gameHeight) * 0.12; // Adjust size relative to screen
    buttonMargin = buttonSize * 0.15;
    const bottomMargin = buttonMargin * 2; // Extra margin from bottom

    // Layout: [Jump]
    //         [L][S][R]
    const shootX = gameWidth - buttonMargin - buttonSize * 1.5; // Center button X
    const shootY = gameHeight - bottomMargin - buttonSize;
    const leftX = shootX - buttonMargin - buttonSize;
    const rightX = shootX + buttonMargin + buttonSize;
    const jumpY = shootY - buttonMargin - buttonSize;

    leftButtonRect = { x: leftX, y: shootY, width: buttonSize, height: buttonSize, pressed: false };
    rightButtonRect = { x: rightX, y: shootY, width: buttonSize, height: buttonSize, pressed: false };
    shootButtonRect = { x: shootX, y: shootY, width: buttonSize, height: buttonSize, pressed: false };
    jumpButtonRect = { x: shootX, y: jumpY, width: buttonSize, height: buttonSize, pressed: false };
}
// Initial definition
defineButtonAreas();

// --- 物件類別 ---

// GameObject class remains the same

class Player extends GameObject {
    constructor(x, y) {
        // *** INCREASED PLAYER SIZE ***
        const playerWidth = 80; // Increased from 50
        const playerHeight = 80; // Increased from 50
        super(x, y, playerWidth, playerHeight, images.playerIdle);
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.facingRight = true;
        this.shooting = false;
        this.shootingCooldown = 0;
        this.runFrame = 0;
        this.invulnerable = false;
        this.invulnerableTimer = 0;
        this.invulnerableDuration = 120;
        this.shootFrameTimer = 0;
        this.shootFrameDuration = 15;
    }

    // Player update method: Use internal button states
    update(worldScrollX) {
        // --- Apply button states ---
        this.vx = 0;
        if (leftButtonRect.pressed) { // Use button rect state
            this.vx = -playerSpeed;
            this.facingRight = false;
        }
        if (rightButtonRect.pressed) { // Use button rect state
            this.vx = playerSpeed;
            this.facingRight = true;
        }

        // --- Physics ---
        this.x += this.vx;
        this.vy += gravity;
        this.y += this.vy;
        this.onGround = false;

        if (this.x < worldScrollX) {
            this.x = worldScrollX;
        }

        // *** Ground check updated for new height ***
        const groundY = gameHeight - this.height - 10 * scaleRatio;
        if (this.y >= groundY) {
            this.y = groundY;
            this.vy = 0;
            this.onGround = true;
        }

        // Obstacle collision (ensure this.height is used correctly)
        obstacles.forEach(obstacle => {
            const collideData = this.checkCollision(obstacle, worldScrollX);
            if (collideData.colliding) {
                 if (collideData.fromAbove && this.vy > 0) {
                    this.y = obstacle.y - this.height; // Use this.height
                    this.vy = 0;
                    this.onGround = true;
                } else if (!collideData.fromAbove && this.vy >= 0) {
                    if (this.vx > 0 && this.x + this.width > obstacle.x && this.x < obstacle.x) {
                         this.x = obstacle.x - this.width; // Use this.width
                         this.vx = 0;
                    }
                    else if (this.vx < 0 && this.x < obstacle.x + obstacle.width && this.x + this.width > obstacle.x + obstacle.width) {
                         this.x = obstacle.x + obstacle.width; // Use this.width
                         this.vx = 0;
                    }
                }
            }
        });


        // --- Jump (Triggered once) ---
        if (jumpPressed && this.onGround) {
            this.vy = jumpStrength;
            this.onGround = false;
            playSound(sounds.jumpSound);
            jumpPressed = false; // Reset trigger immediately
            jumpButtonRect.pressed = false; // Also visually reset button state if needed
        }

        // --- Shoot (Triggered once per cooldown) ---
        if (this.shootingCooldown > 0) {
            this.shootingCooldown--;
        }
        if (shootPressed && this.shootingCooldown <= 0) {
            this.shoot();
            this.shooting = true;
            this.shootFrameTimer = this.shootFrameDuration;
            this.shootingCooldown = 18; // Slightly faster shooting possible
            shootPressed = false; // Reset trigger immediately
            shootButtonRect.pressed = false; // Also visually reset button state
        }

        if (this.shootFrameTimer > 0) {
            this.shootFrameTimer--;
            if (this.shootFrameTimer <= 0) {
                this.shooting = false;
            }
        }

        // Invulnerability timer
        if (this.invulnerable) {
            this.invulnerableTimer--;
            if (this.invulnerableTimer <= 0) {
                this.invulnerable = false;
            }
        }
    }

    // Player draw method remains largely the same
    draw(offsetX = 0) {
        let currentImage;
        frameCount++;

        if (this.shooting && images.playerShoot) {
            currentImage = images.playerShoot;
        } else if (!this.onGround && images.playerJump) {
            currentImage = images.playerJump;
        } else if (this.vx !== 0 && images.playerRun1 && images.playerRun2) {
            const frameIndex = Math.floor(frameCount / runFrameSpeed) % 2;
            currentImage = (frameIndex === 0) ? images.playerRun1 : images.playerRun2;
        } else {
            currentImage = images.playerIdle;
        }

        if (!currentImage || !currentImage.complete || currentImage.naturalWidth === 0) {
            ctx.fillStyle = 'blue';
            ctx.fillRect(this.x - offsetX, this.y, this.width, this.height);
            return;
        }

        ctx.save();
        const drawX = this.x - offsetX;

        if (this.invulnerable && Math.floor(this.invulnerableTimer / 5) % 2 === 0) {
             ctx.globalAlpha = 0.5;
        }

        if (!this.facingRight) {
            ctx.scale(-1, 1);
            ctx.drawImage(currentImage, -(drawX + this.width), this.y, this.width, this.height);
        } else {
            ctx.drawImage(currentImage, drawX, this.y, this.width, this.height);
        }
        ctx.restore();
    }

    // Player shoot method: Adjust bullet spawn position based on new size
    shoot() {
        const bulletXOffset = this.width * 0.8; // Adjust as needed
        const bulletYOffset = this.height * 0.4; // Adjust as needed
        const bulletX = this.facingRight ? this.x + bulletXOffset : this.x + (this.width - bulletXOffset); // Position relative to facing dir
        const bulletY = this.y + bulletYOffset;
        const bulletVx = this.facingRight ? bulletSpeed : -bulletSpeed;

        bullets.push(new Bullet(bulletX, bulletY, 12 * scaleRatio, 6 * scaleRatio, bulletVx)); // Slightly bigger bullets
        playSound(sounds.shootSound);
    }

    // takeDamage and checkCollision methods remain the same
    takeDamage() {
         if (!this.invulnerable) {
             playerHealth--;
             console.log(`玩家受傷，剩餘生命: ${playerHealth}`);
             this.invulnerable = true;
             this.invulnerableTimer = this.invulnerableDuration;
             if (playerHealth <= 0) {
                 gameOver = true;
                 console.log("遊戲結束");
             }
         }
    }

    checkCollision(other, offsetX = 0) {
        // AABB Collision logic (no change needed here, uses this.x,y,width,height)
        const playerLeft = this.x;
        const playerRight = this.x + this.width;
        const playerTop = this.y;
        const playerBottom = this.y + this.height;

        const otherLeft = other.x;
        const otherRight = other.x + other.width;
        const otherTop = other.y;
        const otherBottom = other.y + other.height;

        const colliding = playerRight > otherLeft &&
                          playerLeft < otherRight &&
                          playerBottom > otherTop &&
                          playerTop < otherBottom;

        let fromAbove = false;
        if (colliding) {
             // Approximate check for landing on top
             if (this.vy > 0 && (playerBottom - this.vy * 1.1) <= otherTop) { // Check slightly ahead
                 fromAbove = true;
             }
        }
        return { colliding, fromAbove };
    }
}

// Bullet class remains the same
class Bullet extends GameObject {
    constructor(x, y, width, height, vx) {
        super(x, y, width, height, null);
        this.vx = vx;
    }
    update() { this.x += this.vx; }
    draw(offsetX = 0) {
        ctx.fillStyle = 'yellow';
        const drawX = this.x - offsetX;
        if (drawX + this.width > 0 && drawX < gameWidth) {
             ctx.fillRect(drawX, this.y, this.width, this.height);
        }
    }
}

// Enemy class remains the same (adjust sizes/positions in initGame if needed)
class Enemy extends GameObject {
     constructor(x, y, width, height, image, health, type) {
        super(x, y, width, height, image);
        this.initialHealth = health;
        this.health = health;
        this.type = type;
        this.shootCooldown = 0;
        this.shootTimer = Math.random() * 100 + 100;
        this.vx = 0;
        this.moveDirection = 1;
        this.moveRange = 100 * scaleRatio;
        this.initialX = x * scaleRatio;
        this.animationFrame = 0;
        this.actionFrameTimer = 0;
        this.actionFrameDuration = 20;
        this.isShooting = false;
    }

    update(playerX, worldScrollX) {
         this.actionFrameTimer--;
         if (this.actionFrameTimer <= 0) this.isShooting = false;

        if (this.type === 'A') {
            this.shootTimer--;
             // Check if player is roughly on the same horizontal plane and within range
             const verticalDiff = Math.abs(player.y + player.height / 2 - (this.y + this.height / 2));
             const horizontalDist = Math.abs(this.x - playerX);
             if (this.shootTimer <= 0 && verticalDiff < gameHeight * 0.5 && horizontalDist < gameWidth * 0.9) {
                this.shoot(playerX);
                this.shootTimer = 120 + Math.random() * 60;
                this.isShooting = true;
                this.actionFrameTimer = this.actionFrameDuration;
            }
        } else if (this.type === 'B') {
            this.vx = 2 * scaleRatio * this.moveDirection;
            this.x += this.vx;
             if (Math.abs(this.x - this.initialX) > this.moveRange) {
                  this.moveDirection *= -1;
                  this.x += this.vx; // Move one step back into range
             }
            this.animationFrame++;
        } else if (this.type === 'C') {
            this.shootTimer--;
            const horizontalDist = Math.abs(this.x - playerX);
            if (this.shootTimer <= 0 && horizontalDist < gameWidth * 1.1) { // Boss range wider
                this.shootSpread();
                this.shootTimer = 150 + Math.random() * 80; // Boss shoots slightly faster
                this.isShooting = true;
                this.actionFrameTimer = this.actionFrameDuration;
            }
        }
    }

    // Enemy draw method (no changes needed for logic)
    draw(offsetX = 0) {
        let currentImage = this.image;
         if (this.isShooting) {
             if (this.type === 'A' && images.enemyAShoot) currentImage = images.enemyAShoot;
             if (this.type === 'C' && images.enemyCShoot) currentImage = images.enemyCShoot;
         } else if (this.type === 'B' && images.enemyB1 && images.enemyB2) {
             const frameIndex = Math.floor(this.animationFrame / enemyBFrameSpeed) % 2;
             currentImage = (frameIndex === 0) ? images.enemyB1 : images.enemyB2;
         }

         if (currentImage && currentImage.complete && currentImage.naturalWidth > 0) {
             const drawX = this.x - offsetX;
             if (drawX + this.width > 0 && drawX < gameWidth) {
                 ctx.save();
                 if (this.type === 'B' && this.moveDirection < 0) {
                     ctx.scale(-1, 1);
                     ctx.drawImage(currentImage, -(drawX + this.width), this.y, this.width, this.height);
                 } else {
                     ctx.drawImage(currentImage, drawX, this.y, this.width, this.height);
                 }
                 ctx.restore();

                 // Draw health bar
                 const healthBarWidth = this.width * 0.8;
                 const healthBarHeight = 6 * scaleRatio; // Slightly thicker bar
                 const healthBarX = drawX + (this.width - healthBarWidth) / 2;
                 const healthBarY = this.y - healthBarHeight - 6 * scaleRatio;
                 const healthPercentage = Math.max(0, this.health / this.initialHealth); // Ensure percentage >= 0

                 ctx.fillStyle = '#555'; // Dark background for bar
                 ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
                 ctx.fillStyle = healthPercentage > 0.5 ? 'lime' : (healthPercentage > 0.2 ? 'yellow' : 'red'); // Color changes with health
                 ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercentage, healthBarHeight);
                 // Add a thin border
                 ctx.strokeStyle = '#333';
                 ctx.lineWidth = 1;
                 ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

             }
         } else {
             ctx.fillStyle = 'red';
             ctx.fillRect(this.x - offsetX, this.y, this.width, this.height);
         }
    }

    // Enemy shoot methods remain the same
    shoot(playerX) {
        const bulletX = this.x + this.width / 2;
        const bulletY = this.y + this.height / 2;
        const angle = Math.atan2((player.y + player.height/2) - (this.y + this.height/2), (player.x + player.width/2) - (this.x + this.width/2)); // Target player center
        const bulletVx = Math.cos(angle) * enemyBulletSpeed;
        const bulletVy = Math.sin(angle) * enemyBulletSpeed;
        enemyBullets.push(new EnemyBullet(bulletX, bulletY, 8 * scaleRatio, 8 * scaleRatio, bulletVx, bulletVy));
    }

    shootSpread() {
        const bulletX = this.x + this.width / 2;
        const bulletY = this.y + this.height / 2;
        const numBullets = 5;
        const angleSpread = Math.PI / 4; // Wider spread for Boss
        const baseAngle = Math.atan2((player.y + player.height/2) - (this.y + this.height/2), (player.x + player.width/2) - (this.x + this.width/2)); // Aim towards player generally
        const startAngle = baseAngle - angleSpread / 2;

        for (let i = 0; i < numBullets; i++) {
            const angle = startAngle + (angleSpread / (numBullets - 1)) * i;
            const bulletVx = Math.cos(angle) * enemyBulletSpeed * 1.1; // Boss bullets slightly faster
            const bulletVy = Math.sin(angle) * enemyBulletSpeed * 1.1;
            enemyBullets.push(new EnemyBullet(bulletX, bulletY, 10 * scaleRatio, 10 * scaleRatio, bulletVx, bulletVy));
        }
    }

    // Enemy takeDamage remains the same
    takeDamage(amount) {
        this.health -= amount;
    }
}


// EnemyBullet class remains the same
class EnemyBullet extends GameObject {
     constructor(x, y, width, height, vx, vy) {
        super(x, y, width, height, null);
        this.vx = vx;
        this.vy = vy;
    }
    update() { this.x += this.vx; this.y += this.vy; }
    draw(offsetX = 0) {
        ctx.fillStyle = 'orange';
        const drawX = this.x - offsetX;
         if (drawX + this.width > 0 && drawX < gameWidth && this.y + this.height > 0 && this.y < gameHeight) {
            ctx.fillRect(drawX, this.y, this.width, this.height);
         }
    }
}

// Obstacle class remains the same
class Obstacle extends GameObject {
     constructor(x, y, width, height) {
         super(x, y, width, height, images.obstacle);
     }
     draw(offsetX = 0) { // Ensure obstacle draw uses offset
          if (this.image && this.image.complete && this.image.naturalWidth > 0) {
             const drawX = this.x - offsetX;
             if (drawX + this.width > 0 && drawX < gameWidth) {
                 ctx.drawImage(this.image, drawX, this.y, this.width, this.height);
             }
        } else {
             ctx.fillStyle = '#8B4513'; // Brown placeholder
             ctx.fillRect(this.x - offsetX, this.y, this.width, this.height);
        }
     }
}


// --- 遊戲初始化 ---
function initGame() {
    gameOver = false;
    gameWon = false;
    playerHealth = 3;
    score = 0;
    backgroundX = 0;
    enemies = [];
    bullets = [];
    enemyBullets = [];
    obstacles = [];

    // *** Player initial position updated for larger size ***
    // Place player near bottom left, considering new height
    player = new Player(100 * scaleRatio, gameHeight - (80 + 10) * scaleRatio);

    // Obstacles (adjust positions/sizes if needed due to player size change)
    // Keep positions relative to gameHeight
    obstacles.push(new Obstacle(350, gameHeight - 100 * scaleRatio, 80, 50));
    obstacles.push(new Obstacle(650, gameHeight - 160 * scaleRatio, 120, 80)); // Higher platform
    obstacles.push(new Obstacle(1000, gameHeight - 80 * scaleRatio, 60, 60));

    // Enemies (adjust positions, especially Y, if needed)
    const enemyAW = 40; const enemyAH = 40;
    const enemyBW = 45; const enemyBH = 45;
    const enemyCW = 80; const enemyCH = 80; // Boss size

    enemies.push(new Enemy(550, gameHeight - (10 + enemyAH) * scaleRatio, enemyAW, enemyAH, images.enemyA, 2, 'A'));
    enemies.push(new Enemy(850, gameHeight - (10 + enemyBH) * scaleRatio, enemyBW, enemyBH, images.enemyB1, 1, 'B'));
    enemies.push(new Enemy(1150, gameHeight - (10 + enemyAH) * scaleRatio, enemyAW, enemyAH, images.enemyA, 2, 'A'));
    // C 怪 (Boss) - Ensure Y position is correct
    enemies.push(new Enemy(1600, gameHeight - (10 + enemyCH) * scaleRatio, enemyCW, enemyCH, images.enemyC, 15, 'C'));

    console.log("遊戲初始化完成");
}

// --- Helper function to get canvas coordinates from touch/mouse event ---
function getCanvasCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    let x, y;

    if (event.touches && event.touches.length > 0) {
        // Use the first touch point
        x = event.touches[0].clientX - rect.left;
        y = event.touches[0].clientY - rect.top;
    } else if (event.clientX !== undefined) {
        x = event.clientX - rect.left;
        y = event.clientY - rect.top;
    } else {
        return null; // Invalid event
    }

    // Scale coordinates to match canvas internal resolution
    return {
        x: x * scaleRatio,
        y: y * scaleRatio
    };
}

// --- Canvas Input Handling ---
let activeTouches = {}; // Store active touch identifiers and their associated button

function handleCanvasInputStart(event) {
    event.preventDefault();
    const touches = event.changedTouches || [event]; // Handle both touch and mouse events

    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const coords = getCanvasCoordinates(touch);
        const identifier = touch.identifier !== undefined ? touch.identifier : 'mouse'; // Use 'mouse' for mouse events

        if (!coords) continue;

        // Check which button is pressed
        if (isPointInRect(coords, leftButtonRect)) {
            leftButtonRect.pressed = true;
            activeTouches[identifier] = 'left';
        } else if (isPointInRect(coords, rightButtonRect)) {
            rightButtonRect.pressed = true;
            activeTouches[identifier] = 'right';
        } else if (isPointInRect(coords, shootButtonRect)) {
            shootPressed = true; // Trigger shoot
            shootButtonRect.pressed = true;
            activeTouches[identifier] = 'shoot';
        } else if (isPointInRect(coords, jumpButtonRect)) {
            jumpPressed = true; // Trigger jump
            jumpButtonRect.pressed = true;
            activeTouches[identifier] = 'jump';
        }
    }
}

function handleCanvasInputEnd(event) {
    event.preventDefault();
    const touches = event.changedTouches || [event]; // Handle both touch and mouse events

    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const identifier = touch.identifier !== undefined ? touch.identifier : 'mouse';
        const pressedButton = activeTouches[identifier];

        // Release the corresponding button state
        if (pressedButton === 'left') {
            leftButtonRect.pressed = false;
        } else if (pressedButton === 'right') {
            rightButtonRect.pressed = false;
        } else if (pressedButton === 'shoot') {
             shootButtonRect.pressed = false; // Visual release
             // shootPressed is reset in update logic
        } else if (pressedButton === 'jump') {
             jumpButtonRect.pressed = false; // Visual release
             // jumpPressed is reset in update logic
        }

        delete activeTouches[identifier]; // Remove the touch identifier
    }
}

function isPointInRect(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.width &&
           point.y >= rect.y && point.y <= rect.y + rect.height;
}

// Add listeners to canvas
canvas.addEventListener('touchstart', handleCanvasInputStart, { passive: false });
canvas.addEventListener('touchend', handleCanvasInputEnd, { passive: false });
canvas.addEventListener('touchcancel', handleCanvasInputEnd, { passive: false }); // Handle cancels

// Add mouse listeners for desktop testing
canvas.addEventListener('mousedown', handleCanvasInputStart, { passive: false });
canvas.addEventListener('mouseup', handleCanvasInputEnd, { passive: false });
canvas.addEventListener('mouseleave', handleCanvasInputEnd, { passive: false }); // Release if mouse leaves canvas


// --- Drawing Controls ---
function drawControls() {
    ctx.save();
    ctx.globalAlpha = 0.6; // Make buttons slightly transparent
    ctx.fillStyle = '#888'; // Default button color
    ctx.strokeStyle = '#FFF'; // Button border color
    ctx.lineWidth = 2 * scaleRatio;
    ctx.font = `${buttonSize * 0.4}px Arial`; // Adjust font size relative to button
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw Left Button
    ctx.fillStyle = leftButtonRect.pressed ? '#AAA' : '#888';
    ctx.fillRect(leftButtonRect.x, leftButtonRect.y, leftButtonRect.width, leftButtonRect.height);
    ctx.strokeRect(leftButtonRect.x, leftButtonRect.y, leftButtonRect.width, leftButtonRect.height);
    ctx.fillStyle = '#FFF';
    ctx.fillText('◀', leftButtonRect.x + leftButtonRect.width / 2, leftButtonRect.y + leftButtonRect.height / 2);

    // Draw Right Button
    ctx.fillStyle = rightButtonRect.pressed ? '#AAA' : '#888';
    ctx.fillRect(rightButtonRect.x, rightButtonRect.y, rightButtonRect.width, rightButtonRect.height);
    ctx.strokeRect(rightButtonRect.x, rightButtonRect.y, rightButtonRect.width, rightButtonRect.height);
    ctx.fillStyle = '#FFF';
    ctx.fillText('▶', rightButtonRect.x + rightButtonRect.width / 2, rightButtonRect.y + rightButtonRect.height / 2);

    // Draw Shoot Button
    ctx.fillStyle = shootButtonRect.pressed ? '#AAA' : '#888';
    ctx.fillRect(shootButtonRect.x, shootButtonRect.y, shootButtonRect.width, shootButtonRect.height);
    ctx.strokeRect(shootButtonRect.x, shootButtonRect.y, shootButtonRect.width, shootButtonRect.height);
    ctx.fillStyle = '#FFF';
    ctx.fillText('◎', shootButtonRect.x + shootButtonRect.width / 2, shootButtonRect.y + shootButtonRect.height / 2); // Shoot symbol

    // Draw Jump Button
    ctx.fillStyle = jumpButtonRect.pressed ? '#AAA' : '#888';
    ctx.fillRect(jumpButtonRect.x, jumpButtonRect.y, jumpButtonRect.width, jumpButtonRect.height);
    ctx.strokeRect(jumpButtonRect.x, jumpButtonRect.y, jumpButtonRect.width, jumpButtonRect.height);
    ctx.fillStyle = '#FFF';
    ctx.fillText('▲', jumpButtonRect.x + jumpButtonRect.width / 2, jumpButtonRect.y + jumpButtonRect.height / 2); // Jump symbol

    ctx.restore();
}


// --- 遊戲循環 ---
function gameLoop() {
    if (gameOver || gameWon) {
        displayEndScreen();
        gameRunning = false; // Mark game as not running
        // Keep listening for restart click on canvas
        return;
    }
    gameRunning = true;

    ctx.clearRect(0, 0, gameWidth, gameHeight);

    // Calculate world scroll
    let targetScrollX = player.x - gameWidth / 3.5; // Keep player slightly more to the left
    const levelWidth = 2000 * scaleRatio; // Adjust this based on your actual level design
    targetScrollX = Math.max(0, Math.min(targetScrollX, levelWidth - gameWidth));
    // Smoother scrolling
    backgroundX += (targetScrollX - backgroundX) * 0.1;
    // Prevent sub-pixel issues for drawing if needed, but smooth scroll is usually fine
    // backgroundX = Math.round(backgroundX);

    // Draw Background
    if (images.background && images.background.complete) {
        // Adjust width calculation if background aspect ratio is different
        const bgRatio = images.background.width / images.background.height;
        const bgWidth = gameHeight * bgRatio;
        const pattern = ctx.createPattern(images.background, 'repeat-x');

        ctx.save();
        ctx.translate(-backgroundX % bgWidth, 0);
        ctx.fillStyle = pattern || '#abcdef'; // Fallback color
        ctx.fillRect(0, 0, gameWidth + bgWidth, gameHeight); // Draw extra width for seamless repeat
        ctx.restore();
    } else {
        ctx.fillStyle = '#abcdef';
        ctx.fillRect(0, 0, gameWidth, gameHeight);
    }

    // Update & Draw Obstacles
    obstacles.forEach(obstacle => obstacle.draw(backgroundX));

    // Update & Draw Player
    player.update(backgroundX);
    player.draw(backgroundX);

    // Update & Draw Enemies & Check Player Collision
    enemies.forEach((enemy, index) => {
        enemy.update(player.x, backgroundX);
        enemy.draw(backgroundX);
        if (!player.invulnerable && player.checkCollision(enemy, backgroundX).colliding) {
             player.takeDamage();
        }
    });

    // Update & Draw Bullets & Check Enemy Collision
    bullets = bullets.filter((bullet, bulletIndex) => {
        bullet.update();
        let hit = false;
        enemies.forEach((enemy, enemyIndex) => {
            if (!hit && // Only process hit once per bullet per frame
                bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y)
            {
                hit = true;
                enemy.takeDamage(1);
                if (enemy.health <= 0) {
                    if (enemy.type === 'C') {
                        gameWon = true;
                        console.log("恭喜你獲勝了！");
                    }
                    enemies.splice(enemyIndex, 1);
                }
            }
        });

        // Keep bullet if not hit AND within screen bounds (relative to scroll)
        const bulletDrawX = bullet.x - backgroundX;
        const keepBullet = !hit && bulletDrawX < gameWidth && bulletDrawX + bullet.width > 0;
        if (keepBullet) {
             bullet.draw(backgroundX);
        }
        return keepBullet; // Filter out hit or off-screen bullets
    });


    // Update & Draw Enemy Bullets & Check Player Collision
    enemyBullets = enemyBullets.filter((bullet, index) => {
         bullet.update();
         let hitPlayer = false;
         if (!player.invulnerable && player.checkCollision(bullet, backgroundX).colliding) {
             player.takeDamage();
             hitPlayer = true;
         }

         // Keep bullet if not hit AND within screen bounds (relative to scroll)
         const bulletDrawX = bullet.x - backgroundX;
         const keepBullet = !hitPlayer && bulletDrawX < gameWidth && bulletDrawX + bullet.width > 0 && bullet.y < gameHeight && bullet.y + bullet.height > 0;
          if (keepBullet) {
               bullet.draw(backgroundX);
          }
         return keepBullet; // Filter out hit or off-screen bullets
    });

    // --- Draw UI ---
    displayUI();

    // --- Draw Controls on top ---
    drawControls();

    // --- Request next frame ---
    animationFrameId = requestAnimationFrame(gameLoop);
}

// UI display remains the same
function displayUI() {
    ctx.save(); // Save context state before drawing UI
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // Slightly transparent white
    ctx.font = `${Math.max(18, 22 * (gameHeight / 600))}px Arial`; // Scale font slightly with height
    ctx.textAlign = 'left';
    ctx.shadowColor = 'black'; // Add shadow for better readability
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillText(`生命: ${playerHealth}`, 15 * scaleRatio, 35 * scaleRatio);
    // Add score if needed
    // ctx.textAlign = 'right';
    // ctx.fillText(`分數: ${score}`, gameWidth - 15 * scaleRatio, 35 * scaleRatio);
    ctx.restore(); // Restore context state
}


// End screen - add listener to canvas for restart
function displayEndScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, gameWidth, gameHeight);

    ctx.fillStyle = 'white';
    ctx.font = `${Math.max(30, 45 * (gameHeight / 600))}px Arial`; // Scaled font
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;

    if (gameWon) {
        ctx.fillText('勝利!', gameWidth / 2, gameHeight / 2 - 50 * scaleRatio);
    } else {
        ctx.fillText('遊戲結束', gameWidth / 2, gameHeight / 2 - 50 * scaleRatio);
    }

    ctx.font = `${Math.max(18, 25 * (gameHeight / 600))}px Arial`;
    ctx.fillText(`剩餘生命: ${playerHealth > 0 ? playerHealth : 0}`, gameWidth / 2, gameHeight / 2 + 10 * scaleRatio);
    ctx.fillText('點擊螢幕重新開始', gameWidth / 2, gameHeight / 2 + 60 * scaleRatio);

    // Stop background music
    if (sounds.bgMusic) {
        sounds.bgMusic.pause();
        sounds.bgMusic.currentTime = 0;
    }

    // We already have the canvas listener for input, it will trigger restartGameOnce
}

// Sound playback helper
function playSound(soundElement) {
     if (soundElement && soundElement.readyState >= 2) { // HAVE_CURRENT_DATA or more
        soundElement.currentTime = 0;
        soundElement.play().catch(e => { /* Ignore errors maybe? Or log them */ });
     }
}

// --- Game Start / Restart Logic ---
let gameHasStarted = false;

// This function is now triggered by the start button
async function handleStartGameClick() {
    if (assetsLoaded < totalAssets) {
        console.log("資源仍在加載...");
        return; // Don't start yet
    }
    if (gameHasStarted) {
        console.log("遊戲已啟動");
        return; // Prevent multiple starts
    }
    gameHasStarted = true; // Mark as started immediately
    console.log("開始遊戲程序...");

    // Hide start screen
    if (startScreen) startScreen.style.display = 'none';

    try {
        // 1. Request Fullscreen
        console.log("請求全螢幕...");
        if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) { /* Safari */
            await document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) { /* IE11 */
            await document.documentElement.msRequestFullscreen();
        }
        console.log("進入全螢幕模式 (或已在全螢幕)");

        // 2. Lock Orientation (within fullscreen promise)
        console.log("嘗試鎖定橫向...");
        try {
            // Check for screen.orientation and lock method
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('landscape');
                console.log("已鎖定為橫向");
            } else {
                console.warn("瀏覽器不支援 screen.orientation.lock API");
            }
        } catch (err) {
            console.error("鎖定橫向失敗:", err);
            // Game can still proceed even if locking fails
        }

        // Wait a brief moment for orientation change to potentially settle
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay

        // 3. Resize canvas again after potential orientation change/fullscreen
        resizeCanvas();

        // 4. Initialize and Start Game Loop
        console.log("初始化遊戲...");
        initGame();
        gameRunning = true;

        // 5. Play Background Music
        if (sounds.bgMusic) {
            sounds.bgMusic.play().catch(e => console.error("背景音樂播放失敗:", e));
        } else {
            console.log("背景音樂元素未找到或未加載");
        }

        // 6. Start Game Loop
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        gameLoop();

    } catch (err) {
        console.error("進入全螢幕或鎖定方向時出錯:", err);
        // Fallback: Start game anyway without fullscreen/lock if failed severely
        if (!gameRunning) { // Ensure game doesn't start twice
             console.warn("以非全螢幕模式啟動遊戲...");
             resizeCanvas(); // Ensure canvas size is reasonable
             initGame();
             gameRunning = true;
             if (sounds.bgMusic) sounds.bgMusic.play().catch(e => console.error("背景音樂播放失敗:", e));
             if (animationFrameId) cancelAnimationFrame(animationFrameId);
             gameLoop();
        }
         // Show start screen again maybe? Or provide a message
         // if (startScreen) startScreen.style.display = 'flex'; // Optionally show again
         // gameHasStarted = false; // Allow retry?
    }
}


// --- Restart Logic (triggered by canvas click when game is over) ---
function restartGameOnce(event) {
     // Check if the game is actually over and not running
     if (!gameRunning && (gameOver || gameWon)) {
         console.log("重新啟動遊戲...");
         // Reset game state variables
         gameOver = false;
         gameWon = false;
         gameHasStarted = true; // It has started before, now restarting

         // Re-initialize game elements
         initGame();

         // Restart background music
         if (sounds.bgMusic) {
             sounds.bgMusic.currentTime = 0;
             sounds.bgMusic.play().catch(e => console.error("背景音樂播放失敗:", e));
         }

         // Start the game loop again
         gameRunning = true;
         if (animationFrameId) cancelAnimationFrame(animationFrameId);
         gameLoop();
     } else if (gameRunning) {
         // If game is running, the click might be for controls, handled by handleCanvasInputStart/End
         // Do nothing here for restart
     } else {
          // Game not started yet, or in loading phase, do nothing on canvas click for restart
     }
}

// Add listener to the start button
if (startButton) {
    startButton.addEventListener('click', handleStartGameClick);
} else {
    console.error("找不到開始按鈕!");
}

// Add a general canvas click listener specifically for restarting *after* game over
canvas.addEventListener('click', restartGameOnce);

// Initial resize call
resizeCanvas();
