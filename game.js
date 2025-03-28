const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 資源加載 ---
const images = {};
const sounds = {};
let assetsLoaded = 0;
const totalAssets = 15; // 12 張圖片 + 3 個音效

function assetLoaded() {
    assetsLoaded++;
    if (assetsLoaded >= totalAssets) {
        console.log("所有資源已加載");
        // 確保音樂在用戶互動後播放
        document.body.addEventListener('click', startGameOnce, { once: true });
        // 或者顯示一個 "開始遊戲" 按鈕來觸發 startGameOnce
        drawLoadingScreen(); // 可以顯示一個加載完成的提示
    } else {
        // console.log(`已加載 ${assetsLoaded}/${totalAssets} 個資源`);
        drawLoadingScreen();
    }
}

function drawLoadingScreen() {
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`正在加載資源... (${assetsLoaded}/${totalAssets})`, canvas.width / 2, canvas.height / 2);
}

function loadImage(name, src) {
    images[name] = new Image();
    images[name].onload = assetLoaded;
    images[name].onerror = () => console.error(`圖片加載失敗: ${src}`);
    images[name].src = src;
}

function loadSound(name, elementId) {
    sounds[name] = document.getElementById(elementId);
    if (sounds[name]) {
        // 'canplaythrough' 事件表示音頻已充分加載可以播放
        sounds[name].addEventListener('canplaythrough', assetLoaded, { once: true });
        sounds[name].addEventListener('error', () => console.error(`音效加載失敗: ${elementId}`));
        // 如果音頻元素不存在
    } else {
        console.error(`找不到 ID 為 ${elementId} 的音頻元素`);
        // 即使找不到也計數，避免卡住加載
        assetLoaded();
    }
}

// --- 遊戲設定 ---
let gameWidth, gameHeight;
let scaleRatio = 1; // 處理高 DPI 螢幕

function resizeCanvas() {
    const aspectRatio = 16 / 9; // 或者你希望的遊戲畫面比例
    const maxHeight = window.innerHeight * 0.7; // 限制畫布最大高度
    const maxWidth = window.innerWidth * 0.95; // 限制畫布最大寬度

    let newWidth = maxWidth;
    let newHeight = newWidth / aspectRatio;

    if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = newHeight * aspectRatio;
    }

    // 處理 Retina/高 DPI 螢幕
    scaleRatio = window.devicePixelRatio || 1;
    canvas.width = newWidth * scaleRatio;
    canvas.height = newHeight * scaleRatio;
    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;

    gameWidth = canvas.width;
    gameHeight = canvas.height;

    // 更新遊戲內元素的大小和位置（如果需要）
    // 例如，重新計算按鈕大小或 UI 位置
    if (assetsLoaded >= totalAssets && !gameRunning) {
         drawLoadingScreen(); // 重繪加載畫面以適應新尺寸
    }
}


// --- 加載資源 ---
resizeCanvas(); // 先調整一次畫布大小
drawLoadingScreen(); // 顯示初始加載畫面

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

const gravity = 0.5 * scaleRatio; // 重力加速度
const playerSpeed = 5 * scaleRatio;
const jumpStrength = -12 * scaleRatio;
const bulletSpeed = 8 * scaleRatio;
const enemyBulletSpeed = 4 * scaleRatio;

// 動畫幀相關
let frameCount = 0;
const runFrameSpeed = 10; // 每 10 幀切換一次跑步圖片
const enemyBFrameSpeed = 15; // B 怪移動動畫速度

// 按鈕狀態
let moveLeftPressed = false;
let moveRightPressed = false;
let jumpPressed = false; // 用於觸發跳躍，而非持續按住
let shootPressed = false; // 用於觸發射擊

// --- 物件類別 ---

// 基本物件類別 (可選, 用於共享屬性)
class GameObject {
    constructor(x, y, width, height, image) {
        this.x = x * scaleRatio;
        this.y = y * scaleRatio;
        this.width = width * scaleRatio;
        this.height = height * scaleRatio;
        this.image = image;
    }

