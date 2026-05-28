const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const virtualCursor = document.getElementById('virtual-cursor');

let lastGesture = "";
let hoverTimer;
let currentHoverElement = null;

let lastScrollTime = 0;
let pauseTimer = null;

let onboardingComplete = localStorage.getItem("onboarding_done") === "true";
let currentStep = 1;

window.addEventListener("DOMContentLoaded", () => {
    const onboardingScreen = document.getElementById("onboardingScreen");
    const startScreen = document.getElementById("startScreen");

    if (onboardingComplete) {
        startScreen.style.display = "flex";
        onboardingScreen.style.display = "none";
    } else {
        onboardingScreen.style.display = "flex";
        startScreen.style.display = "none";
    }
});

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

const THRESHOLD = {
    min: 0.40,
    max: 0.60
};

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    drawGuides();

    let gestureText = "Tidak Ada";
    let accuracyText = "0%";

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const confidence = (results.multiHandedness[0].score * 100).toFixed(1);
        accuracyText = confidence + "%";

        if (!onboardingComplete) {
            if (currentStep === 1) {
                const statusBox = document.getElementById("cameraStatus");
                if (statusBox && !statusBox.classList.contains("ready")) {
                    statusBox.innerText = "Tangan Terdeteksi";
                    statusBox.classList.add("ready");
                    setTimeout(() => {
                        if (currentStep === 1 && !onboardingComplete) {
                            nextOnboardingStep(2);
                        }
                    }, 1000);
                }
            }
        }

        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#FFFFFF', lineWidth: 2});
            drawLandmarks(canvasCtx, landmarks, {color: '#6AB04A', lineWidth: 2, radius: 2});

            const indexFinger = landmarks[8];
            const thumbTip = landmarks[4];
            const pinkyTip = landmarks[20];

            const guidePopup = document.getElementById("guidePopup");
            if (guidePopup.style.display === "flex") {
                handleScrollInteraction(indexFinger.y);
            }

            const handSpan = Math.hypot(thumbTip.x - pinkyTip.x, thumbTip.y - pinkyTip.y);

            if (isGameRunning() && !isPaused && !isGameOver && handSpan > 0.2) {
                if (!pauseTimer) {
                    pauseTimer = setTimeout(() => {
                        togglePause();
                        pauseTimer = null;
                    }, 1000); 
                }
            } else {
                clearTimeout(pauseTimer);
                pauseTimer = null;
            }

            if (!isGameRunning() || isPaused && !isCountingDown) {
                if (virtualCursor) {
                    virtualCursor.style.display = 'block';

                    const cursorX = (1 - indexFinger.x) * window.innerWidth;
                    const cursorY = indexFinger.y * window.innerHeight;
                    
                    virtualCursor.style.left = cursorX + 'px';
                    virtualCursor.style.top = cursorY + 'px';
                    
                    handleMenuInteraction(cursorX, cursorY);
                }
            } else {
                if (virtualCursor) virtualCursor.style.display = 'none';
                resetHover();
            }
            gestureText = getActiveDirection(indexFinger.x, indexFinger.y) || "Tengah";
            processGesture(indexFinger.x, indexFinger.y);
        }
    } else {
        if (virtualCursor) virtualCursor.style.display = 'none';
        resetHover();
    }
    document.getElementById("current-gesture").innerText = gestureText;
    document.getElementById("current-accuracy").innerText = accuracyText;

    canvasCtx.restore();
}

function handleMenuInteraction(x, y) {
    const element = document.elementFromPoint(x, y);
    
    if (element && element.tagName === "BUTTON") {
        if (currentHoverElement !== element) {
            resetHover();
            currentHoverElement = element;
            element.classList.add('finger-hover');
            
            hoverTimer = setTimeout(() => {
                element.click();
                resetHover();
            }, 1000);
        }
    } else {
        resetHover();
    }
}

function handleScrollInteraction(y) {
    const guideBox = document.querySelector(".guide-box");
    if (!guideBox) return;

    const now = Date.now();
    if (now - lastScrollTime < 30) return; 

    if (y < 0.25) { 
        guideBox.scrollTop -= 15;
        lastScrollTime = now;
    }
    else if (y > 0.75) { 
        guideBox.scrollTop += 15;
        lastScrollTime = now;
    }
}

function resetHover() {
    clearTimeout(hoverTimer);
    if (currentHoverElement) {
        currentHoverElement.classList.remove('finger-hover');
        currentHoverElement = null;
    }
}

function getActiveDirection(x, y) {
    if (x < THRESHOLD.min) return "Kanan"; 
    if (x > THRESHOLD.max) return "Kiri";
    if (y < THRESHOLD.min) return "Atas";
    if (y > THRESHOLD.max) return "Bawah";
    return null; 
}

function processGesture(x, y) {
    if (isPaused || isGameOver || !isGameRunning()) return;

    let newDir = null;
    let sound = null;

    if (x < THRESHOLD.min) { 
        newDir = { x: 1, y: 0 }; sound = rightSound;
    } else if (x > THRESHOLD.max) { 
        newDir = { x: -1, y: 0 }; sound = leftSound;
    } 
    else if (y < THRESHOLD.min) { 
        newDir = { x: 0, y: -1 }; sound = upSound;
    } else if (y > THRESHOLD.max) { 
        newDir = { x: 0, y: 1 }; sound = downSound;
    } else {
        lastGesture = "Tengah";
        return;
    }

    const gestureLabel = getActiveDirection(x, y);
    if (lastGesture !== gestureLabel) {
        lastGesture = gestureLabel;
        handleGestureInput(newDir, sound);
    }
}

function handleGestureInput(newDir, sound) {
    let lastDir = directionQueue.length > 0 
        ? directionQueue[directionQueue.length - 1] 
        : velocity;

    if (lastDir.x === 0 && lastDir.y === 0) {
        if (newDir.x === -1) return;
    } else {
        if (newDir.x === -lastDir.x && newDir.y === -lastDir.y) return;
    }

    if (newDir.x === lastDir.x && newDir.y === lastDir.y) return;

    playSound(sound);
    if (directionQueue.length < 3) { 
        directionQueue.push(newDir);
    }
}

function drawGuides() {
    const w = canvasElement.width;
    const h = canvasElement.height;

    canvasCtx.strokeStyle = "#FFFFFF";
    canvasCtx.lineWidth = 1;

    canvasCtx.beginPath();
    canvasCtx.moveTo(w / 2, 0); canvasCtx.lineTo(w / 2, h);
    canvasCtx.moveTo(0, h / 2); canvasCtx.lineTo(w, h / 2);
    canvasCtx.stroke();

    canvasCtx.strokeStyle = "#E7471D";
    canvasCtx.strokeRect(
        w * THRESHOLD.min, 
        h * THRESHOLD.min, 
        w * (THRESHOLD.max - THRESHOLD.min), 
        h * (THRESHOLD.max - THRESHOLD.min)
    );
}

function nextOnboardingStep(step) {
    currentStep = step;
    document.querySelectorAll('.onboarding-step').forEach(el => el.style.display = 'none');
    const targetStep = document.getElementById(`step${step}`);
    if (targetStep) {
        targetStep.style.display = 'block';
    } else {
        finishOnboarding();
    }
}

function finishOnboarding() {
    onboardingComplete = true;
    localStorage.setItem("onboarding_done", "true"); 
    document.getElementById("onboardingScreen").style.display = "none";
    document.getElementById("startScreen").style.display = "flex";
}

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: 300, height: 200
});
camera.start();