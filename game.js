// --- Existing code at the top (canvas, ctx, startScreen, etc.) ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');
const loadingText = document.getElementById('loadingText');

// --- 資源加載 (保持不變) ---
const images = {};
const sounds = {};
let assetsLoaded = 0;
const totalAssets = 15;

function assetLoaded() {
    assetsLoaded++;
    const progressText = `正在加載資源... (${assetsLoaded}/${totalAssets})`;
    if (loadingText) {
        loadingText.textContent = progressText;
    } else {
        console.log(progressText);
    }

    if (assetsLoaded >= totalAssets) {
        console.log("所有資源已加載");
        if (startButton) {
            startButton.disabled = false;
            startButton.textContent = "開始遊戲";
            loadingText.textContent = "資源加載完成! 請點擊開始。"; // 更明確的提示
        } else {
             console.error("找不到 Start Button");
        }
    }
}

function loadImage(name, src) {
    images[name] = new Image();
    images[name].onload = assetLoaded;
    images[name].onerror = () => {
        console.error(`圖片加載失敗: ${src}`);
        assetLoaded(); // 即使失敗也要計數，避免卡住
    };
    images[name].src = src;
}

function loadSound(name, elementId) {
    sounds[name] = document.getElementById(elementId);
    if (sounds[name]) {
        // 'loadeddata' is usually sufficient
        sounds[name].addEventListener('loadeddata', assetLoaded, { once: true });
        sounds[name].addEventListener('error', (e) => {
             console.error(`音效加載失敗: ${elementId}`, e);
             assetLoaded(); // 即使失敗也要計數
        });
        sounds[name].load(); // Call load explicitly
    } else {
        console.error(`找不到 ID 為 ${elementId} 的音頻元素`);
        assetLoaded(); // Count anyway
    }
}


// --- 遊戲設定 ---
let gameWidth, gameHeight;
let scaleRatio = 1;
// *** 性能選項：是否使用 Device Pixel Ratio 提高清晰度 ***
// true = 更清晰，但可能影響性能; false = 性能較好，可能稍模糊
const USE_DEVICE_PIXEL_RATIO = true;


function resizeCanvas() {
    const desiredWidth = window.innerWidth;
    const desiredHeight = window.innerHeight;
    const aspectRatio = 16 / 9;

    let newWidth, newHeight;

    if (desiredWidth / desiredHeight >= aspectRatio) {
        newHeight = desiredHeight;
        newWidth = newHeight * aspectRatio;
    } else {
        newWidth = desiredWidth;
        newHeight = newWidth / aspectRatio;
    }

    // *** Apply Device Pixel Ratio conditionally ***
    scaleRatio = (USE_DEVICE_PIXEL_RATIO && window.devicePixelRatio) ? window.devicePixelRatio : 1;

    canvas.width = newWidth * scaleRatio;
    canvas.height = newHeight * scaleRatio;
    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;

    gameWidth = canvas.width;
    gameHeight = canvas.height;

    defineButtonAreas(); // Re-calculate button positions

    console.log(`Canvas resized: Style=${newWidth}x${newHeight}, Internal=${canvas.width}x${canvas.height}, ScaleRatio=${scaleRatio}`);

     // If game is over/won, redraw the end screen in the new size
     if (!gameRunning && (gameOver || gameWon)) {
        displayEndScreen();
     }
}

// --- Load Assets (calls remain the same) ---
if(startButton) startButton.disabled = true;
loadImage('playerIdle', '1.png'); // ... (rest of the loadImage calls)
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
resizeCanvas(); // Initial size calculation

// --- Game Variables (remain the same) ---
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

// Adjust physics slightly if needed based on testing
const gravity = 0.6 * scaleRatio;
const playerSpeed = 6 * scaleRatio;
const jumpStrength = -14 * scaleRatio;
const bulletSpeed = 9 * scaleRatio;
const enemyBulletSpeed = 4 * scaleRatio;

let frameCount = 0;
const runFrameSpeed = 8;
const enemyBFrameSpeed = 12;


// --- Button States and Definitions (remain the same) ---
let moveLeftPressed = false;
let moveRightPressed = false;
let jumpPressed = false;
let shootPressed = false;

let leftButtonRect = {};
let rightButtonRect = {};
let shootButtonRect = {};
let jumpButtonRect = {};
let buttonSize = 0;
let buttonMargin = 0;