    draw(offsetX = 0) {
         if (this.image && this.image.complete && this.image.naturalWidth > 0) {
             const drawX = this.x - offsetX;
             // 檢查是否在畫布可見範圍內 (基礎優化)
             if (drawX + this.width > 0 && drawX < gameWidth) {
                 ctx.drawImage(this.image, drawX, this.y, this.width, this.height);
             }
        } else {
             // 圖像未加載完成時繪製佔位符
             ctx.fillStyle = 'grey';
             ctx.fillRect(this.x - offsetX, this.y, this.width, this.height);
        }
    }
}


class Player extends GameObject {
    constructor(x, y) {
        // 假設玩家圖片大小為 50x50 像素 (請根據實際圖片調整)
        const playerWidth = 50;
        const playerHeight = 50;
        super(x, y, playerWidth, playerHeight, images.playerIdle);
        this.vx = 0; // 水平速度
        this.vy = 0; // 垂直速度
        this.onGround = false;
        this.facingRight = true;
        this.shooting = false;
        this.shootingCooldown = 0;
        this.runFrame = 0; // 跑步動畫幀
        this.invulnerable = false; // 受傷後的無敵狀態
        this.invulnerableTimer = 0;
        this.invulnerableDuration = 120; // 無敵持續幀數 (約 2 秒)
        this.shootFrameTimer = 0; // 射擊姿勢持續時間
        this.shootFrameDuration = 15; // 射擊姿勢顯示 15 幀
    }

    update(worldScrollX) {
        // --- 處理輸入 ---
        this.vx = 0;
        if (moveLeftPressed) {
            this.vx = -playerSpeed;
            this.facingRight = false;
        }
        if (moveRightPressed) {
            this.vx = playerSpeed;
            this.facingRight = true;
        }

        // --- 物理 ---
        // 水平移動 (考慮世界捲動)
        this.x += this.vx;

        // 垂直移動 (重力)
        this.vy += gravity;
        this.y += this.vy;
        this.onGround = false; // 假設不在地面，稍後碰撞檢測會更正

        // --- 邊界限制 (簡易版，防止移出畫面左側) ---
        if (this.x < worldScrollX) {
            this.x = worldScrollX;
        }
        // 右側邊界應由關卡設計控制，或設定一個最大 X 值

        // --- 地面/障礙物碰撞 (簡易版) ---
        // 檢查是否碰到地面
        const groundY = gameHeight - this.height - 10 * scaleRatio; // 假設地面在底部上方 10px
        if (this.y >= groundY) {
            this.y = groundY;
            this.vy = 0;
            this.onGround = true;
        }

        // 檢查與障礙物的碰撞
        obstacles.forEach(obstacle => {
            const collideData = this.checkCollision(obstacle, worldScrollX);
            if (collideData.colliding) {
                // 判斷是從上方落下還是側面碰撞
                 if (collideData.fromAbove && this.vy > 0) {
                    this.y = obstacle.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                } else if (!collideData.fromAbove && this.vy >= 0) { // 側面碰撞 (且不在上升過程中卡住)
                     // 如果向右移動撞到左側
                    if (this.vx > 0 && this.x + this.width > obstacle.x && this.x < obstacle.x) {
                         this.x = obstacle.x - this.width;
                         this.vx = 0;
                    }
                    // 如果向左移動撞到右側
                    else if (this.vx < 0 && this.x < obstacle.x + obstacle.width && this.x + this.width > obstacle.x + obstacle.width) {
                         this.x = obstacle.x + obstacle.width;
                         this.vx = 0;
                    }
                    // (可選) 如果在障礙物內部，稍微推開
                    // else if (this.y + this.height > obstacle.y && this.y < obstacle.y + obstacle.height) {
                    //      // 簡易推開邏輯
                    // }
                }
            }
        });


        // --- 跳躍 ---
        if (jumpPressed && this.onGround) {
            this.vy = jumpStrength;
            this.onGround = false;
            playSound(sounds.jumpSound);
            jumpPressed = false; // 重置觸發器
        }

        // --- 射擊 ---
        if (this.shootingCooldown > 0) {
            this.shootingCooldown--;
        }
        if (shootPressed && this.shootingCooldown <= 0) {
            this.shoot();
            this.shooting = true; // 標記正在射擊以顯示圖片
            this.shootFrameTimer = this.shootFrameDuration; // 開始計時射擊姿勢
            this.shootingCooldown = 20; // 射擊冷卻時間 (幀)
            shootPressed = false; // 重置觸發器
        }

        // 射擊姿勢計時
        if (this.shootFrameTimer > 0) {
            this.shootFrameTimer--;
            if (this.shootFrameTimer <= 0) {
                this.shooting = false;
            }
        }


        // --- 無敵狀態 ---
        if (this.invulnerable) {
            this.invulnerableTimer--;
            if (this.invulnerableTimer <= 0) {
                this.invulnerable = false;
            }
        }
    }

