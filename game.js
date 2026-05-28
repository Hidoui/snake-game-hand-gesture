const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const tileCountX = 24;
const tileCountY = 21;

const tileSize = Math.floor(canvas.width / tileCountX);
canvas.height = tileSize * tileCountY;

const headUp = new Image(); headUp.src = "assets/snake/head_up.png";
const headDown = new Image(); headDown.src = "assets/snake/head_down.png";
const headLeft = new Image(); headLeft.src = "assets/snake/head_left.png";
const headRight = new Image(); headRight.src = "assets/snake/head_right.png";

const bodyHor = new Image(); bodyHor.src = "assets/snake/body_horizontal.png";
const bodyVer = new Image(); bodyVer.src = "assets/snake/body_vertical.png";

const tailUp = new Image(); tailUp.src = "assets/snake/tail_up.png";
const tailDown = new Image(); tailDown.src = "assets/snake/tail_down.png";
const tailLeft = new Image(); tailLeft.src = "assets/snake/tail_left.png";
const tailRight = new Image(); tailRight.src = "assets/snake/tail_right.png";

const appleImg = new Image();
appleImg.src = "assets/apple.png";

const upSound = document.getElementById("upSound");
const downSound = document.getElementById("downSound");
const leftSound = document.getElementById("leftSound");
const rightSound = document.getElementById("rightSound");
const eatSound = document.getElementById("eatSound");
const hitSound = document.getElementById("hitSound");

let isSoundOn = localStorage.getItem("sound") !== "off";

let snake, prevSnake, velocity, directionQueue, food;
let score;
let highscore = sessionStorage.getItem("highscore") || 0;
let lives = 3;

let isPaused = false;
let isCountingDown = false;
let isHit = false;
let isGameOver = false;

let lastMoveTime = 0;
let moveDelay = 150;
let progress = 0;

let blinkCount = 0;
let maxBlink = 5;
let blinkTimer = 0;

let lastFaceDir = { dx: 1, dy: 0 };
let guideSource = null;

document.getElementById("highscore").innerText = highscore;

function unlockAudio() {
  const sounds = [upSound, downSound, leftSound, rightSound, eatSound, hitSound];

  sounds.forEach(sound => {
    sound.volume = 0;
    sound.play().then(() => {
      sound.pause();
      sound.currentTime = 0;
      sound.volume = 1;
    }).catch(() => {});
  });
}

function playSound(sound) {
  if (!isSoundOn) return;

  const clone = sound.cloneNode();
  clone.play();
}

function startGame() {
  unlockAudio();

  document.getElementById("startScreen").style.display = "none";
  document.getElementById("gameScreen").style.display = "block";

  initGame();
}

function initGame() {
  snake = [{ x: 6, y: 10 }, { x: 5, y: 10 }];
  prevSnake = JSON.parse(JSON.stringify(snake));
  velocity = { x: 0, y: 0 };
  directionQueue = [];

  lastFaceDir = { dx: 1, dy: 0 };

  food = { x: 18, y: 10 };
  score = 0;
  lives = 3;
  moveDelay = 150;

  document.getElementById("score").innerText = score;
  updateLivesUI();
}