function defineButtonAreas() {
    buttonSize = Math.min(gameWidth, gameHeight) * 0.13; // Slightly larger buttons
    buttonMargin = buttonSize * 0.15;
    const bottomMargin = buttonMargin * 2;

    const shootX = gameWidth - buttonMargin - buttonSize * 1.5;
    const shootY = gameHeight - bottomMargin - buttonSize;
    const leftX = shootX - buttonMargin - buttonSize;
    const rightX = shootX + buttonMargin + buttonSize;
    const jumpY = shootY - buttonMargin - buttonSize;

    // Ensure buttons don't go off-screen if calculation is weird
    const minX = buttonMargin;
    const minY = buttonMargin;

    leftButtonRect = { x: Math.max(minX, leftX), y: Math.max(minY, shootY), width: buttonSize, height: buttonSize, pressed: false };
    rightButtonRect = { x: Math.max(minX, rightX), y: Math.max(minY, shootY), width: buttonSize, height: buttonSize, pressed: false };
    shootButtonRect = { x: Math.max(minX, shootX), y: Math.max(minY, shootY), width: buttonSize, height: buttonSize, pressed: false };
    jumpButtonRect = { x: Math.max(minX, shootX), y: Math.max(minY, jumpY), width: buttonSize, height: buttonSize, pressed: false };

    // console.log("Button Areas:", leftButtonRect, rightButtonRect, shootButtonRect, jumpButtonRect); // Debugging line
}
defineButtonAreas();


// --- 物件類別 (Player, Bullet, Enemy, EnemyBullet, Obstacle classes remain largely the same) ---
// Make sure all drawing methods use the 'offsetX' correctly
// Make sure collision checks use scaled dimensions/positions correctly

// Example: Small check within Player.update ground collision
// ... inside Player.update ...
        const groundY = gameHeight - this.height - 10 * scaleRatio;
        if (this.y >= groundY) {
            // Add a small tolerance or check if vy is positive to prevent sticking
            if (this.vy >= 0) {
                this.y = groundY;
                this.vy = 0;
                this.onGround = true;
            }
        }
// ... rest of Player class ...

// --- 遊戲初始化 (initGame remains the same) ---
function initGame() {
    console.log("initGame: Initializing game state..."); // Debug log
    gameOver = false;
    gameWon = false;
    playerHealth = 3;
    score = 0;
    backgroundX = 0;
    enemies = [];
    bullets = [];
    enemyBullets = [];
    obstacles = [];

    player = new Player(100 * scaleRatio, gameHeight - (80 + 10) * scaleRatio);

    // Add obstacles and enemies (code is the same, but uses scaled values now)
    obstacles.push(new Obstacle(350, gameHeight - 100 * scaleRatio, 80, 50));
    obstacles.push(new Obstacle(650, gameHeight - 160 * scaleRatio, 120, 80));
    obstacles.push(new Obstacle(1000, gameHeight - 80 * scaleRatio, 60, 60));

    const enemyAW = 40; const enemyAH = 40;
    const enemyBW = 45; const enemyBH = 45;
    const enemyCW = 80; const enemyCH = 80;

    enemies.push(new Enemy(550, gameHeight - (10 + enemyAH) * scaleRatio, enemyAW, enemyAH, images.enemyA, 2, 'A'));
    enemies.push(new Enemy(850, gameHeight - (10 + enemyBH) * scaleRatio, enemyBW, enemyBH, images.enemyB1, 1, 'B'));
    enemies.push(new Enemy(1150, gameHeight - (10 + enemyAH) * scaleRatio, enemyAW, enemyAH, images.enemyA, 2, 'A'));
    enemies.push(new Enemy(1600, gameHeight - (10 + enemyCH) * scaleRatio, enemyCW, enemyCH, images.enemyC, 15, 'C'));

    console.log("initGame: Initialization complete."); // Debug log
}