    draw(offsetX = 0) {
        let currentImage;
        frameCount++;

        // 根據狀態選擇圖片
        if (this.shooting && images.playerShoot) { // 優先顯示射擊圖片
            currentImage = images.playerShoot;
        } else if (!this.onGround && images.playerJump) {
            currentImage = images.playerJump;
        } else if (this.vx !== 0 && images.playerRun1 && images.playerRun2) {
            // 跑步動畫
            const frameIndex = Math.floor(frameCount / runFrameSpeed) % 2;
            currentImage = (frameIndex === 0) ? images.playerRun1 : images.playerRun2;
        } else {
            currentImage = images.playerIdle;
        }

        if (!currentImage || !currentImage.complete || currentImage.naturalWidth === 0) {
             // 圖像未加載完成時繪製佔位符
            ctx.fillStyle = 'blue'; // 玩家用藍色佔位符
            ctx.fillRect(this.x - offsetX, this.y, this.width, this.height);
             return; // 防止下方繪圖出錯
        }

        ctx.save(); // 保存當前繪圖狀態

        const drawX = this.x - offsetX;

        // 繪製時考慮無敵閃爍效果
        if (this.invulnerable && Math.floor(this.invulnerableTimer / 5) % 2 === 0) {
             ctx.globalAlpha = 0.5; // 半透明
        }

        // 如果向左，翻轉圖像
        if (!this.facingRight) {
            ctx.scale(-1, 1); // 水平翻轉
            // 翻轉後，繪製位置需要調整到翻轉後的左上角
            ctx.drawImage(currentImage, -(drawX + this.width), this.y, this.width, this.height);
        } else {
            // 正常繪製
            ctx.drawImage(currentImage, drawX, this.y, this.width, this.height);
        }


        ctx.restore(); // 恢復繪圖狀態 (包括翻轉和透明度)
    }

    shoot() {
         // 子彈初始位置 (考慮人物朝向)
        const bulletX = this.facingRight ? this.x + this.width : this.x;
        const bulletY = this.y + this.height / 3; // 大約在人物中間高
        const bulletVx = this.facingRight ? bulletSpeed : -bulletSpeed;

         // 假設子彈大小 10x5 (請根據需要調整)
        bullets.push(new Bullet(bulletX, bulletY, 10 * scaleRatio, 5 * scaleRatio, bulletVx));
        playSound(sounds.shootSound);
    }

    takeDamage() {
         if (!this.invulnerable) {
             playerHealth--;
             console.log(`玩家受傷，剩餘生命: ${playerHealth}`);
             this.invulnerable = true;
             this.invulnerableTimer = this.invulnerableDuration;
             // 可以加上受傷音效
             if (playerHealth <= 0) {
                 gameOver = true;
                 console.log("遊戲結束");
             }
         }
    }

    // 簡易碰撞檢測 (AABB - Axis-Aligned Bounding Box)
    checkCollision(other, offsetX = 0) {
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
            // 檢查是否是從上方碰撞 (用於平台)
            // 條件: 玩家底部在上一次更新時在物體上方，且現在發生碰撞
             // (更精確的檢測需要記錄前一幀位置，這裡用速度和相對位置近似)
             if (this.vy > 0 && (playerBottom - this.vy) <= otherTop) {
                 fromAbove = true;
             }
        }

        return { colliding, fromAbove };
    }
}

