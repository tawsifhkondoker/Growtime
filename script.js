// constants
const SAVE_KEY = "growtime.save.v1";
const PLOT_COUNT = 6;

const PLANTS = {
  daisy: {
    key: "daisy",
    name: "Daisy",
    emoji: "🌼",
    growMs: 5 * 60 * 1000,
    reward: 5,
    seedCost: 10,
  },
  tulip: {
    key: "tulip",
    name: "Tulip",
    emoji: "🌷",
    growMs: 15 * 60 * 1000,
    reward: 12,
    seedCost: 25,
  },
  sunflower: {
    key: "sunflower",
    name: "Sunflower",
    emoji: "🌻",
    growMs: 30 * 60 * 1000,
    reward: 25,
    seedCost: 50,
  },
};

const ACHIEVEMENTS = [
  {
    key: "firstSeed",
    title: "First sprout",
    description: "Plant your first seed.",
    reward: 10,
  },
  {
    key: "firstHarvest",
    title: "First harvest",
    description: "Harvest a mature plant.",
    reward: 5,
  },
  {
    key: "fivePlants",
    title: "Green thumb",
    description: "Plant five seeds in total.",
    reward: 20,
  },
];

// state

function createInitialState() {
  return {
    version: 1,
    coins: 0,
    plots: Array.from({ length: PLOT_COUNT }, () => null),
    inventory: { daisy: 3, tulip: 0, sunflower: 0 },
    upgrades: { extraPlots: false, fastGrowth: false },
    achievements: { firstSeed: false, firstHarvest: false, fivePlants: false },
    stats: { totalPlanted: 0, totalHarvests: 0 },
    lastVisit: null,
  };
}

let state = createInitialState();

// helpers

function effectiveGrowMs(plant) {
  const multiplier = state.upgrades.fastGrowth ? 0.5 : 1;
  return plant.growMs * multiplier;
}

function plotStage(plot) {
  if (!plot) return null;
  const plant = PLANTS[plot.type];
  if (!plant) return null;
  const elapsed = Date.now() - plot.plantedAt;
  const progress = Math.min(elapsed / effectiveGrowMs(plant), 1);
  let stage = "seed";
  if (progress >= 1) stage = "mature";
  else if (progress >= 0.33) stage = "sprout";
  return { plant, progress, stage };
}

// actions

function plant(plotIndex, type = "daisy") {
  const plot = state.plots[plotIndex];
  if (plot !== null) return;
  if (!state.inventory[type] || state.inventory[type] <= 0) {
    console.info(`[growtime] No ${type} seeds in inventory.`);
    return;
  }

  state.inventory[type] -= 1;
  state.plots[plotIndex] = { type, plantedAt: Date.now() };
  state.stats.totalPlanted += 1;

  // Achievement checks will be added later
  render();
}

function harvest(plotIndex) {
  const info = plotStage(state.plots[plotIndex]);
  if (!info || info.stage !== "mature") return;

  state.coins += info.plant.reward;
  state.stats.totalHarvests += 1;
  state.plots[plotIndex] = null;

  // will be added later savestate()
  render();
}

// render

const els = {
  coinBalance: document.getElementById("coin-balance"),
  gardenGrid: document.getElementById("garden-grid"),
  inventoryStrip: document.getElementById("inventory-strip"),
  shopList: document.getElementById("shop-list"),
  achievementsList: document.getElementById("achievements-list"),
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".panel"),
};

function renderCoins() {
  els.coinBalance.textContent = String(state.coins);
}

function renderInventory() {
  els.inventoryStrip.innerHTML = "";
  Object.values(PLANTS).forEach((plant) => {
    const count = state.inventory[plant.key] || 0;
    const chip = document.createElement("span");
    chip.className = "seed-chip";
    chip.innerHTML = `${plant.emoji} ${plant.name} × ${count}`;
    els.inventoryStrip.appendChild(chip);
  });
}

function renderGarden() {
  els.gardenGrid.innerHTML = "";

  state.plots.forEach((plot, index) => {
    const info = plotStage(plot);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "plot" + (plot ? "" : " empty");
    card.setAttribute("aria-label", plot ? `${info.plant.name} plot` : `Empty plot ${index + 1}`);

    if (!plot) {
      card.innerHTML = `<span class="plot-label">Empty plot</span>`;
      card.addEventListener("click", () => plant(index, "daisy"));
    } else {
      const progressPercent = Math.round(info.progress * 100);
      card.innerHTML = `
        <span class="plot-plant">${info.plant.emoji}</span>
        <span class="plot-type">${info.plant.name} · ${info.stage}</span>
        <span class="progress-track"><span class="progress-fill" style="width:${progressPercent}%"></span></span>
        `;
      if (info.stage === "mature") {
        const harvestBtn = document.createElement("button");
        harvestBtn.type = "button";
        harvestBtn.className = "harvest-button";
        harvestBtn.textContent = `Harvest +${info.plant.reward}`;
        harvestBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          harvest(index);
        });
        card.appendChild(harvestBtn);
      }
    }

    els.gardenGrid.appendChild(card);
  });
}

function renderShop() {
  els.shopList.innerHTML = "";
  Object.values(PLANTS).forEach((plant) => {
    const li = document.createElement("li");
    li.className = "shop-item";
    li.innerHTML = `
      <div class="shop-item-text">
        <span class="shop-item-title">${plant.emoji} ${plant.name} seeds</span>
        <span class="shop-item-meta">Costs ${plant.seedCost} coins · grows in ${Math.round(plant.growMs / 60000)} min</span>
      </div>
      <button class="primary-button" type="button" disabled>Buy (Hour 7)</button>
    `;
    els.shopList.appendChild(li);
  });
}

function renderAchievements() {
  els.achievementsList.innerHTML = "";
  ACHIEVEMENTS.forEach((achievement) => {
    const unlocked = Boolean(state.achievements[achievement.key]);
    const li = document.createElement("li");
    li.className = "achievement-item " + (unlocked ? "unlocked" : "locked");
    li.innerHTML = `
      <div class="achievement-text">
        <span class="achievement-title">${achievement.title}</span>
        <span class="achievement-meta">${achievement.description}</span>
      </div>
      <span class="seed-chip">${unlocked ? "Unlocked" : `+${achievement.reward} coins`}</span>
    `;
    els.achievementsList.appendChild(li);
  });
}

function render() {
  renderCoins();
  renderInventory();
  renderGarden();
  renderShop();
  renderAchievements();
}

//  tabs

function initTabs() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      els.tabs.forEach((t) => t.classList.toggle("active", t === tab));
      els.panels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === target);
      });
    });
  });
}

// debug helpers

window.growtime = {
  getState: () => state,
  reset: () => {
    state = createInitialState();
    render();
    console.info("[growtime] state reset");
  },
  // Simulate elapsed time by moving plantedAt into the past.
  fastForward: (minutes = 10) => {
    const delta = minutes * 60 * 1000;
    state.plots.forEach((plot) => {
      if (plot) plot.plantedAt -= delta;
    });
    render();
    console.info(`[growtime] fast-forwarded ${minutes} min`);
  },
};

// boot

initTabs();
render();