// --- Helper function to get canvas coordinates (Improved Error Checking) ---
function getCanvasCoordinates(event) {
    try {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else if (event.changedTouches && event.changedTouches.length > 0) {
            // Use changedTouches for touchend/touchcancel
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
        } else if (event.clientX !== undefined && event.clientY !== undefined) {
             // Mouse event
            clientX = event.clientX;
            clientY = event.clientY;
        } else {
            // console.warn("Cannot get coordinates from event:", event);
            return null;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Ensure scaleRatio is a valid number
        const currentScaleRatio = (USE_DEVICE_PIXEL_RATIO && window.devicePixelRatio) ? window.devicePixelRatio : 1;

        return {
            x: x * currentScaleRatio,
            y: y * currentScaleRatio
        };
    } catch (e) {
        console.error("Error in getCanvasCoordinates:", e);
        return null;
    }
}

// --- Canvas Input Handling (More logging, robust checks) ---
let activeTouches = {};

function handleCanvasInputStart(event) {
    // console.log("Input Start:", event.type); // Debug log
    event.preventDefault();
    const touches = event.changedTouches || [event]; // Use changedTouches for consistency

    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const coords = getCanvasCoordinates(touch);
        const identifier = touch.identifier !== undefined ? touch.identifier : 'mouse';

        if (!coords) {
            // console.warn("Could not get coords for touch start:", identifier);
            continue; // Skip if coordinates are invalid
        };
        // console.log(`Touch Start: id=${identifier}, x=${coords.x.toFixed(1)}, y=${coords.y.toFixed(1)}`); // Detailed Log

        // Check which button is pressed, avoid assigning multiple buttons to one touch
        if (activeTouches[identifier]) continue; // Already processing this touch

        if (isPointInRect(coords, leftButtonRect)) {
            // console.log("Left Pressed");
            leftButtonRect.pressed = true;
            activeTouches[identifier] = 'left';
        } else if (isPointInRect(coords, rightButtonRect)) {
            // console.log("Right Pressed");
            rightButtonRect.pressed = true;
            activeTouches[identifier] = 'right';
        } else if (isPointInRect(coords, shootButtonRect)) {
             // console.log("Shoot Triggered");
            shootPressed = true; // Trigger shoot
            shootButtonRect.pressed = true;
            activeTouches[identifier] = 'shoot';
        } else if (isPointInRect(coords, jumpButtonRect)) {
             // console.log("Jump Triggered");
            jumpPressed = true; // Trigger jump
            jumpButtonRect.pressed = true;
            activeTouches[identifier] = 'jump';
        }
    }
}

function handleCanvasInputEnd(event) {
    // console.log("Input End:", event.type); // Debug log
    event.preventDefault();
    const touches = event.changedTouches || [event];

    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const identifier = touch.identifier !== undefined ? touch.identifier : 'mouse';
        const pressedButton = activeTouches[identifier];
        // const coords = getCanvasCoordinates(touch); // Optional: log end coords
        // if(coords) console.log(`Touch End: id=${identifier}, x=${coords.x.toFixed(1)}, y=${coords.y.toFixed(1)}, button=${pressedButton}`);


        if (pressedButton) {
            // console.log(`Releasing button: ${pressedButton}`);
             if (pressedButton === 'left') leftButtonRect.pressed = false;
             else if (pressedButton === 'right') rightButtonRect.pressed = false;
             else if (pressedButton === 'shoot') shootButtonRect.pressed = false;
             else if (pressedButton === 'jump') jumpButtonRect.pressed = false;

             delete activeTouches[identifier]; // Remove the touch identifier
        } else {
             // console.warn("End event for unknown touch identifier:", identifier);
        }
    }
}

function isPointInRect(point, rect) {
    return point && rect && // Ensure objects exist
           point.x >= rect.x && point.x <= rect.x + rect.width &&
           point.y >= rect.y && point.y <= rect.y + rect.height;
}

// Remove old listeners first (prevent duplicates if script re-runs)
canvas.removeEventListener('touchstart', handleCanvasInputStart);
canvas.removeEventListener('touchend', handleCanvasInputEnd);
canvas.removeEventListener('touchcancel', handleCanvasInputEnd);
canvas.removeEventListener('mousedown', handleCanvasInputStart);
canvas.removeEventListener('mouseup', handleCanvasInputEnd);
canvas.removeEventListener('mouseleave', handleCanvasInputEnd);

// Add listeners
canvas.addEventListener('touchstart', handleCanvasInputStart, { passive: false });
canvas.addEventListener('touchend', handleCanvasInputEnd, { passive: false });
canvas.addEventListener('touchcancel', handleCanvasInputEnd, { passive: false }); // Important for mobile
canvas.addEventListener('mousedown', handleCanvasInputStart, { passive: false });
canvas.addEventListener('mouseup', handleCanvasInputEnd, { passive: false });
canvas.addEventListener('mouseleave', handleCanvasInputEnd, { passive: false });