class Bullet extends GameObject {
    constructor(x, y, width, height, vx) {
        // 子彈沒有固定圖像，用顏色代替，或創建子彈圖像
        super(x, y, width, height, null); // null image
        this.vx = vx;
    }

    update() {
        this.x += this.vx;
    }

    draw(offsetX = 0) {
        // 繪製一個簡單的矩形作為子彈
        ctx.fillStyle = 'yellow';
        const drawX = this.x - offsetX;
        // 基礎優化：只繪製螢幕內的子彈
        if (drawX + this.width > 0 && drawX < gameWidth) {
             ctx.fillRect(drawX, this.y, this.width, this.height);
        }
    }
}

class Enemy extends GameObject {
    constructor(x, y, width, height, image, health, type) {
        super(x, y, width, height, image);
        this.initialHealth = health;
        this.health = health;
        this.type = type; // 'A', 'B', 'C'
        this.shootCooldown = 0;
        this.shootTimer = Math.random() * 100 + 100; // 隨機初始射擊計時器
        this.vx = 0; // B 型怪需要
        this.moveDirection = 1; // 1 for right, -1 for left (for Enemy B)
        this.moveRange = 100 * scaleRatio; // B 型怪移動範圍
        this.initialX = x * scaleRatio; // B 怪的初始位置
        this.animationFrame = 0; // B 怪動畫
        this.actionFrameTimer = 0; // A/C 怪射擊動畫計時
        this.actionFrameDuration = 20; // 射擊動畫持續幀數
        this.isShooting = false; // 標記是否處於射擊動畫狀態
    }

    update(playerX, worldScrollX) {
         this.actionFrameTimer--;
         if (this.actionFrameTimer <= 0) {
             this.isShooting = false;
         }

        if (this.type === 'A') {
            this.shootTimer--;
            if (this.shootTimer <= 0 && Math.abs(this.x - playerX) < gameWidth * 0.8) { // 玩家在一定範圍內才射擊
                this.shoot(playerX);
                this.shootTimer = 120 + Math.random() * 60; // 重置射擊冷卻 (2-3秒)
                this.isShooting = true;
                this.actionFrameTimer = this.actionFrameDuration;
            }
        } else if (this.type === 'B') {
            // 移動邏輯
            this.vx = 2 * scaleRatio * this.moveDirection;
            this.x += this.vx;
             // 改變方向
             if (this.x > this.initialX + this.moveRange || this.x < this.initialX - this.moveRange) {
                 this.moveDirection *= -1;
                 // 防止超出範圍太多
                 this.x = Math.max(this.initialX - this.moveRange, Math.min(this.x, this.initialX + this.moveRange));
             }
            this.animationFrame++; // 更新動畫幀計數器
        } else if (this.type === 'C') {
            this.shootTimer--;
            if (this.shootTimer <= 0 && Math.abs(this.x - playerX) < gameWidth) { // Boss 一直嘗試射擊
                this.shootSpread();
                this.shootTimer = 180 + Math.random() * 100; // 重置射擊冷卻 (3-4.5秒)
                this.isShooting = true;
                this.actionFrameTimer = this.actionFrameDuration;
            }
        }
    }