function gameLoop(time = 0) {
  update(time);
  draw();
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

function togglePause() {
  if (isGameOver) return;

  isPaused = !isPaused;

  document.getElementById("pauseScreen").style.display = isPaused ? "flex" : "none";
}

function resumeGame() {
    document.getElementById("pauseScreen").style.display = "none";
    
    const overlay = document.getElementById("countdown-overlay");
    const text = document.getElementById("countdown-text");
    
    isCountingDown = true;
    overlay.style.display = "flex";
    
    let count = 3;
    text.innerText = count;

    const countdownInterval = setInterval(() => {
        count--;
        
        if (count > 0) {
            text.innerText = count;
        } else {
            clearInterval(countdownInterval);
            overlay.style.display = "none";
            
            isCountingDown = false;
            isPaused = false; 
        }
    }, 1000);
}

function exitGame() {
  isPaused = false;

  document.getElementById("pauseScreen").style.display = "none";
  document.getElementById("gameScreen").style.display = "none";
  document.getElementById("startScreen").style.display = "flex";

  initGame();
}

function update(time) {
  if (!snake) return;

  if (isHit) {
    if (time - blinkTimer > 100) {
      blinkTimer = time;
      blinkCount++;
    }
  }

  if (isPaused) return;

  if (isGameOver) {
    if (time - blinkTimer > 100) {
      blinkTimer = time;
      blinkCount++;

      if (blinkCount >= maxBlink) {
        document.getElementById("gameScreen").style.display = "none";
        document.getElementById("startScreen").style.display = "flex";

        isGameOver = false;
        initGame();
      }
    }
    return;
  }

  if (time - lastMoveTime > moveDelay) {

    prevSnake = JSON.parse(JSON.stringify(snake));

    if (directionQueue.length > 0) {
      velocity = directionQueue.shift();
    }

    const head = {
      x: snake[0].x + velocity.x,
      y: snake[0].y + velocity.y
    };

    if (velocity.x === 0 && velocity.y === 0) return;

    if (
      head.x < 0 || head.x >= tileCountX ||
      head.y < 0 || head.y >= tileCountY
    ) return gameOver();

    for (let part of snake) {
      if (part.x === head.x && part.y === head.y) {
        return gameOver();
      }
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      playSound(eatSound);
      score++;
      document.getElementById("score").innerText = score;
      updateHighscore();
      if (score % 20 === 0) {
        moveDelay = Math.max(100, moveDelay - 10);
      }
      spawnFood();
    } else {
      snake.pop();
    }
    lastMoveTime = time;
  }
  progress = Math.min((time - lastMoveTime) / moveDelay, 1);
}

function gameOver() {
  playSound(hitSound);

  lives--;
  updateLivesUI();

  if (lives > 0) {
    isHit = true;
    isPaused = true;
    blinkCount = 0;
    blinkTimer = 0;

    setTimeout(() => {
      snake = [{ x: 6, y: 10 }, { x: 5, y: 10 }];
      prevSnake = JSON.parse(JSON.stringify(snake));
      velocity = { x: 0, y: 0 };
      directionQueue = [];

      lastFaceDir = { dx: 1, dy: 0 };

      food = { x: 18, y: 10 };
      moveDelay = 150;

      isHit = false;
      isPaused = false;
    }, 500);

    return;
  }

  isGameOver = true;
  blinkCount = 0;
  blinkTimer = 0;

  if (score > highscore) {
    highscore = score;
    sessionStorage.setItem("highscore", highscore);
    document.getElementById("highscore").innerText = highscore;
  }
}

function draw() {
  if (!snake) return;

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  if ((!isGameOver && !isHit) || blinkCount % 2 === 0) {
    for (let i = 0; i < snake.length; i++) {
      const current = snake[i];
      const previous = prevSnake[i] || current;

      const interpX = previous.x + (current.x - previous.x) * progress;
      const interpY = previous.y + (current.y - previous.y) * progress;

      const x = interpX * tileSize;
      const y = interpY * tileSize;

      if (i === 0) {
        let dx = current.x - previous.x;
        let dy = current.y - previous.y;

        if (dx !== 0 || dy !== 0) {
          lastFaceDir = { dx, dy };
        } else {
          dx = lastFaceDir.dx;
          dy = lastFaceDir.dy;
        }

        let img, w, h;
        if (dx > 0) { img = headRight; w = 120; h = 108; }
        else if (dx < 0) { img = headLeft; w = 120; h = 108; }
        else if (dy > 0) { img = headDown; w = 108; h = 120; }
        else { img = headUp; w = 108; h = 120; }

        drawScaledImage(img, x, y, w, h);

      } else if (i === snake.length - 1) {
        let dx = previous.x - current.x;
        let dy = previous.y - current.y;

        if (dx === 0 && dy === 0) {
            dx = -lastFaceDir.dx; 
            dy = -lastFaceDir.dy;
        }

        let img, w, h;
        if (dx > 0) { img = tailLeft; w = 100; h = 92; }
        else if (dx < 0) { img = tailRight; w = 100; h = 92; }
        else if (dy > 0) { img = tailUp; w = 92; h = 100; }
        else { img = tailDown; w = 92; h = 100; }

        drawScaledImage(img, x, y, w, h);

      } else {
        const parent = snake[i - 1];
        let img, w, h;
        
        if (current.y === parent.y) { 
          img = bodyHor; w = 100; h = 92;
        } else {
          img = bodyVer; w = 92; h = 100;
        }
        
        drawScaledImage(img, x, y, w, h);
      }
    }
  }

  ctx.drawImage(
    appleImg, 
    food.x * tileSize, 
    food.y * tileSize, 
    tileSize, 
    tileSize
  );
}

function drawGrid() {
  for (let y = 0; y < tileCountY; y++) {
    for (let x = 0; x < tileCountX; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#AAD751" : "#A2D149";
      ctx.fillRect(x * tileSize, y * tileSize, tileSize + 1, tileSize + 1);
    }
  }
}

function drawScaledImage(img, x, y, baseW, baseH) {
  const scale = tileSize / 100; 
  const width = baseW * scale;
  const height = baseH * scale;

  const offsetX = (tileSize - width) / 2;
  const offsetY = (tileSize - height) / 2;

  ctx.drawImage(img, x + offsetX, y + offsetY, width + 1, height + 1);
}

function spawnFood() {
  let valid = false;

  while (!valid) {
    food.x = Math.floor(Math.random() * (tileCountX - 2)) + 1;
    food.y = Math.floor(Math.random() * (tileCountY - 2)) + 1;

    valid = !snake.some(p => p.x === food.x && p.y === food.y);
  }
}

function isGameRunning() {
  return document.getElementById("gameScreen").style.display === "block";
}

function updateHighscore() {
  if (score > highscore) {
    highscore = score;
    sessionStorage.setItem("highscore", highscore);
    document.getElementById("highscore").innerText = highscore;
  }
}

function updateLivesUI() {
  const hearts = [
    document.getElementById("life1"),
    document.getElementById("life2"),
    document.getElementById("life3")
  ];

  for (let i = 0; i < 3; i++) {
    hearts[i].src = i < lives
      ? "assets/heart-full.png"
      : "assets/heart.png";
  }
}

function toggleSound() {
  isSoundOn = !isSoundOn;
  localStorage.setItem("sound", isSoundOn ? "on" : "off");
  updateSoundUI();
}

function updateSoundUI() {
  const soundBtn = document.getElementById("soundToggle");
  if (soundBtn) {
    soundBtn.innerText = isSoundOn ? "Efek Suara (ON)" : "Efek Suara (OFF)";
  }
}

window.onload = () => {
  updateSoundUI();
};

function showGuide(source) {
  guideSource = source;

  document.getElementById("guidePopup").style.display = "flex";
  
  const guideBox = document.querySelector(".guide-box");
  guideBox.scrollTop = 0;
}

function closeGuide() {
  document.getElementById("guidePopup").style.display = "none";
  document.activeElement.blur();
}

function showTutorial() {
    onboardingComplete = false;
    currentStep = 1;

    document.getElementById("startScreen").style.display = "none";

    const onboardingScreen = document.getElementById("onboardingScreen");
    onboardingScreen.style.display = "flex";

    document.getElementById("step1").style.display = "block";
    document.getElementById("step2").style.display = "none";
    document.getElementById("step3").style.display = "none";

    const statusBox = document.getElementById("cameraStatus");
    if (statusBox) {
        statusBox.innerText = "Mendeteksi Tangan...";
        statusBox.classList.remove("ready");
    }
}

const hand = document.querySelector(".demo-hand");
const gestureLabel = document.getElementById("gestureLabel");

const animations = [
  {
    x: "-50%",
    y: "-150%",
    text: "Atas"
  },
  {
    x: "100%",
    y: "-50%",
    text: "Kanan"
  },
  {
    x: "-50%",
    y: "50%",
    text: "Bawah"
  },
  {
    x: "-200%",
    y: "-50%",
    text: "Kiri"
  }
];

let index = 0;

setInterval(() => {
  const anim = animations[index];

  hand.style.transform = `translate(${anim.x}, ${anim.y})`;
  gestureLabel.innerText = anim.text;

  index = (index + 1) % animations.length;
}, 1000);

// document.addEventListener("keydown", (e) => {

//   if (e.key === "Escape") {

//     const guideVisible = document.getElementById("guidePopup").style.display === "flex";

//     if (guideVisible) {
//       closeGuide();

//       if (guideSource === "pause") {
//         document.getElementById("pauseScreen").style.display = "flex";
//       } else {
//         document.getElementById("startScreen").style.display = "flex";
//       }
//       return;
//     }

//     if (isGameRunning()) {
//       togglePause();
//       return;
//     }
//   }

//   if (isPaused) return;

//   let newDir = null;
//   let sound = null;

//   switch (e.key) {
//     case "ArrowUp": newDir = { x: 0, y: -1 }; sound = upSound; break;
//     case "ArrowDown": newDir = { x: 0, y: 1 }; sound = downSound; break;
//     case "ArrowLeft": newDir = { x: -1, y: 0 }; sound = leftSound; break;
//     case "ArrowRight": newDir = { x: 1, y: 0 }; sound = rightSound; break;
//   }

//   if (!newDir) return;

//   if (velocity.x === 0 && velocity.y === 0) {
//     const defaultDir = {
//       x: snake[0].x - snake[1].x,
//       y: snake[0].y - snake[1].y
//     };

//     if (newDir.x === -defaultDir.x && newDir.y === -defaultDir.y) return;

//     playSound(sound);
//     velocity = newDir;
//     return;
//   }

//   const lastDir = directionQueue.length > 0
//     ? directionQueue[directionQueue.length - 1]
//     : velocity;

//   if (newDir.x === -lastDir.x && newDir.y === -lastDir.y) return;
//   if (newDir.x === lastDir.x && newDir.y === lastDir.y) return;

//   playSound(sound);

//   if (directionQueue.length < 3) {
//     directionQueue.push(newDir);
//   }
// });