// --- Drawing Controls (remain the same) ---
function drawControls() {
    // ... (drawing logic for buttons based on their .pressed state) ...
    // No changes needed here unless visual debugging is required
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#888';
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2 * scaleRatio;
    ctx.font = `${buttonSize * 0.4}px Arial`;
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
    ctx.fillText('◎', shootButtonRect.x + shootButtonRect.width / 2, shootButtonRect.y + shootButtonRect.height / 2);

    // Draw Jump Button
    ctx.fillStyle = jumpButtonRect.pressed ? '#AAA' : '#888';
    ctx.fillRect(jumpButtonRect.x, jumpButtonRect.y, jumpButtonRect.width, jumpButtonRect.height);
    ctx.strokeRect(jumpButtonRect.x, jumpButtonRect.y, jumpButtonRect.width, jumpButtonRect.height);
    ctx.fillStyle = '#FFF';
    ctx.fillText('▲', jumpButtonRect.x + jumpButtonRect.width / 2, jumpButtonRect.y + jumpButtonRect.height / 2);

    ctx.restore();
}


// --- 遊戲循環 (gameLoop - minor logging, filter optimization note) ---
function gameLoop() {
    // console.log("Game Loop Tick"); // Very noisy, use only for extreme debugging
    if (gameOver || gameWon) {
        // console.log(`Game ended: gameOver=${gameOver}, gameWon=${gameWon}`);
        displayEndScreen();
        gameRunning = false;
        // No need to cancel animationFrameId here, the check at the top stops recursion
        return;
    }
    gameRunning = true; // Ensure it's marked as running

    ctx.clearRect(0, 0, gameWidth, gameHeight);

    // --- Scrolling (same logic) ---
    let targetScrollX = player.x - gameWidth / 3.5;
    const levelWidth = 2000 * scaleRatio; // Adjust if level is longer/shorter
    targetScrollX = Math.max(0, Math.min(targetScrollX, levelWidth - gameWidth));
    backgroundX += (targetScrollX - backgroundX) * 0.1; // Smooth scroll

    // --- Drawing Background, Obstacles, Player (same logic) ---
     // Draw Background
    if (images.background && images.background.complete) {
        const bgRatio = images.background.width / images.background.height;
        const bgWidth = gameHeight * bgRatio;
        // Check if pattern needs recreating (might not be necessary unless canvas resizes drastically)
        const pattern = ctx.createPattern(images.background, 'repeat-x');
        ctx.save();
        ctx.translate(-backgroundX % bgWidth, 0);
        ctx.fillStyle = pattern || '#abcdef';
        ctx.fillRect(0, 0, gameWidth + bgWidth, gameHeight);
        ctx.restore();
    } else {
        ctx.fillStyle = '#abcdef'; ctx.fillRect(0, 0, gameWidth, gameHeight);
    }
    obstacles.forEach(obstacle => obstacle.draw(backgroundX));
    player.update(backgroundX); // Update before drawing
    player.draw(backgroundX);

    // --- Update Enemies & Player Collision (same logic) ---
     enemies.forEach((enemy) => {
        enemy.update(player.x, backgroundX);
        enemy.draw(backgroundX);
        if (!player.invulnerable && player.checkCollision(enemy, backgroundX).colliding) {
             player.takeDamage();
        }
    });

    // --- Bullet Logic (using filter - add optimization note) ---
    // Note: For extreme performance needs with many bullets, consider object pooling
    // and iterating with manual splice instead of filter creating new arrays.
    bullets = bullets.filter((bullet) => {
        bullet.update();
        let hit = false;
        // Use a standard for loop for enemies for potential early exit
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y)
            {
                hit = true;
                enemy.takeDamage(1);
                if (enemy.health <= 0) {
                    if (enemy.type === 'C') { gameWon = true; console.log("勝利!"); }
                    enemies.splice(i, 1);
                    i--; // Adjust index after splice
                }
                break; // Bullet hits one enemy and disappears
            }
        }

        const bulletDrawX = bullet.x - backgroundX;
        const keepBullet = !hit && bulletDrawX < gameWidth && bulletDrawX + bullet.width > 0;
        if (keepBullet) bullet.draw(backgroundX);
        return keepBullet;
    });

    // --- Enemy Bullet Logic (using filter) ---
     enemyBullets = enemyBullets.filter((bullet) => {
         bullet.update();
         let hitPlayer = false;
         if (!player.invulnerable && player.checkCollision(bullet, backgroundX).colliding) {
             player.takeDamage();
             hitPlayer = true;
         }

         const bulletDrawX = bullet.x - backgroundX;
         const keepBullet = !hitPlayer && bulletDrawX < gameWidth && bulletDrawX + bullet.width > 0 && bullet.y < gameHeight && bullet.y + bullet.height > 0;
         if (keepBullet) bullet.draw(backgroundX);
         return keepBullet;
    });


    // --- Draw UI & Controls (same logic) ---
    displayUI();
    drawControls();

    // --- Request next frame ---
    animationFrameId = requestAnimationFrame(gameLoop);
}