    draw(offsetX = 0) {
        let currentImage = this.image; // 默認圖像
         if (this.isShooting) {
             if (this.type === 'A' && images.enemyAShoot) currentImage = images.enemyAShoot;
             if (this.type === 'C' && images.enemyCShoot) currentImage = images.enemyCShoot;
         } else if (this.type === 'B' && images.enemyB1 && images.enemyB2) {
             // B怪走路動畫
             const frameIndex = Math.floor(this.animationFrame / enemyBFrameSpeed) % 2;
             currentImage = (frameIndex === 0) ? images.enemyB1 : images.enemyB2;
         }

         if (currentImage && currentImage.complete && currentImage.naturalWidth > 0) {
             const drawX = this.x - offsetX;
             // 檢查是否在畫布可見範圍內
             if (drawX + this.width > 0 && drawX < gameWidth) {
                 ctx.save();
                 // B 怪根據移動方向翻轉
                 if (this.type === 'B' && this.moveDirection < 0) {
                     ctx.scale(-1, 1);
                     ctx.drawImage(currentImage, -(drawX + this.width), this.y, this.width, this.height);
                 } else {
                     ctx.drawImage(currentImage, drawX, this.y, this.width, this.height);
                 }
                 ctx.restore();

                 // --- 繪製血條 (可選) ---
                 const healthBarWidth = this.width * 0.8;
                 const healthBarHeight = 5 * scaleRatio;
                 const healthBarX = drawX + (this.width - healthBarWidth) / 2;
                 const healthBarY = this.y - healthBarHeight - 5 * scaleRatio; // 在頭頂上方一點
                 const healthPercentage = this.health / this.initialHealth;

                 ctx.fillStyle = 'red';
                 ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
                 ctx.fillStyle = 'lime';
                 ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercentage, healthBarHeight);

             }
         } else {
             // 圖像未加載完成時繪製佔位符
             ctx.fillStyle = 'red'; // 敵人用紅色佔位符
             ctx.fillRect(this.x - offsetX, this.y, this.width, this.height);
         }
    }

    shoot(playerX) {
        // A 怪單點射擊 (可以加入朝向玩家的邏輯)
        const bulletX = this.x + this.width / 2;
        const bulletY = this.y + this.height / 2;
        const angle = Math.atan2(player.y - this.y, player.x - this.x); // 指向玩家
        const bulletVx = Math.cos(angle) * enemyBulletSpeed;
        const bulletVy = Math.sin(angle) * enemyBulletSpeed;
        // 假設子彈大小 8x8
        enemyBullets.push(new EnemyBullet(bulletX, bulletY, 8 * scaleRatio, 8 * scaleRatio, bulletVx, bulletVy));
        // playSound(sounds.enemyShootSound); // 需要敵人射擊音效
    }

    shootSpread() {
        // C 怪散狀射擊
        const bulletX = this.x + this.width / 2;
        const bulletY = this.y + this.height / 2;
        const numBullets = 5; // 發射 5 顆子彈
        const angleSpread = Math.PI / 6; // 總共擴散 30 度
        const startAngle = -angleSpread / 2 - Math.PI / 2; // 從中間向上偏左開始

        for (let i = 0; i < numBullets; i++) {
            const angle = startAngle + (angleSpread / (numBullets - 1)) * i;
            const bulletVx = Math.cos(angle) * enemyBulletSpeed * 0.8; // Boss子彈稍慢
            const bulletVy = Math.sin(angle) * enemyBulletSpeed * 0.8;
             // 假設子彈大小 10x10
            enemyBullets.push(new EnemyBullet(bulletX, bulletY, 10 * scaleRatio, 10 * scaleRatio, bulletVx, bulletVy));
        }
        // playSound(sounds.enemyShootSound); // 需要敵人射擊音效
    }

    takeDamage(amount) {
        this.health -= amount;
        // console.log(`敵人 (${this.type}) 受傷，剩餘生命: ${this.health}`);
        // 可以添加受傷效果，如閃爍
    }
}

