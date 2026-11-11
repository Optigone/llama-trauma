/* Llama Trauma boot: UI wiring, customizer, service worker. */
import { createGame, BODY_COLORS, BLANKET_COLORS, HATS, loadSave } from "./game.js";
import * as audio from "./audio.js";

const $ = (id) => document.getElementById(id);

const game = createGame({
  canvas: $("game"),
  preview: $("preview"),
  ui: {
    titleScreen: $("title-screen"),
    customScreen: $("customizer-screen"),
    goScreen: $("gameover-screen"),
    hud: $("hud"),
    hint: $("hint"),
    hudScore: $("hud-score"),
    hudCoins: $("hud-coin-count"),
    titleBest: $("title-best"),
    titleCoins: $("title-coins"),
    btnMute: $("btn-mute"),
    btnMuteTitle: $("btn-mute-title"),
    goOops: $("go-oops"),
    goReason: $("go-reason"),
    goScore: $("go-score"),
    goBest: $("go-best"),
    goCoins: $("go-coins")
  },
  onCustomOpen: renderCustomizer
});

function swatchButton(color, selected, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "swatch" + (selected ? " selected" : "");
  b.style.background = color;
  b.setAttribute("aria-label", color);
  b.dataset.color = color.toLowerCase();
  b.addEventListener("click", () => onClick(color));
  return b;
}

function norm(hex) {
  return String(hex || "").toLowerCase();
}

function renderCustomizer() {
  const save = game.getSave();
  const bodyBox = $("body-swatches");
  const blanketBox = $("blanket-swatches");
  const hatRow = $("hat-row");
  bodyBox.innerHTML = "";
  blanketBox.innerHTML = "";
  hatRow.innerHTML = "";

  for (const c of BODY_COLORS) {
    bodyBox.appendChild(swatchButton(c, norm(save.custom.body) === norm(c), (color) => {
      game.setBodyColor(color);
      $("body-picker").value = color;
      renderCustomizer();
    }));
  }
  $("body-picker").value = save.custom.body;

  for (const c of BLANKET_COLORS) {
    blanketBox.appendChild(swatchButton(c, norm(save.custom.blanket) === norm(c), (color) => {
      game.setBlanketColor(color);
      $("blanket-picker").value = color;
      renderCustomizer();
    }));
  }
  $("blanket-picker").value = save.custom.blanket;

  for (const hat of HATS) {
    const unlocked = save.unlockedHats.includes(hat.id);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hat-btn" + (save.custom.hat === hat.id ? " selected" : "") + (!unlocked ? " locked" : "");
    b.dataset.hat = hat.id;
    const emoji = {
      none: "🦙", flower: "🌸", bow: "🎀", party: "🎉",
      cowboy: "🤠", beanie: "🧢", propeller: "🚁", crown: "👑", shades: "😎"
    }[hat.id] || "🎩";
    b.innerHTML = `<span>${emoji}</span><span>${hat.name}</span>` +
      (unlocked || hat.cost === 0 ? "" : `<span class="cost">${hat.cost} coins</span>`);
    b.addEventListener("click", () => {
      audio.unlock();
      const res = game.setHat(hat.id);
      const msg = $("hat-msg");
      if (!res.ok && res.reason === "coins") {
        msg.hidden = false;
        msg.textContent = `Need ${res.need} coins (you have ${res.have}). Keep hopping!`;
      } else {
        msg.hidden = true;
        msg.textContent = "";
      }
      renderCustomizer();
      $("title-coins").textContent = String(game.getSave().coins);
    });
    hatRow.appendChild(b);
  }
}

$("body-picker").addEventListener("input", (e) => {
  game.setBodyColor(e.target.value);
  renderCustomizer();
});
$("blanket-picker").addEventListener("input", (e) => {
  game.setBlanketColor(e.target.value);
  renderCustomizer();
});

$("btn-play").addEventListener("click", () => game.startGame());
$("btn-dress").addEventListener("click", () => { renderCustomizer(); game.openCustomizer(); });
$("btn-custom-back").addEventListener("click", () => game.closeCustomizer(false));
$("btn-custom-done").addEventListener("click", () => game.closeCustomizer(false));
$("btn-again").addEventListener("click", () => game.startGame());
$("btn-go-dress").addEventListener("click", () => { renderCustomizer(); game.openCustomizer(); });
$("btn-go-home").addEventListener("click", () => game.showTitle());
$("btn-mute").addEventListener("click", () => { audio.unlock(); game.toggleMuted(); });
$("btn-mute-title").addEventListener("click", () => { audio.unlock(); game.toggleMuted(); });

document.addEventListener("pointerdown", () => audio.unlock(), { once: true });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* offline first load may fail; retry later */ });
  });
}

// Public test / debug hooks (used by the Playwright verifier).
window.LlamaTrauma = game;
window.LlamaTraumaAudio = audio;

renderCustomizer();
const save = loadSave();
$("title-best").textContent = String(save.highScore);
$("title-coins").textContent = String(save.coins);