// --- UI Display (displayUI remains the same) ---
function displayUI() { /* ... same code ... */
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = `${Math.max(18, 22 * (gameHeight / 600))}px Arial`;
    ctx.textAlign = 'left';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText(`生命: ${playerHealth}`, 15 * scaleRatio, 35 * scaleRatio);
    ctx.restore();
}

// --- End Screen (displayEndScreen remains the same) ---
function displayEndScreen() { /* ... same code ... */
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    ctx.fillStyle = 'white';
    ctx.font = `${Math.max(30, 45 * (gameHeight / 600))}px Arial`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    if (gameWon) ctx.fillText('勝利!', gameWidth / 2, gameHeight / 2 - 50 * scaleRatio);
    else ctx.fillText('遊戲結束', gameWidth / 2, gameHeight / 2 - 50 * scaleRatio);
    ctx.font = `${Math.max(18, 25 * (gameHeight / 600))}px Arial`;
    ctx.fillText(`剩餘生命: ${playerHealth > 0 ? playerHealth : 0}`, gameWidth / 2, gameHeight / 2 + 10 * scaleRatio);
    ctx.fillText('點擊螢幕重新開始', gameWidth / 2, gameHeight / 2 + 60 * scaleRatio);
    if (sounds.bgMusic) { sounds.bgMusic.pause(); sounds.bgMusic.currentTime = 0; }
}


// --- 音效播放 (playSound - with context check) ---
let audioContextUnlocked = false;
const DUMMY_AUDIO_SRC = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="; // Tiny silent WAV

// Function to unlock audio context
function unlockAudio() {
    if (audioContextUnlocked) return;
    console.log("Attempting to unlock audio context...");
    // Play a dummy sound - this often required by mobile browsers
    const dummySound = new Audio(DUMMY_AUDIO_SRC);
    dummySound.play().then(() => {
        console.log("Audio context likely unlocked.");
        audioContextUnlocked = true;
        // Optionally try playing real sounds now if they were queued/failed before
    }).catch(e => {
        console.warn("Dummy sound play failed, audio might still be locked:", e);
        // Might need another user interaction later
    });

     // Alternative: Resume AudioContext if using Web Audio API directly
     // if (audioContext && audioContext.state === 'suspended') {
     //    audioContext.resume();
     // }
}

function playSound(soundElement) {
     if (!audioContextUnlocked) {
         console.log("Audio not unlocked, trying to unlock first.");
         unlockAudio(); // Try unlocking if not already
         // Sound might not play immediately this time, but hopefully next time
     }

     if (soundElement && sounds[soundElement.id.replace('Sound','')] && sounds[soundElement.id.replace('Sound','')].readyState >= 2) {
        // Check if the specific sound is loaded before playing
        soundElement.currentTime = 0;
        soundElement.play().catch(e => console.warn(`Sound play failed [${soundElement.id}]:`, e));
     } else if (soundElement) {
        // console.log(`Sound ${soundElement.id} not ready (readyState: ${soundElement.readyState})`);
     }
}


// --- Game Start / Restart Logic (More robust error handling, unlock audio) ---
let gameHasStarted = false;
let isStarting = false; // Prevent double-clicks during async startup