class EnemyBullet extends GameObject {
     constructor(x, y, width, height, vx, vy) {
        super(x, y, width, height, null); // 用顏色代替
        this.vx = vx;
        this.vy = vy;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw(offsetX = 0) {
        ctx.fillStyle = 'orange';
        const drawX = this.x - offsetX;
        // 基礎優化：只繪製螢幕內的子彈
         if (drawX + this.width > 0 && drawX < gameWidth && this.y + this.height > 0 && this.y < gameHeight) {
            ctx.fillRect(drawX, this.y, this.width, this.height);
         }
    }
}

class Obstacle extends GameObject {
     constructor(x, y, width, height) {
         // 確保使用正確的圖片變數名
         super(x, y, width, height, images.obstacle);
     }
     // Obstacle 只需要被繪製，不需要 update 方法 (除非是移動障礙物)
}

// --- 遊戲初始化 ---
function initGame() {
    gameOver = false;
    gameWon = false;
    playerHealth = 3;
    score = 0; // 如果需要計分的話
    backgroundX = 0; // 背景捲動位置重置
    enemies = [];
    bullets = [];
    enemyBullets = [];
    obstacles = [];

    // 創建玩家 (初始位置)
    player = new Player(100, gameHeight - 100); // 放在靠近左下角

    // --- 創建障礙物 ---
    // 範例：在不同位置創建幾個障礙物
    // 參數: x, y, width, height (基於未縮放的像素)
    obstacles.push(new Obstacle(300, gameHeight - 100, 80, 50));
    obstacles.push(new Obstacle(600, gameHeight - 150, 120, 80));
    obstacles.push(new Obstacle(950, gameHeight - 80, 60, 60));

    // --- 創建敵人 ---
    // 參數: x, y, width, height, image, health, type
    // 假設敵人圖片大小 (請根據實際圖片調整)
    const enemyAW = 40; const enemyAH = 40;
    const enemyBW = 45; const enemyBH = 45;
    const enemyCW = 80; const enemyCH = 80;

    enemies.push(new Enemy(500, gameHeight - 50 - enemyAH, enemyAW, enemyAH, images.enemyA, 2, 'A'));
    enemies.push(new Enemy(800, gameHeight - 50 - enemyBH, enemyBW, enemyBH, images.enemyB1, 1, 'B'));
    enemies.push(new Enemy(1100, gameHeight - 50 - enemyAH, enemyAW, enemyAH, images.enemyA, 2, 'A'));
    // C 怪放在關卡較後位置
    enemies.push(new Enemy(1500, gameHeight - 50 - enemyCH, enemyCW, enemyCH, images.enemyC, 15, 'C'));

    console.log("遊戲初始化完成");
}


// --- 遊戲循環 ---
function gameLoop() {
    if (gameOver || gameWon) {
        displayEndScreen();
        return; // 停止循環
    }

    // --- 清除畫布 ---
    ctx.clearRect(0, 0, gameWidth, gameHeight);

    // --- 計算世界捲動 ---
    // 讓攝影機跟隨玩家，但限制在關卡範圍內
    let targetScrollX = player.x - gameWidth / 4; // 讓玩家保持在畫面左側 1/4 處
    // 限制捲動範圍，假設關卡寬度為 2000 * scaleRatio (需要根據實際關卡調整)
    const levelWidth = 2000 * scaleRatio;
    targetScrollX = Math.max(0, Math.min(targetScrollX, levelWidth - gameWidth));
    // 可以添加平滑滾動效果，例如:
    // backgroundX += (targetScrollX - backgroundX) * 0.1;
    backgroundX = targetScrollX;


    // --- 繪製背景 (可捲動) ---
    if (images.background && images.background.complete) {
        const bgWidth = images.background.width * (gameHeight / images.background.height); //保持比例填充高度
        const pattern = ctx.createPattern(images.background, 'repeat-x');

        ctx.save();
        // 平移背景以模擬滾動
        ctx.translate(-backgroundX % bgWidth, 0);
        ctx.fillStyle = pattern;
        // 繪製足夠寬的背景以覆蓋捲動所需範圍
        ctx.fillRect(0, 0, gameWidth + bgWidth, gameHeight);
        ctx.restore();
    } else {
        ctx.fillStyle = '#abcdef'; // 備用背景色
        ctx.fillRect(0, 0, gameWidth, gameHeight);
    }

    // --- 更新與繪製障礙物 ---
    obstacles.forEach(obstacle => obstacle.draw(backgroundX));

    // --- 更新與繪製玩家 ---
    player.update(backgroundX); // 傳遞捲動值用於邊界檢測
    player.draw(backgroundX);

    // --- 更新與繪製敵人 ---
    enemies.forEach((enemy, index) => {
        enemy.update(player.x, backgroundX); // 傳遞玩家位置用於 AI
        enemy.draw(backgroundX);
        // 檢查玩家與敵人碰撞
         if (!player.invulnerable && player.checkCollision(enemy, backgroundX).colliding) {
             player.takeDamage();
         }
    });

    // --- 更新與繪製子彈 ---
    bullets.forEach((bullet, index) => {
        bullet.update();
        bullet.draw(backgroundX);
        // 子彈超出畫面移除
        if (bullet.x - backgroundX > gameWidth || bullet.x - backgroundX < 0) {
            bullets.splice(index, 1);
        }
    });

     // --- 更新與繪製敵人子彈 ---
    enemyBullets.forEach((bullet, index) => {
        bullet.update();
        bullet.draw(backgroundX);
         // 檢查敵人子彈與玩家碰撞
         if (!player.invulnerable && player.checkCollision(bullet, backgroundX).colliding) {
             player.takeDamage();
             enemyBullets.splice(index, 1); // 子彈擊中後消失
         }
         // 子彈超出畫面移除 (上下左右)
         else if (bullet.x - backgroundX > gameWidth || bullet.x - backgroundX < -bullet.width || bullet.y > gameHeight || bullet.y < -bullet.height ) {
             enemyBullets.splice(index, 1);
         }
    });

    // --- 碰撞檢測 (玩家子彈 vs 敵人) ---
    bullets.forEach((bullet, bulletIndex) => {
        enemies.forEach((enemy, enemyIndex) => {
             // 簡單的 AABB 碰撞檢測
            if (bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y)
            {
                // 碰撞發生
                bullets.splice(bulletIndex, 1); // 移除子彈
                let damage = 1; // 預設傷害
                enemy.takeDamage(damage);

                if (enemy.health <= 0) {
                    // 檢查是否是 C 怪被消滅
                    if (enemy.type === 'C') {
                        gameWon = true;
                        console.log("恭喜你獲勝了！");
                    }
                    enemies.splice(enemyIndex, 1); // 移除敵人
                    // 可以添加分數或掉落物等
                }
            }
        });
    });


    // --- 繪製 UI (生命值等) ---
    displayUI();

    // --- 請求下一幀 ---
    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- UI 顯示 ---
function displayUI() {
    ctx.fillStyle = 'white';
    ctx.font = `${20 * scaleRatio}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(`生命: ${playerHealth}`, 10 * scaleRatio, 30 * scaleRatio);
    // 可以添加分數顯示 ctx.fillText(`分數: ${score}`, gameWidth - 150 * scaleRatio, 30 * scaleRatio);
}

// --- 結束畫面 ---
function displayEndScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // 半透明黑色背景
    ctx.fillRect(0, 0, gameWidth, gameHeight);

    ctx.fillStyle = 'white';
    ctx.font = `${40 * scaleRatio}px Arial`;
    ctx.textAlign = 'center';

    if (gameWon) {
        ctx.fillText('勝利!', gameWidth / 2, gameHeight / 2 - 40 * scaleRatio);
        ctx.font = `${25 * scaleRatio}px Arial`;
        ctx.fillText('點擊螢幕重新開始', gameWidth / 2, gameHeight / 2 + 20 * scaleRatio);
    } else { // gameOver
        ctx.fillText('遊戲結束', gameWidth / 2, gameHeight / 2 - 40 * scaleRatio);
         ctx.font = `${25 * scaleRatio}px Arial`;
        ctx.fillText(`剩餘生命: ${playerHealth > 0 ? playerHealth : 0}`, gameWidth / 2, gameHeight / 2 + 20 * scaleRatio);
        ctx.fillText('點擊螢幕重新開始', gameWidth / 2, gameHeight / 2 + 60 * scaleRatio);
    }

     // 停止背景音樂
     if (sounds.bgMusic) {
        sounds.bgMusic.pause();
        sounds.bgMusic.currentTime = 0; // 重置播放位置
     }

    // 添加重新開始的監聽器
    document.body.addEventListener('click', restartGameOnce, { once: true });
}

// --- 音效播放輔助函數 ---
function playSound(soundElement) {
     if (soundElement && soundElement.readyState >= 2) { // 至少 HAVE_CURRENT_DATA
        soundElement.currentTime = 0; // 從頭播放
        soundElement.play().catch(e => console.log("音效播放失敗:", e)); // 捕捉可能的播放錯誤
     }
}

// --- 事件監聽器 ---
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const jumpBtn = document.getElementById('jumpBtn');
const shootBtn = document.getElementById('shootBtn');

// --- 按鈕事件處理 ---
function handleStart(event, buttonType) {
     event.preventDefault(); // 阻止預設行為，如頁面滾動或縮放
     switch(buttonType) {
         case 'left': moveLeftPressed = true; break;
         case 'right': moveRightPressed = true; break;
         case 'jump': jumpPressed = true; break; // 跳躍是觸發一次
         case 'shoot': shootPressed = true; break; // 射擊也是觸發一次
     }
}

function handleEnd(event, buttonType) {
     event.preventDefault();
     switch(buttonType) {
         case 'left': moveLeftPressed = false; break;
         case 'right': moveRightPressed = false; break;
         // jumpPressed 和 shootPressed 在 update 邏輯中處理後重置，這裡不需要 false
     }
}

// --- 觸控事件 ---
leftBtn.addEventListener('touchstart', (e) => handleStart(e, 'left'), { passive: false });
leftBtn.addEventListener('touchend', (e) => handleEnd(e, 'left'), { passive: false });
rightBtn.addEventListener('touchstart', (e) => handleStart(e, 'right'), { passive: false });
rightBtn.addEventListener('touchend', (e) => handleEnd(e, 'right'), { passive: false });
jumpBtn.addEventListener('touchstart', (e) => handleStart(e, 'jump'), { passive: false });
// jumpBtn 不需要 touchend 設置為 false
shootBtn.addEventListener('touchstart', (e) => handleStart(e, 'shoot'), { passive: false });
// shootBtn 不需要 touchend 設置為 false

// --- 滑鼠事件 (用於桌面測試) ---
leftBtn.addEventListener('mousedown', (e) => handleStart(e, 'left'));
leftBtn.addEventListener('mouseup', (e) => handleEnd(e, 'left'));
leftBtn.addEventListener('mouseleave', (e) => handleEnd(e, 'left')); // 如果滑鼠移出按鈕也要停止
rightBtn.addEventListener('mousedown', (e) => handleStart(e, 'right'));
rightBtn.addEventListener('mouseup', (e) => handleEnd(e, 'right'));
rightBtn.addEventListener('mouseleave', (e) => handleEnd(e, 'right'));
jumpBtn.addEventListener('mousedown', (e) => handleStart(e, 'jump'));
shootBtn.addEventListener('mousedown', (e) => handleStart(e, 'shoot'));


// --- 遊戲啟動與重置 ---
let gameHasStarted = false; // 防止重複啟動

function startGameOnce() {
    if (!gameHasStarted && assetsLoaded >= totalAssets) {
        console.log("首次啟動遊戲...");
        gameHasStarted = true;
        if (sounds.bgMusic) {
            sounds.bgMusic.play().catch(e => console.log("背景音樂播放失敗:", e));
        } else {
            console.log("背景音樂元素未找到或未加載");
        }
        initGame(); // 初始化遊戲狀態
        gameRunning = true;
        if (animationFrameId) cancelAnimationFrame(animationFrameId); // 清除舊的循環（如果有的話）
        gameLoop(); // 開始遊戲主循環
         // 移除 body 上的啟動監聽器，避免干擾結束畫面後的重啟
         document.body.removeEventListener('click', startGameOnce);
    } else if (assetsLoaded < totalAssets) {
        console.log("資源尚未加載完成，請稍候...");
         // 可以在這裡提示用戶資源仍在加載
         // 重新添加監聽器，以便稍後可以再次點擊啟動
         document.body.addEventListener('click', startGameOnce, { once: true });
    }
}

function restartGameOnce() {
     if (!gameRunning) { // 確保遊戲當前不是運行狀態
         console.log("重新啟動遊戲...");
         // 清除可能存在的結束畫面監聽器 (雖然 {once: true} 會自動移除，但以防萬一)
         document.body.removeEventListener('click', restartGameOnce);
         // 重新初始化並啟動遊戲
         startGameOnce(); // 調用首次啟動函數，它會處理初始化和開始循環
     }
}

// 頁面加載後，先不自動開始遊戲，等待資源加載和用戶交互
// resizeCanvas(); // 確保初始尺寸正確
// drawLoadingScreen(); // 顯示加載畫面
