const SERVICE_UUID =
  "12345678-1234-5678-1234-56789abcdef0";
const EVENT_UUID =
  "12345678-1234-5678-1234-56789abcdef1";

const board = document.querySelector("#board");
const connectBtn = document.querySelector("#connect");
const startBtn = document.querySelector("#start");
const statusEl = document.querySelector("#status");
const messageEl = document.querySelector("#message");
const scoreEl = document.querySelector("#score");
const timeEl = document.querySelector("#time");

let device = null;
let characteristic = null;
let connected = false;
let playing = false;
let score = 0;
let timeLeft = 30;
let activeHole = -1;
let gameTimer = null;
let moleTimer = null;
let moleDuration = 950;

// Create 16 holes in row-major order.
const holes = Array.from({ length: 16 }, (_, id) => {
  const button = document.createElement("button");
  button.className = "hole";
  button.textContent = "🕳️";
  button.setAttribute("aria-label", `Hole ${id + 1}`);

  button.addEventListener("click", () => hitHole(id));

  board.appendChild(button);
  return button;
});

function setStatus(text) {
  statusEl.textContent = text;
}

function clearMole() {
  if (activeHole >= 0) {
    holes[activeHole].classList.remove("active");
    holes[activeHole].textContent = "🕳️";
  }
  activeHole = -1;
}

function spawnMole() {
  if (!playing) return;

  clearMole();

  const id = Math.floor(Math.random() * holes.length);
  activeHole = id;

  holes[id].classList.add("active");
  holes[id].textContent = "🐹";

  clearTimeout(moleTimer);
  moleTimer = setTimeout(() => {
    clearMole();
    if (playing) spawnMole();
  }, moleDuration);
}

function hitHole(id) {
  if (!playing || id !== activeHole) return;

  clearTimeout(moleTimer);
  holes[id].classList.add("hit");
  holes[id].textContent = "💥";
  activeHole = -1;

  score++;
  scoreEl.textContent = score;
  messageEl.textContent = "Nice hit!";

  setTimeout(() => {
    holes[id].classList.remove("hit");
    holes[id].textContent = "🕳️";
  }, 180);

  if (playing) spawnMole();
}

function startGame() {
  clearInterval(gameTimer);
  clearTimeout(moleTimer);
  clearMole();

  score = 0;
  timeLeft = 30;
  playing = true;
  moleDuration = 950;

  scoreEl.textContent = score;
  timeEl.textContent = timeLeft;
  messageEl.textContent = "Go! Catch the moles!";
  startBtn.disabled = true;

  spawnMole();

  gameTimer = setInterval(() => {
    timeLeft--;
    timeEl.textContent = timeLeft;

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function endGame() {
  playing = false;
  clearInterval(gameTimer);
  clearTimeout(moleTimer);
  clearMole();

  startBtn.disabled = !connected;
  messageEl.textContent = `Game over! Final score: ${score}`;
}

async function connectController() {
  if (!navigator.bluetooth) {
    setStatus("Web Bluetooth unavailable. Try desktop Chrome or Edge over HTTPS.");
    return;
  }

  try {
    setStatus("Choose MoleController in the Bluetooth picker...");

    // FIX: Filter by SERVICE_UUID instead of strict device name
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID]
    });

    device.addEventListener("gattserverdisconnected", () => {
      connected = false;
      playing = false;
      clearInterval(gameTimer);
      clearTimeout(moleTimer);
      clearMole();

      startBtn.disabled = true;
      setStatus("Controller disconnected");
      messageEl.textContent = "Reconnect your controller to play.";
    });

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    characteristic =
      await service.getCharacteristic(EVENT_UUID);

    await characteristic.startNotifications();
    characteristic.addEventListener(
      "characteristicvaluechanged",
      onButtonEvent
    );

    connected = true;
    startBtn.disabled = false;
    setStatus(`Connected: ${device.name}`);
    messageEl.textContent = "Ready! Start the game.";
  } catch (error) {
    setStatus(`Connection failed: ${error.message}`);
  }
}

function onButtonEvent(event) {
  const data = event.target.value;
  const id = data.getUint8(0);
  const pressed = data.getUint8(1) === 1;

  // Only score on the press edge, never on release.
  if (pressed && id < 16) {
    hitHole(id);
  }
}

connectBtn.addEventListener("click", connectController);
startBtn.addEventListener("click", startGame);

// Allow keyboard testing: keys 1-9 and A-G represent IDs 0-15.
document.addEventListener("keydown", event => {
  if (event.repeat) return;

  const key = event.key.toUpperCase();
  const id = "123456789ABCDEFG".indexOf(key);

  if (id >= 0) hitHole(id);
});