async function handleStartGameClick() {
    if (isStarting) {
        console.log("Already attempting to start...");
        return;
    }
    if (gameHasStarted && gameRunning) {
        console.log("Game is already running.");
        return;
    }
     if (assetsLoaded < totalAssets) {
        console.warn("Assets not fully loaded yet.");
        loadingText.textContent = "資源仍在加載，請稍候...";
        return;
    }

    isStarting = true; // Mark as attempting to start
    console.log("handleStartGameClick: Starting game sequence...");

    // *** Unlock Audio Context on first interaction ***
    unlockAudio();

    if (startScreen) startScreen.style.display = 'none';

    try {
        console.log("Requesting Fullscreen...");
        try {
             if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
             else if (document.documentElement.webkitRequestFullscreen) await document.documentElement.webkitRequestFullscreen();
             else if (document.documentElement.msRequestFullscreen) await document.documentElement.msRequestFullscreen();
             console.log("Fullscreen request successful (or already in fullscreen).");
        } catch (fsErr) {
             console.warn("Fullscreen request failed:", fsErr.message);
             // Continue anyway, fullscreen is optional enhancement
        }

        console.log("Attempting to lock orientation to landscape...");
        try {
            // Check API support carefully
            if (screen.orientation && typeof screen.orientation.lock === 'function') {
                await screen.orientation.lock('landscape');
                console.log("Orientation locked to landscape.");
            } else {
                 console.warn("Screen Orientation Lock API not fully supported.");
                 // Try deprecated methods as fallback (might work on some older devices)
                 if (typeof screen.lockOrientation === 'function') {
                     screen.lockOrientation('landscape'); console.log("Used deprecated screen.lockOrientation");
                 } else if (typeof screen.mozLockOrientation === 'function') {
                     screen.mozLockOrientation('landscape'); console.log("Used deprecated screen.mozLockOrientation");
                 } else if (typeof screen.msLockOrientation === 'function') {
                     screen.msLockOrientation('landscape'); console.log("Used deprecated screen.msLockOrientation");
                 }
            }
         } catch (orientErr) {
            console.warn("Orientation lock failed:", orientErr.message);
             // Continue anyway
        }

        // Short delay to allow screen changes
        console.log("Waiting briefly for screen updates...");
        await new Promise(resolve => setTimeout(resolve, 150));

        console.log("Resizing canvas after potential screen changes...");
        resizeCanvas(); // Ensure canvas fits new screen state

        console.log("Initializing game objects...");
        initGame(); // Setup player, enemies etc.

        console.log("Starting background music...");
        if (sounds.bgMusic) {
            sounds.bgMusic.play().catch(e => console.error("Background music play failed:", e));
        } else {
            console.warn("Background music element not ready or found.");
        }

        console.log("Starting game loop...");
        gameHasStarted = true; // Mark that initial start succeeded
        gameRunning = true;
        gameOver = false; // Ensure flags are reset
        gameWon = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId); // Clear any previous loop
        gameLoop();
        console.log("Game loop started.");

    } catch (err) {
        console.error("Critical error during game start sequence:", err);
        // Display an error message to the user?
        if(loadingText) loadingText.textContent = `啟動錯誤: ${err.message}. 請嘗試重新整理頁面。`;
        if(startScreen) startScreen.style.display = 'flex'; // Show start screen again
        gameHasStarted = false; // Allow trying again?
    } finally {
        isStarting = false; // Allow clicking start again if it failed
    }
}


function restartGameOnce(event) {
     // Ensure it's triggered only when game is over AND not currently running
     if (!gameRunning && (gameOver || gameWon)) {
         console.log("Restarting game...");
         // Get click coordinates relative to canvas for potential future use
         // const coords = getCanvasCoordinates(event);
         // if (coords) console.log(`Restart triggered at x=${coords.x.toFixed(1)}, y=${coords.y.toFixed(1)}`);

         // Reset flags before init
         gameOver = false;
         gameWon = false;

         initGame(); // Re-initialize player, enemies etc.

         if (sounds.bgMusic) {
             sounds.bgMusic.currentTime = 0;
             sounds.bgMusic.play().catch(e => console.error("BG music restart failed:", e));
         }

         gameRunning = true; // Set running flag before starting loop
         if (animationFrameId) cancelAnimationFrame(animationFrameId); // Clear old loop just in case
         gameLoop(); // Start the new loop
     } else {
         // console.log(`Restart ignored: gameRunning=${gameRunning}, gameOver=${gameOver}, gameWon=${gameWon}`);
     }
}

// Add listener to the start button
if (startButton) {
    startButton.removeEventListener('click', handleStartGameClick); // Remove old listener if script reloads
    startButton.addEventListener('click', handleStartGameClick);
} else {
    console.error("Start button not found!");
}

// Add restart listener to canvas
canvas.removeEventListener('click', restartGameOnce); // Remove old listener
canvas.addEventListener('click', restartGameOnce);


// Initial resize call
resizeCanvas();
console.log("Game script initialized. Waiting for assets and start button click.");
