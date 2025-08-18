// External libraries loaded in HTML: Chart.js, jsQR, QRCode

// Version management and auto-update functionality
const CURRENT_VERSION = document.querySelector('meta[name="app-version"]').getAttribute('content');

let updateCheckInterval = null;

function startUpdateChecker() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }
  updateCheckInterval = setInterval(() => {
    checkForUpdates();
  }, 300000);
  setTimeout(() => {
    checkForUpdates();
  }, 10000);
}

async function checkForUpdates() {
  try {
    const response = await fetch(window.location.href + '?_cb=' + Date.now(), {
      method: 'HEAD',
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (response.ok) {
      const fullResponse = await fetch(window.location.href + '?_cb=' + Date.now(), { cache: 'no-cache' });
      const htmlContent = await fullResponse.text();
      const versionMatch = htmlContent.match(/name="app-version"\s+content="([^"]+)"/);
      if (versionMatch) {
        const serverVersion = versionMatch[1];
        if (serverVersion !== CURRENT_VERSION) {
          console.log(`Update detected: ${CURRENT_VERSION} -> ${serverVersion}`);
          showUpdateNotification(serverVersion);
        }
      }
    }
  } catch (error) {
    console.log('Update check failed (this is normal if offline):', error);
  }
}

function showUpdateNotification(newVersion) {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
  const updateBanner = document.createElement('div');
  updateBanner.id = 'updateBanner';
  updateBanner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; background: linear-gradient(135deg, #ff6b35, #f7931e);
    color: white; padding: 12px 20px; text-align: center; font-weight: 600; font-size: 14px; z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3); animation: slideDown 0.3s ease-out;`;
  updateBanner.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 15px; flex-wrap: wrap;">
      <span>🚀 New version available (${newVersion})! Click to update.</span>
      <div style="display: flex; gap: 10px;">
        <button onclick="forceReload()" style="background: white; color: #ff6b35; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 12px;">Update Now</button>
        <button onclick="dismissUpdate()" style="background: transparent; color: white; border: 1px solid white; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 12px;">Later</button>
      </div>
    </div>`;
  const style = document.createElement('style');
  style.textContent = `@keyframes slideDown { from { transform: translateY(-100%);} to { transform: translateY(0);} }`;
  document.head.appendChild(style);
  document.body.appendChild(updateBanner);
  setTimeout(() => { if (document.getElementById('updateBanner')) { forceReload(); } }, 30000);
}

function forceReload() {
  if (typeof saveCurrentDataToCloud === 'function' && !isViewOnlyMode) {
    saveCurrentDataToCloud().finally(() => { performReload(); });
  } else {
    performReload();
  }
}

function performReload() {
  const url = new URL(window.location);
  url.searchParams.set('_cb', Date.now());
  url.searchParams.set('_v', Date.now());
  showToast("🔄 Updating app to latest version...", "loading", 2000);
  setTimeout(() => { window.location.href = url.toString(); }, 1000);
}

function dismissUpdate() {
  const banner = document.getElementById('updateBanner');
  if (banner) {
    banner.style.animation = 'slideUp 0.3s ease-in';
    setTimeout(() => banner.remove(), 300);
  }
  setTimeout(() => { startUpdateChecker(); }, 900000);
}

let chart;
let pendingAction = null;

let realtimeListener = null;
let lastKnownUpdateTime = null;

function showModal(title, message, action) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalMessage").textContent = message;
  document.getElementById("confirmModal").style.display = "block";
  pendingAction = action;
}

function closeModal() {
  document.getElementById("confirmModal").style.display = "none";
  pendingAction = null;
}

function confirmAction() {
  if (pendingAction) { pendingAction(); }
  closeModal();
}

function saveData() {
  if (isViewOnlyMode) { console.log("Save blocked - View Only Mode"); return; }
  const playerRows = document.querySelectorAll('input[id^="name"]').length;
  const pointValue = parseFloat(document.getElementById("pointValue").value) || 0.15;
  const gstPercent = parseFloat(document.getElementById("gstPercent").value) || 25.0;
  const data = { numPlayers: playerRows, pointValue, gstPercent, players: [] };
  for (let i = 1; i <= playerRows; i++) {
    const nameInput = document.getElementById(`name${i}`);
    if (nameInput) {
      const name = nameInput.value.trim();
      const scores = [];
      for (let j = 1; j <= 10; j++) {
        const scoreInput = document.getElementById(`p${i}r${j}`);
        const val = scoreInput ? parseInt(scoreInput.value) : -1;
        scores.push(isNaN(val) ? -1 : val);
      }
      const randomNumber = parseInt(nameInput.dataset.randomNumber) || null;
      data.players.push({ name, scores, randomNumber });
    }
  }
  localStorage.setItem("scoreData", JSON.stringify(data));
  autoSaveToCloud();
}

function disableGameSettingsAfterStart() {
  const loadGameSection = document.querySelector('.controls > div:first-child');
  const gameSetupSection = document.querySelector('.controls > div:nth-child(2)');
  if (loadGameSection) loadGameSection.style.display = "none";
  if (gameSetupSection) gameSetupSection.style.display = "none";
  const closeGameIconBtn = document.getElementById("closeGameIconBtn");
  if (closeGameIconBtn) closeGameIconBtn.style.display = "flex";
}

function enableGameSettings() {
  const loadGameSection = document.querySelector('.controls > div:first-child');
  const gameSetupSection = document.querySelector('.controls > div:nth-child(2)');
  if (loadGameSection) loadGameSection.style.display = "block";
  if (gameSetupSection) gameSetupSection.style.display = "block";
  const closeGameIconBtn = document.getElementById("closeGameIconBtn");
  if (closeGameIconBtn) closeGameIconBtn.style.display = "none";
}

function loadData() {
  const saved = localStorage.getItem("scoreData");
  if (!saved) {
    isViewOnlyMode = false;
    localStorage.removeItem("gameMode");
    removeViewOnlyIndicator();
    enableGameSettings();
    return;
  }
  const data = JSON.parse(saved);
  document.getElementById("pointValue").value = data.pointValue || 0.15;
  document.getElementById("gstPercent").value = data.gstPercent || 25.0;
  generateTable(data, false);
  updateGameIdDisplay();
  const storedMode = localStorage.getItem("gameMode");
  if (storedMode === "view") { isViewOnlyMode = true; }
  else if (storedMode === "edit") { isViewOnlyMode = false; }
  else { isViewOnlyMode = false; localStorage.setItem("gameMode", "edit"); }
  if (isViewOnlyMode) {
    applyViewOnlyRestrictions();
    const gameId = localStorage.getItem("gameId");
    if (gameId) { startRealtimeListener(gameId); }
  } else {
    removeViewOnlyRestrictions();
    stopRealtimeListener();
  }
  disableGameSettingsAfterStart();
  updateWhatsAppButtons();
}

function startNewGame() {
  const startButton = document.querySelector(".start-play-button");
  if (startButton && startButton.disabled) { return; }
  localStorage.removeItem("scoreData");
  localStorage.removeItem("gameId");
  localStorage.removeItem("gamePin");
  localStorage.removeItem("gameMode");
  isViewOnlyMode = false;
  localStorage.setItem("gameMode", "edit");
  removeViewOnlyIndicator();
  stopRealtimeListener();
  const gameId = Math.random().toString(36).substr(2, 9).toUpperCase();
  localStorage.setItem("gameId", gameId);
  let pin; do { pin = ("000" + Math.floor(Math.random() * 10000)).slice(-4); } while (pin === "0000");
  localStorage.setItem("gamePin", pin);
  const initialGameData = {
    numPlayers: 2,
    pointValue: parseFloat(document.getElementById("pointValue").value) || 0.15,
    gstPercent: parseFloat(document.getElementById("gstPercent").value) || 25.0,
    players: [
      { name: "Player 1", scores: Array(10).fill(-1), randomNumber: null },
      { name: "Player 2", scores: Array(10).fill(-1), randomNumber: null }
    ]
  };
  localStorage.setItem("scoreData", JSON.stringify(initialGameData));
  generateTable(initialGameData, true);
  updateGameIdDisplay();
  disableGameSettingsAfterStart();
  saveInitialGameStateToCloud(pin);
  updateWhatsAppButtons();
}

async function saveInitialGameStateToCloud(pin) {
  const gameId = localStorage.getItem("gameId");
  const data = localStorage.getItem("scoreData");
  if (!gameId || !window.db) { return; }
  try {
    const gameData = data ? JSON.parse(data) : { numPlayers: 2, pointValue: parseFloat(document.getElementById("pointValue").value) || 1.0, gstPercent: parseFloat(document.getElementById("gstPercent").value) || 18.0, players: [] };
    await window.firestore.setDoc(window.firestore.doc(window.db, "games", gameId), {
      gameId, pin: pin || localStorage.getItem("gamePin") || "0000", createdAt: window.firestore.serverTimestamp(), version: "1.0",
    });
    await window.firestore.setDoc(window.firestore.doc(window.db, "gameData", gameId), {
      data: gameData, lastUpdated: window.firestore.serverTimestamp(), version: "1.0",
    });
    console.log("Initial game state saved - Games & GameData:", gameId);
  } catch (error) { console.error("Failed to save initial game state to cloud:", error); }
}

function generateRandomNumber(existingNumbers = []) {
  let randomNum; do { randomNum = Math.floor(Math.random() * 89) + 11; } while (existingNumbers.includes(randomNum)); return randomNum;
}

function getExistingRandomNumbers(savedData = null) {
  const existingNumbers = [];
  if (savedData && savedData.players) {
    savedData.players.forEach(player => { if (player.randomNumber) { existingNumbers.push(player.randomNumber); } });
  }
  return existingNumbers;
}

function sortPlayersByRandomNumber(players) {
  return players.sort((a, b) => {
    if (!a.randomNumber && !b.randomNumber) return 0;
    if (!a.randomNumber) return 1;
    if (!b.randomNumber) return -1;
    return a.randomNumber - b.randomNumber;
  });
}

function addPlayer() {
  if (isViewOnlyMode) { showToast("❌ Cannot add players in View Only mode", "error"); return; }
  const currentPlayers = document.querySelectorAll('input[id^="name"]').length;
  if (currentPlayers >= 15) { showModal("⚠️ Maximum Players Reached", "Maximum 15 players allowed!", null); return; }
  saveData();
  const saved = localStorage.getItem("scoreData");
  let savedData = null;
  let newPlayerName = `Player ${currentPlayers + 1}`;
  if (saved) {
    savedData = JSON.parse(saved);
    const newPlayerCount = currentPlayers + 1;
    let newRandomNumber = null;
    if (newPlayerCount > 2) {
      if (currentPlayers === 2) {
        const existingNumbers = [];
        savedData.players.forEach(player => {
          if (!player.randomNumber) { player.randomNumber = generateRandomNumber(existingNumbers); existingNumbers.push(player.randomNumber); }
        });
      }
      const existingNumbers = getExistingRandomNumbers(savedData);
      newRandomNumber = generateRandomNumber(existingNumbers);
    }
    const newPlayer = { name: newPlayerName, scores: Array(10).fill(-1), randomNumber: newRandomNumber };
    savedData.players.push(newPlayer);
    savedData.numPlayers = savedData.players.length;
    if (currentPlayers + 1 > 2) {
      savedData.players = sortPlayersByRandomNumber(savedData.players);
      const newPlayerIndex = savedData.players.findIndex(p => p.name === newPlayerName);
      if (newPlayerIndex !== -1) { window.newPlayerRowIndex = newPlayerIndex + 1; }
    } else {
      window.newPlayerRowIndex = savedData.players.length;
    }
  } else {
    savedData = { numPlayers: currentPlayers + 1, pointValue: parseFloat(document.getElementById("pointValue").value) || 0.15, gstPercent: parseFloat(document.getElementById("gstPercent").value) || 25.0, players: [] };
    savedData.players.push({ name: newPlayerName, scores: Array(10).fill(-1), randomNumber: null });
    window.newPlayerRowIndex = savedData.players.length;
  }
  localStorage.setItem("scoreData", JSON.stringify(savedData));
  generateTable(savedData, true);
  setTimeout(() => { animateNewPlayerRow(); }, 100);
}

function animateNewPlayerRow() {
  if (window.newPlayerRowIndex) {
    const tableBody = document.querySelector('#scoreTableContainer tbody');
    if (tableBody) {
      const newRow = tableBody.querySelector(`tr:nth-child(${window.newPlayerRowIndex})`);
      if (newRow) {
        newRow.classList.add('new-player-row');
        newRow.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        setTimeout(() => { newRow.classList.remove('new-player-row'); }, 2000);
        const nameInput = newRow.querySelector('input[type="text"]');
        if (nameInput) { setTimeout(() => { nameInput.focus(); nameInput.select(); }, 500); }
      }
    }
    window.newPlayerRowIndex = null;
  }
}

function deletePlayer(playerIndex) {
  if (isViewOnlyMode) { showToast("❌ Cannot delete players in View Only mode", "error"); return; }
  const currentPlayers = document.querySelectorAll('input[id^="name"]').length;
  if (currentPlayers <= 2) { showModal("⚠️ Minimum Players Required", "At least 2 players are required to play the game!", null); return; }
  const nameInput = document.getElementById(`name${playerIndex}`);
  const playerName = nameInput ? nameInput.value.trim() || `Player ${playerIndex}` : `Player ${playerIndex}`;
  showModal("🗑️ Delete Player", `Are you sure you want to delete "${playerName}"? This action cannot be undone.`, () => { performDeletePlayer(playerIndex); });
}

function performDeletePlayer(playerIndex) {
  saveData();
  const saved = localStorage.getItem("scoreData");
  if (!saved) return;
  const savedData = JSON.parse(saved);
  if (savedData.players && savedData.players.length >= playerIndex) {
    if (savedData.players.length > 2) {
      const sortedPlayers = sortPlayersByRandomNumber(savedData.players);
      const playerToDelete = sortedPlayers[playerIndex - 1];
      const originalIndex = savedData.players.findIndex(p => (p.randomNumber && p.randomNumber === playerToDelete.randomNumber) || (p.name === playerToDelete.name && p.scores.join(',') === playerToDelete.scores.join(',')));
      if (originalIndex !== -1) { savedData.players.splice(originalIndex, 1); }
    } else {
      savedData.players.splice(playerIndex - 1, 1);
    }
    savedData.numPlayers = savedData.players.length;
    if (savedData.numPlayers === 2) { savedData.players.forEach(player => { player.randomNumber = null; }); }
  }
  localStorage.setItem("scoreData", JSON.stringify(savedData));
  generateTable(savedData, true);
  showToast(`✅ Player deleted successfully`, "success", 3000);
}

function generateTable(savedData = null, shouldSave = true) {
  let numPlayers; let playersData = [];
  if (savedData && savedData.numPlayers) { numPlayers = savedData.numPlayers; playersData = savedData.players || []; }
  else {
    const saved = localStorage.getItem("scoreData");
    if (saved) { const data = JSON.parse(saved); numPlayers = data.numPlayers || 2; playersData = data.players || []; }
    else { numPlayers = 2; playersData = [{ name: "Player 1", scores: Array(10).fill(-1), randomNumber: null }, { name: "Player 2", scores: Array(10).fill(-1), randomNumber: null }]; }
  }
  if (numPlayers > 2) {
    const existingNumbers = getExistingRandomNumbers({ players: playersData });
    playersData.forEach(player => { if (!player.randomNumber) { player.randomNumber = generateRandomNumber(existingNumbers); existingNumbers.push(player.randomNumber); } });
    playersData = sortPlayersByRandomNumber(playersData);
  }
  const showRandomNumbers = numPlayers > 2;
  const headerText = showRandomNumbers ? "Player (#)" : "Player";
  let html = `
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
  <h2 style="margin: 0;">Score</h2>
  <button onclick="postRoundResultsToWhatsApp()" style="
    background: linear-gradient(135deg, #25d366, #128c7e);
    color: white;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    font-size: 12px;
    box-shadow: 0 2px 4px rgba(37, 211, 102, 0.2);
    transition: all 0.3s ease;
    display: none;
    align-items: center;
    gap: 4px;
  " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 3px 6px rgba(37, 211, 102, 0.3)'" 
     onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(37, 211, 102, 0.2)'"><span>📱</span> Share Round</button>
</div>
<div class="table-container">
  <table>
    <thead>
      <tr style="background: linear-gradient(135deg, #343a40, #495057); box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <th style="border: 1px solid #495057; padding: 12px 8px; text-align: left; background: linear-gradient(135deg, #6c757d, #495057); color: white; font-weight: 700; font-size: 14px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); position: sticky; left: 0; z-index: 11; box-shadow: 2px 0 4px rgba(0,0,0,0.1);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>👤</span>
            <span>${headerText}</span>
          </div>
        </th>`;
  for (let round = 1; round <= 10; round++) {
    html += `<th style="border: 1px solid #495057; padding: 12px 8px; text-align: center; background: linear-gradient(135deg, #007bff, #0056b3); color: white; font-weight: 700; font-size: 13px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); position: relative; min-width: 70px;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
        <span style="font-size: 16px;">🎯</span>
        <span>Round ${round}</span>
      </div>
    </th>`;
  }
  html += `<th style="border: 1px solid #495057; padding: 12px 8px; text-align: center; background: linear-gradient(135deg, #dc3545, #c82333); color: white; font-weight: 700; font-size: 12px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); position: relative; min-width: 60px;">
    <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
      <span style="font-size: 14px;">🗑️</span>
      <span>Delete</span>
    </div>
  </th>`;
  html += `</tr></thead><tbody>`;
  for (let i = 1; i <= numPlayers; i++) {
    const playerData = playersData[i - 1] || { name: `Player ${i}`, scores: Array(10).fill(-1), randomNumber: null };
    const name = playerData.name || `Player ${i}`;
    const randomNumber = playerData.randomNumber || '';
    html += `<tr><td style="border: 1px solid #ccc; padding: 8px;">
      <input type="text" id="name${i}" value="${name}" data-random-number="${randomNumber}" style="border: none; background: transparent; width: 100%; padding: 4px; font-size: 14px;">`;
    if (showRandomNumbers && randomNumber) {
      html += `<div style="font-size: 10px; color: #6c757d; text-align: center; margin-top: 2px; font-weight: 600;">#${randomNumber}</div>`;
    }
    html += `</td>`;
    for (let j = 1; j <= 10; j++) {
      const val = playerData.scores && playerData.scores[j - 1] !== undefined ? playerData.scores[j - 1] : -1;
      html += `<td style=\"border: 1px solid #ccc; padding: 8px; text-align: center; min-width: 60px;\"><input type=\"number\" id=\"p${i}r${j}\" value=\"${val}\" min=\"-1\" max=\"100\" style=\"border: none; background: transparent; width: 100%; text-align: center; padding: 4px; font-size: 14px; min-width: 50px;\"></td>`;
    }
    html += `<td style="border: 1px solid #ccc; padding: 8px; text-align: center; min-width: 60px;">
      <button onclick="deletePlayer(${i})" style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s ease; min-width: 45px;" onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 2px 4px rgba(220, 53, 69, 0.4)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'" title="Delete ${name}">🗑️</button>
    </td>`;
    html += "</tr>";
  }
  html += "</tbody></table></div>";
  html += `
<div style="margin-top: 10px;">
  <button onclick="addPlayer()" class="add-player-btn" style="padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">+ Add Player</button>
</div>`;
  const tableContainer = document.querySelector('.table-container');
  let savedScrollLeft = 0; let savedScrollTop = 0;
  if (tableContainer) { savedScrollLeft = tableContainer.scrollLeft; savedScrollTop = tableContainer.scrollTop; }
  document.getElementById("scoreTableContainer").innerHTML = html;
  setTimeout(() => {
    const newTableContainer = document.querySelector('.table-container');
    if (newTableContainer && (savedScrollLeft > 0 || savedScrollTop > 0)) {
      newTableContainer.scrollLeft = savedScrollLeft;
      newTableContainer.scrollTop = savedScrollTop;
    }
    updateWhatsAppButtons();
  }, 0);
  if (!isViewOnlyMode) { addInputEventListeners(); }
  colorScoreInputs();
  if (isViewOnlyMode) { applyViewOnlyRestrictions(); }
  if (shouldSave !== false) { saveData(); }
  calculateScores();
  updateGameIdDisplay();
  updateWhatsAppButtons();
}

function addInputEventListeners() {
  const nameInputs = document.querySelectorAll('input[id^="name"]');
  nameInputs.forEach(input => {
    input.addEventListener('input', function() { if (!isViewOnlyMode) { saveData(); calculateScores(); } });
  });
  const scoreInputs = document.querySelectorAll('input[id^="p"][id*="r"]');
  scoreInputs.forEach(input => {
    input.addEventListener('input', function() { if (!isViewOnlyMode) { saveData(); calculateScores(); colorScoreInputs(); } });
  });
}

function colorScoreInputs() {
  const numPlayers = document.querySelectorAll('input[id^="name"]').length;
  for (let j = 1; j <= 10; j++) {
    const headerCell = document.querySelector(`table th:nth-child(${j + 1})`);
    if (headerCell) {
      headerCell.style.border = "1px solid #ccc";
      headerCell.style.borderLeft = "1px solid #ccc";
      headerCell.style.borderRight = "1px solid #ccc";
      headerCell.style.borderTop = "1px solid #ccc";
      headerCell.style.borderBottom = "1px solid #ccc";
    }
    for (let i = 1; i <= numPlayers; i++) {
      const cell = document.querySelector(`table tbody tr:nth-child(${i}) td:nth-child(${j + 1})`);
      if (cell) {
        cell.style.border = "1px solid #ccc";
        cell.style.borderLeft = "1px solid #ccc";
        cell.style.borderRight = "1px solid #ccc";
        cell.style.borderTop = "1px solid #ccc";
        cell.style.borderBottom = "1px solid #ccc";
      }
    }
  }
  for (let j = 1; j <= 10; j++) {
    let hasNegativeValue = false; let hasValidNonNegativeValue = false; let allValidScores = true;
    for (let i = 1; i <= numPlayers; i++) {
      const input = document.getElementById(`p${i}r${j}`);
      if (input) {
        const val = parseInt(input.value);
        if (!isNaN(val)) { if (val < 0 || val === -1) { hasNegativeValue = true; } else if (val >= 0) { hasValidNonNegativeValue = true; } }
        else { hasNegativeValue = true; allValidScores = false; }
      } else { hasNegativeValue = true; allValidScores = false; }
    }
    const headerCell2 = document.querySelector(`table th:nth-child(${j + 1})`);
    if (hasNegativeValue) {
      if (headerCell2) { headerCell2.style.borderLeft = "3px solid #dc3545"; headerCell2.style.borderRight = "3px solid #dc3545"; headerCell2.style.borderTop = "3px solid #dc3545"; }
      for (let i = 1; i <= numPlayers; i++) {
        const cell = document.querySelector(`table tbody tr:nth-child(${i}) td:nth-child(${j + 1})`);
        if (cell) { cell.style.borderLeft = "3px solid #dc3545"; cell.style.borderRight = "3px solid #dc3545"; if (i === numPlayers) { cell.style.borderBottom = "3px solid #dc3545"; } }
      }
    } else if (hasValidNonNegativeValue && allValidScores) {
      if (headerCell2) { headerCell2.style.borderLeft = "3px solid #28a745"; headerCell2.style.borderRight = "3px solid #28a745"; headerCell2.style.borderTop = "3px solid #28a745"; }
      for (let i = 1; i <= numPlayers; i++) {
        const cell = document.querySelector(`table tbody tr:nth-child(${i}) td:nth-child(${j + 1})`);
        if (cell) { cell.style.borderLeft = "3px solid #28a745"; cell.style.borderRight = "3px solid #28a745"; if (i === numPlayers) { cell.style.borderBottom = "3px solid #28a745"; } }
      }
    }
  }
  for (let i = 1; i <= numPlayers; i++) {
    for (let j = 1; j <= 10; j++) {
      const input = document.getElementById(`p${i}r${j}`);
      if (input) {
        const val = parseInt(input.value);
        if (isNaN(val) || val === -1) { input.style.color = "#6c757d"; input.style.fontStyle = "italic"; }
        else if (val < 0) { input.style.color = "#dc3545"; input.style.fontStyle = "normal"; input.style.fontWeight = "bold"; }
        else if (val < 40) { input.style.color = "#28a745"; input.style.fontStyle = "normal"; input.style.fontWeight = "normal"; }
        else if (val >= 40 && val <= 60) { input.style.color = "#ffc107"; input.style.fontStyle = "normal"; input.style.fontWeight = "normal"; }
        else { input.style.color = "#dc3545"; input.style.fontStyle = "normal"; input.style.fontWeight = "normal"; }
      }
    }
  }
}

function getCurrentRound() {
  const numPlayers = document.querySelectorAll('input[id^="name"]').length;
  for (let round = 1; round <= 10; round++) {
    let completedPlayers = 0;
    for (let player = 1; player <= numPlayers; player++) {
      const scoreInput = document.getElementById(`p${player}r${round}`);
      if (scoreInput && scoreInput.value !== '' && scoreInput.value !== '-1') { completedPlayers++; }
    }
    if (completedPlayers < numPlayers) { return `R${round}`; }
  }
  return 'GAME OVER';
}

function calculateScores() {
  const numPlayers = document.querySelectorAll('input[id^="name"]').length;
  const scores = [];
  const pointValue = parseFloat(document.getElementById("pointValue").value) || 0.15;
  const gstPercent = parseFloat(document.getElementById("gstPercent").value) || 25.0;
  for (let i = 1; i <= numPlayers; i++) {
    let total = 0;
    for (let j = 1; j <= 10; j++) {
      const scoreInput = document.getElementById(`p${i}r${j}`);
      if (scoreInput) { const val = parseInt(scoreInput.value); total += isNaN(val) || val === -1 ? 0 : val; }
    }
    const nameInput = document.getElementById(`name${i}`);
    const name = nameInput ? nameInput.value.trim() : `Player ${i}`;
    const randomNumber = nameInput ? nameInput.dataset.randomNumber : null;
    scores.push({ name, total, randomNumber });
  }
  const originalOrderScores = [...scores];
  const sortedScores = [...scores].sort((a, b) => a.total - b.total);
  const totalAllScores = sortedScores.reduce((sum, score) => sum + score.total, 0);
  sortedScores.forEach((score) => {
    score.grossAmount = Math.round((totalAllScores - score.total * numPlayers) * pointValue);
    if (score.grossAmount > 0) { score.gstPaid = Math.round((score.grossAmount * gstPercent) / 100); score.netAmount = score.grossAmount - score.gstPaid; }
    else { score.gstPaid = 0; score.netAmount = score.grossAmount; }
  });
  const totalGstCollected = sortedScores.reduce((sum, score) => sum + score.gstPaid, 0);
  const currentRound = getCurrentRound();
  let leaderboardHtml = `
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
  <h2 style="margin: 0;">Standings</h2>
  <button onclick=\"postLeaderboardToWhatsApp()\" style=\"
    background: linear-gradient(135deg, #128c7e, #075e54);
    color: white;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    font-size: 12px;
    box-shadow: 0 2px 4px rgba(18, 140, 126, 0.2);
    transition: all 0.3s ease;
    display: none;
    align-items: center;
    gap: 4px;\" onmouseover=\"this.style.transform='translateY(-1px)'; this.style.boxShadow='0 3px 6px rgba(18, 140, 126, 0.3)'\" 
     onmouseout=\"this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(18, 140, 126, 0.2)'\"><span>🏆</span> Share Results</button>
</div>
<div style="text-align: center; margin-bottom: 12px; padding: 8px 12px; background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 50%, #fff3e0 100%); border-radius: 12px; border: 2px solid #e1bee7; box-shadow: 0 4px 12px rgba(161, 136, 205, 0.2); position: relative; overflow: hidden; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(161, 136, 205, 0.25)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(161, 136, 205, 0.2)'"><div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); animation: shimmer 3s ease-in-out infinite; pointer-events: none;"></div><div style="position: relative; z-index: 1;"><div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;"><div style="display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.6); padding: 4px 8px; border-radius: 16px; border: 1px solid rgba(74, 20, 140, 0.2);"><span style="font-size: 14px;">💰</span><span style="font-size: 13px; color: #4a148c; font-weight: 700;">₹${pointValue}</span><span style="font-size: 11px; color: #6a1b9a; font-weight: 500;">/point</span></div><div style="display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.6); padding: 4px 8px; border-radius: 16px; border: 1px solid rgba(74, 20, 140, 0.2);"><span style="font-size: 14px;">📊</span><span style="font-size: 13px; color: #4a148c; font-weight: 700;">${gstPercent}%</span><span style="font-size: 11px; color: #6a1b9a; font-weight: 500;">GST</span></div><div style="display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.6); padding: 4px 8px; border-radius: 16px; border: 1px solid rgba(74, 20, 140, 0.2);"><span style="font-size: 14px;">${currentRound === 'GAME OVER' ? '🏁' : '🎯'}</span><span style="font-size: 13px; color: #4a148c; font-weight: 700;">${currentRound}</span><span style="font-size: 11px; color: #6a1b9a; font-weight: 500;">${currentRound === 'GAME OVER' ? '' : 'Round'}</span></div></div></div></div>
<style>@keyframes shimmer { 0% { transform: translateX(-100%) translateY(-100%) rotate(45deg);} 50% { transform: translateX(100%) translateY(100%) rotate(45deg);} 100% { transform: translateX(-100%) translateY(-100%) rotate(45deg);} }</style>
<table class="leaderboard-table" style="width: auto !important; min-width: auto !important; max-width: 650px !important; border-collapse: collapse; margin-top: 10px; display: table !important; table-layout: auto !important;">
  <thead>
    <tr style="background: linear-gradient(135deg, #212529, #343a40) !important;">
      <th style="border: 1px solid #ccc; padding: 6px; text-align: center; width: 50px !important; font-size: 12px; color: white !important; font-weight: bold !important;">Rank</th>
      <th style="border: 1px solid #ccc; padding: 6px; text-align: left; width: auto !important; min-width: 80px !important; max-width: 100px !important; font-size: 12px; color: white !important; font-weight: bold !important;">Player</th>
      <th style="border: 1px solid #ccc; padding: 6px; text-align: center; width: 50px !important; font-size: 12px; color: white !important; font-weight: bold !important;">Score</th>
      <th style="border: 1px solid #ccc; padding: 6px; text-align: center; width: 80px !important; font-size: 12px; color: white !important; font-weight: bold !important;">Gross Amount</th>
      <th style="border: 1px solid #ccc; padding: 6px; text-align: center; width: 65px !important; font-size: 12px; color: white !important; font-weight: bold !important;">GST (${gstPercent}%)</th>
      <th style="border: 1px solid #ccc; padding: 6px; text-align: center; width: 80px !important; font-size: 12px; color: white !important; font-weight: bold !important;">Net Amount</th>
    </tr>
  </thead>
  <tbody>`;
  sortedScores.forEach((score, index) => {
    let rankDisplay = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`;
    const grossAmount = score.grossAmount; const gstPaid = score.gstPaid; const netAmount = score.netAmount;
    const isWinner = grossAmount > 0; const isLoser = grossAmount < 0;
    let grossStyle = ""; let gstStyle = ""; let netStyle = "";
    if (isWinner) { grossStyle = "color: #28a745; font-weight: bold;"; gstStyle = "color: #dc3545; font-weight: bold;"; netStyle = "color: #28a745; font-weight: bold;"; }
    else if (isLoser) { grossStyle = "color: #dc3545; font-weight: bold;"; gstStyle = "color: #6c757d;"; netStyle = "color: #dc3545; font-weight: bold;"; }
    else { grossStyle = "color: #6c757d;"; gstStyle = "color: #6c757d;"; netStyle = "color: #6c757d;"; }
    leaderboardHtml += `
  <tr>
    <td style="border: 1px solid #ccc; padding: 6px; text-align: center; font-weight: bold; width: 50px !important; font-size: 11px;">${rankDisplay}</td>
    <td style="border: 1px solid #ccc; padding: 6px; width: auto !important; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
      ${score.name}${score.randomNumber && numPlayers > 2 ? ` <span style="color: #6c757d; font-size: 10px;">(#${score.randomNumber})</span>` : ''}
    </td>
    <td style="border: 1px solid #ccc; padding: 6px; text-align: center; width: 50px !important; font-size: 11px; font-weight: 600;">${score.total}</td>
    <td style="border: 1px solid #ccc; padding: 6px; text-align: center; width: 80px !important; font-size: 11px; ${grossStyle}">₹${grossAmount}</td>
    <td style="border: 1px solid #ccc; padding: 6px; text-align: center; width: 65px !important; font-size: 11px; ${gstStyle}">₹${gstPaid}</td>
    <td style="border: 1px solid #ccc; padding: 6px; text-align: center; width: 80px !important; font-size: 11px; ${netStyle}">₹${netAmount}</td>
  </tr>`;
  });
  leaderboardHtml += `
  </tbody>
  <tfoot>
    <tr style="background-color: #e9ecef; font-weight: bold;">
      <td colspan="4" style="border: 1px solid #ccc; padding: 6px; text-align: right; font-size: 12px; color: #6c757d;">Total GST Collected:</td>
      <td style="border: 1px solid #ccc; padding: 6px; text-align: center; font-size: 12px; color: #28a745; font-weight: bold;">₹${Math.round(totalGstCollected)}</td>
      <td style="border: 1px solid #ccc; padding: 6px; text-align: center; font-size: 12px; color: #6c757d;">-</td>
    </tr>
  </tfoot>
</table>`;
  document.getElementById("leaderboard").innerHTML = leaderboardHtml;
  updateChart(originalOrderScores);
  updateWhatsAppButtons();
  sortedScores.forEach((score, index) => {
    const scoreCell = document.querySelector(`.leaderboard-table tbody tr:nth-child(${index + 1}) td:nth-child(3)`);
    if (scoreCell) {
      if (score.total < 40) { scoreCell.style.color = "#28a745"; }
      else if (score.total >= 40 && score.total <= 60) { scoreCell.style.color = "#ffc107"; }
      else { scoreCell.style.color = "#dc3545"; }
    }
  });
  updateSettlementInfo(gstPercent, numPlayers, pointValue);
}

function updateChart(scores) {
  const ctx = document.getElementById("scoreChart").getContext("2d");
  const labels = scores.map((s) => s.name);
  const data = scores.map((s) => s.total);
  const minScore = Math.min(...data);
  const maxScore = Math.max(...data);
  const range = maxScore - minScore;
  const backgroundColors = data.map((score) => {
    if (range === 0) { return "rgb(128, 128, 128)"; }
    const position = (score - minScore) / range;
    if (position <= 0.33) { const green = Math.round(255 - position * 0.33 * 100); return `rgb(0, ${green}, 0)`; }
    else if (position <= 0.66) { const progress = (position - 0.33) / 0.33; const red = Math.round(255); const green = Math.round(255 - progress * 127); return `rgb(${red}, ${green}, 0)`; }
    else { const progress = (position - 0.66) / 0.34; const red = Math.round(200 + progress * 55); return `rgb(${red}, 0, 0)`; }
  });
  if (chart) chart.destroy();
  chart = new Chart(ctx, { type: "bar", data: { labels, datasets: [{ label: "Total Score", data, backgroundColor: backgroundColors, borderColor: "rgba(0,0,0,0.2)", borderWidth: 1 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }, x: {} } } });
  setTimeout(() => {
    const gstPercent = parseFloat(document.getElementById("gstPercent").value) || 18.0;
    const numPlayers = document.querySelectorAll('input[id^="name"]').length;
    const pointValue = parseFloat(document.getElementById("pointValue").value) || 0.15;
    updateSettlementInfo(gstPercent, numPlayers, pointValue);
  }, 100);
}

function updateSettlementInfo(gstPercent, numPlayers, pointValue) {
  const existingInfo = document.getElementById("settlementInfo");
  if (existingInfo) { existingInfo.remove(); }
  const settlementHtml = `
<div id="settlementInfo" style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;">
  <h4 style="margin: 0 0 12px 0; color: #495057; font-size: 16px;">💡 How Settlement Works:</h4>
  <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #6c757d; line-height: 1.5;">
    <li><strong style="color: #28a745;">Winners (Green):</strong> Receive money but pay ${gstPercent}% GST on winnings</li>
    <li><strong style="color: #dc3545;">Losers (Red):</strong> Pay money, no GST required</li>
    <li><strong>Formula:</strong> (Total All Scores - Your Score × ${numPlayers}) × ₹${pointValue}</li>
    <li><strong>GST:</strong> Only winners pay ${gstPercent}% GST on positive amounts</li>
    <li><strong>Net Amount:</strong> Gross Amount - GST (for winners) or just Gross Amount (for losers)</li>
  </ul>
  <div style="margin-top: 10px; padding: 8px; background-color: #e3f2fd; border-radius: 4px; font-size: 12px; color: #1565c0;">
    <strong>💰 Example:</strong> If you score 25 points in a ${numPlayers}-player game with ₹${pointValue}/point:<br>
    Your settlement = (Total of all ${numPlayers} scores - 25 × ${numPlayers}) × ₹${pointValue}
  </div>
</div>`;
  const chartContainer = document.querySelector(".chart-container");
  if (chartContainer) { chartContainer.insertAdjacentHTML("afterend", settlementHtml); }
}

function getGameId() { let gameId = localStorage.getItem("gameId"); if (!gameId) { gameId = Math.random().toString(36).substr(2, 9).toUpperCase(); localStorage.setItem("gameId", gameId); } return gameId; }

async function saveToCloud() {
  if (isViewOnlyMode) { showToast("❌ Cannot save in View Only mode", "error"); return; }
  if (!window.db) { showToast("❌ Firebase Not Ready - Please refresh the page!", "error"); return; }
  const gameId = getGameId();
  const data = localStorage.getItem("scoreData");
  if (!data) { showToast("⚠️ No game data to save to cloud!", "error"); return; }
  try {
    showToast("☁️ Saving game to cloud...", "loading");
    const gameDataRef = window.firestore.doc(window.db, "gameData", gameId);
    await window.firestore.setDoc(gameDataRef, { data: JSON.parse(data), lastUpdated: window.firestore.serverTimestamp(), version: "1.0" });
    hideLoadingToast();
    showToast(`✅ Game saved! ID: ${gameId}`, "success", 6000);
  } catch (error) {
    console.error("Save error:", error);
    hideLoadingToast();
    showToast("❌ Failed to save. Check your internet connection.", "error");
  }
}

async function loadFromCloud() {
  if (!window.db) { showToast("❌ Firebase Not Ready - Please refresh the page!", "error"); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const gameId = prompt("Enter Game ID to load game (Camera not supported):");
    if (gameId) { await loadGameById(gameId.trim().toUpperCase()); }
    return;
  }
  document.getElementById("qrScannerModal").style.display = "block";
  currentScanMode = "view"; isPINVerified = false;
  const viewRadio = document.querySelector('input[name="scanMode"][value="view"]');
  if (viewRadio) { viewRadio.checked = true; }
  const pinContainer = document.getElementById("pinContainer");
  const pinInput = document.getElementById("pinInput");
  const pinMessage = document.getElementById("pinMessage");
  if (pinContainer) pinContainer.style.display = "none";
  if (pinInput) pinInput.value = "";
  if (pinMessage) pinMessage.textContent = "";
  window.tempGameId = null;
  setTimeout(() => { startQRScanner(); }, 100);
}

let qrStream = null; let qrScanInterval = null; let currentCamera = "environment";
let currentScanMode = "view"; let isPINVerified = false; let isViewOnlyMode = false;

async function validatePIN(enteredPIN) {
  const pinMessage = document.getElementById("pinMessage");
  const gameId = localStorage.getItem("gameId") || getCurrentGameIdFromScanner();
  if (!gameId) { pinMessage.textContent = "⚠️ Please scan QR code first to get Game ID"; pinMessage.style.color = "#dc3545"; return; }
  if (!window.db) { pinMessage.textContent = "❌ Database not ready. Please try again."; pinMessage.style.color = "#dc3545"; return; }
  try {
    pinMessage.textContent = "🔍 Verifying PIN..."; pinMessage.style.color = "#007bff";
    const authDocSnap = await window.firestore.getDoc(window.firestore.doc(window.db, "games", gameId));
    if (authDocSnap.exists()) {
      const authData = authDocSnap.data();
      const storedPIN = authData.pin;
      if (storedPIN === enteredPIN) {
        localStorage.setItem("gamePin", storedPIN);
        pinMessage.textContent = "✅ PIN matched! You are in Edit Mode"; pinMessage.style.color = "#28a745";
        isPINVerified = true; currentScanMode = "edit";
        setTimeout(() => { closeQRScanner(); loadGameById(gameId, "edit"); }, 1000);
      } else {
        pinMessage.textContent = "❌ PIN not matched. Switching to View Mode"; pinMessage.style.color = "#dc3545";
        isPINVerified = false; currentScanMode = "view";
        const viewRadio = document.querySelector('input[name="scanMode"][value="view"]'); if (viewRadio) { viewRadio.checked = true; }
        setTimeout(() => { document.getElementById("pinContainer").style.display = "none"; }, 2000);
      }
    } else { pinMessage.textContent = "❌ Game not found in cloud database"; pinMessage.style.color = "#dc3545"; isPINVerified = false; currentScanMode = "view"; }
  } catch (error) {
    console.error("PIN validation error:", error);
    pinMessage.textContent = "❌ PIN verification failed. Network error."; pinMessage.style.color = "#dc3545"; isPINVerified = false; currentScanMode = "view";
  }
}

function getCurrentGameIdFromScanner() { return window.tempGameId || null; }

function manualEntry() {
  const selectedMode = document.querySelector('input[name="scanMode"]:checked').value;
  closeQRScanner();
  const gameId = prompt("Enter Game ID to load game:");
  if (gameId && gameId.trim()) {
    const cleanGameId = gameId.trim().toUpperCase();
    if (selectedMode === "view") { currentScanMode = "view"; isPINVerified = false; loadGameById(cleanGameId, "view"); }
    else {
      const enteredPIN = prompt("Enter 4-digit PIN for Edit access:");
      if (enteredPIN && enteredPIN.trim().length === 4) { window.tempGameId = cleanGameId; validatePINAndLoad(cleanGameId, enteredPIN.trim()); }
      else if (enteredPIN !== null) { showToast("❌ Invalid PIN format. Please enter a 4-digit PIN.", "error"); }
    }
  }
}

async function validatePINAndLoad(gameId, enteredPIN) {
  if (!window.db) { showToast("❌ Database not ready. Please try again.", "error"); return; }
  try {
    showToast("🔍 Verifying PIN...", "loading");
    const authDocSnap = await window.firestore.getDoc(window.firestore.doc(window.db, "games", gameId));
    if (authDocSnap.exists()) {
      const authData = authDocSnap.data();
      const storedPIN = authData.pin;
      if (storedPIN === enteredPIN) { localStorage.setItem("gamePin", storedPIN); isPINVerified = true; currentScanMode = "edit"; hideLoadingToast(); loadGameById(gameId, "edit"); }
      else { hideLoadingToast(); showToast("❌ PIN not matched. Loading in View Only mode instead.", "error", 6000); isPINVerified = false; currentScanMode = "view"; loadGameById(gameId, "view"); }
    } else { hideLoadingToast(); showToast("❌ Game not found in cloud database", "error"); }
  } catch (error) {
    console.error("PIN validation error:", error);
    hideLoadingToast(); showToast("❌ PIN verification failed. Loading in View Only mode.", "error", 6000); isPINVerified = false; currentScanMode = "view"; loadGameById(gameId, "view");
  }
}

async function switchCamera() {
  const switchBtn = document.getElementById("switchCameraBtn");
  const statusText = document.getElementById("scannerStatus");
  switchBtn.disabled = true; switchBtn.textContent = "🔄 Switching...";
  if (qrStream) { qrStream.getTracks().forEach(track => track.stop()); qrStream = null; }
  if (qrScanInterval) { clearInterval(qrScanInterval); qrScanInterval = null; }
  currentCamera = currentCamera === "environment" ? "user" : "environment";
  try { await startQRScanner(); switchBtn.textContent = currentCamera === "environment" ? "📱 Front Camera" : "📹 Back Camera"; }
  catch (error) { statusText.textContent = "❌ Failed to switch camera"; statusText.style.color = "#dc3545"; switchBtn.textContent = "🔄 Switch Camera"; }
  switchBtn.disabled = false;
}

async function startQRScanner() {
  const video = document.getElementById("qrScannerVideo");
  const canvas = document.getElementById("qrScannerCanvas");
  const context = canvas.getContext("2d");
  const statusText = document.getElementById("scannerStatus");
  try {
    statusText.textContent = "📷 Starting camera..."; statusText.style.color = "#007bff";
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentCamera, width: { ideal: 1280 }, height: { ideal: 720 } } });
    video.srcObject = qrStream; video.play();
    const switchBtn = document.getElementById("switchCameraBtn");
    if (switchBtn) { switchBtn.style.display = "inline-block"; switchBtn.textContent = currentCamera === "environment" ? "📱 Front Camera" : "📹 Back Camera"; }
    statusText.textContent = "🔍 Scanning for QR code... Position it within the green frame"; statusText.style.color = "#28a745";
    video.addEventListener("loadedmetadata", () => {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      qrScanInterval = setInterval(() => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            const scannerFrame = document.getElementById("scannerFrame");
            if (scannerFrame) {
              scannerFrame.style.borderColor = "#ffc107"; scannerFrame.style.background = "rgba(255, 193, 7, 0.2)";
              scannerFrame.innerHTML = `<div style="color: #ffc107; font-size: 18px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); text-align: center; padding: 10px;">✅ QR Code Found!<br><small>Processing...</small></div>`;
            }
            const selectedMode = document.querySelector('input[name="scanMode"]:checked').value;
            const gameId = code.data.trim().toUpperCase();
            window.tempGameId = gameId;
            if (selectedMode === "view") {
              statusText.textContent = "✅ QR Code detected! Loading in View Only mode..."; statusText.style.color = "#28a745";
              showToast(`👁️ Loading in View Only mode - Game ID: ${gameId}`, "info", 4000);
              currentScanMode = "view"; isPINVerified = false; closeQRScanner(); loadGameById(gameId);
            } else {
              statusText.textContent = "✅ QR Code detected! Please verify PIN for Edit access..."; statusText.style.color = "#ffc107";
              clearInterval(qrScanInterval); qrScanInterval = null;
              const pinInput = document.getElementById("pinInput"); const pinMessage = document.getElementById("pinMessage");
              if (pinMessage) { pinMessage.textContent = `🔐 Enter PIN for Game ID: ${gameId}`; pinMessage.style.color = "#007bff"; }
              if (pinInput) { pinInput.focus(); pinInput.select(); }
              showToast(`🔐 QR Code found! Enter PIN to access Edit mode`, "info", 6000);
            }
          }
        }
      }, 300);
    });
  } catch (error) {
    console.error("Camera access error:", error);
    statusText.textContent = "❌ Camera access denied or not available"; statusText.style.color = "#dc3545";
    showToast("❌ Camera access denied or not available", "error");
    setTimeout(() => { closeQRScanner(); const gameId = prompt("Enter Game ID to load game:"); if (gameId) { loadGameById(gameId.trim().toUpperCase()); } }, 2000);
  }
}

function closeQRScanner() {
  const video = document.getElementById("qrScannerVideo");
  const statusText = document.getElementById("scannerStatus");
  const switchBtn = document.getElementById("switchCameraBtn");
  if (qrStream) { qrStream.getTracks().forEach(track => track.stop()); qrStream = null; }
  if (qrScanInterval) { clearInterval(qrScanInterval); qrScanInterval = null; }
  video.srcObject = null;
  if (statusText) { statusText.textContent = "📷 Starting camera..."; statusText.style.color = "#007bff"; }
  if (switchBtn) { switchBtn.style.display = "none"; }
  const scannerFrame = document.getElementById("scannerFrame");
  if (scannerFrame) {
    scannerFrame.style.borderColor = "#00ff00"; scannerFrame.style.background = "rgba(0, 255, 0, 0.1)";
    scannerFrame.innerHTML = `<div style="color: #00ff00; font-size: 16px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); text-align: center; padding: 10px;">📱 Position QR Code Here</div>`;
  }
  document.getElementById("qrScannerModal").style.display = "none";
}

async function loadGameById(gameId, mode = currentScanMode) {
  if (!gameId) return;
  try {
    showToast("📥 Loading game from cloud...", "loading");
    const gameDataSnap = await window.firestore.getDoc(window.firestore.doc(window.db, "gameData", gameId));
    if (gameDataSnap.exists()) {
      const cloudData = gameDataSnap.data();
      localStorage.setItem("scoreData", JSON.stringify(cloudData.data));
      localStorage.setItem("gameId", gameId);
      if (mode === "edit" && isPINVerified) { console.log("Edit mode - PIN already validated and stored"); }
      else { console.log("View mode - no PIN needed"); }
      document.getElementById("pointValue").value = cloudData.data.pointValue || 1.0;
      document.getElementById("gstPercent").value = cloudData.data.gstPercent || 18.0;
      loadData(); updateGameIdDisplay();
      if (mode === "edit" && isPINVerified) {
        isViewOnlyMode = false; localStorage.setItem("gameMode", "edit"); showToast(`✅ Game loaded in Edit Mode! ID: ${gameId}`, "success", 5000);
        document.title = "⭐ Rummy Score Master (Edit Mode)"; setTimeout(() => (document.title = "⭐ Rummy Score Master"), 5000);
      } else { isViewOnlyMode = true; localStorage.setItem("gameMode", "view"); showToast(`👁️ Game loaded in View Only Mode! ID: ${gameId}`, "info", 5000); document.title = "⭐ Rummy Score Master (View Only)"; setTimeout(() => (document.title = "⭐ Rummy Score Master"), 5000); }
      if (isViewOnlyMode) { applyViewOnlyRestrictions(); startRealtimeListener(gameId); } else { removeViewOnlyRestrictions(); stopRealtimeListener(); }
      window.tempGameId = null; updateWhatsAppButtons();
    } else { showToast("❌ Game ID not found. Please check and try again.", "error"); }
  } catch (error) {
    console.error("Load error:", error);
    showToast("❌ Failed to load game. Check your internet connection.", "error");
  }
}

function applyViewOnlyRestrictions() {
  const scoreInputs = document.querySelectorAll('input[id^="p"][id*="r"]');
  scoreInputs.forEach(input => { input.disabled = true; input.style.backgroundColor = "#f8f9fa"; input.style.color = "#6c757d"; input.style.cursor = "not-allowed"; input.title = "View Only Mode - Editing disabled"; });
  const nameInputs = document.querySelectorAll('input[id^="name"]');
  nameInputs.forEach(input => { input.disabled = true; input.style.backgroundColor = "#f8f9fa"; input.style.color = "#6c757d"; input.style.cursor = "not-allowed"; input.title = "View Only Mode - Editing disabled"; });
  const addPlayerBtn = document.querySelector('.add-player-btn'); if (addPlayerBtn) { addPlayerBtn.style.display = "none"; }
  const deleteButtons = document.querySelectorAll('button[onclick^="deletePlayer"]');
  deleteButtons.forEach(button => { button.disabled = true; button.style.backgroundColor = "#6c757d"; button.style.color = "#ffffff"; button.style.cursor = "not-allowed"; button.style.opacity = "0.6"; button.title = "View Only Mode - Cannot delete players"; button.textContent = "🔒"; });
  const pointValueInput = document.getElementById("pointValue"); const gstInput = document.getElementById("gstPercent");
  if (pointValueInput) { pointValueInput.disabled = true; pointValueInput.style.backgroundColor = "#f8f9fa"; pointValueInput.style.color = "#6c757d"; pointValueInput.style.cursor = "not-allowed"; pointValueInput.title = "View Only Mode - Settings cannot be changed"; }
  if (gstInput) { gstInput.disabled = true; gstInput.style.backgroundColor = "#f8f9fa"; gstInput.style.color = "#6c757d"; gstInput.style.cursor = "not-allowed"; gstInput.title = "View Only Mode - Settings cannot be changed"; }
  addViewOnlyIndicator();
}

function removeViewOnlyRestrictions() {
  const scoreInputs = document.querySelectorAll('input[id^="p"][id*="r"]');
  scoreInputs.forEach(input => { input.disabled = false; input.style.backgroundColor = ""; input.style.color = ""; input.style.cursor = ""; input.title = ""; });
  const nameInputs = document.querySelectorAll('input[id^="name"]');
  nameInputs.forEach(input => { input.disabled = false; input.style.backgroundColor = ""; input.style.color = ""; input.style.cursor = ""; input.title = ""; });
  const addPlayerBtn = document.querySelector('.add-player-btn'); if (addPlayerBtn) { addPlayerBtn.style.display = ""; }
  const deleteButtons = document.querySelectorAll('button[onclick^="deletePlayer"]');
  deleteButtons.forEach(button => { button.disabled = false; button.style.backgroundColor = ""; button.style.color = ""; button.style.cursor = ""; button.style.opacity = ""; button.title = ""; button.textContent = "🗑️"; });
  const gameData = localStorage.getItem("scoreData");
  if (!gameData) {
    const pointValueInput = document.getElementById("pointValue"); const gstInput = document.getElementById("gstPercent");
    if (pointValueInput) { pointValueInput.disabled = false; pointValueInput.style.backgroundColor = ""; pointValueInput.style.color = ""; pointValueInput.style.cursor = ""; pointValueInput.title = ""; }
    if (gstInput) { gstInput.disabled = false; gstInput.style.backgroundColor = ""; gstInput.style.color = ""; gstInput.style.cursor = ""; gstInput.title = ""; }
  }
  removeViewOnlyIndicator();
}

function addViewOnlyIndicator() {
  removeViewOnlyIndicator();
  const header = document.querySelector('h1');
  if (header) {
    const indicator = document.createElement('div');
    indicator.id = 'viewOnlyIndicator';
    indicator.innerHTML = `
      <div style="background: linear-gradient(135deg, #17a2b8, #138496); color: white; padding: 8px 15px; border-radius: 20px; font-size: 14px; font-weight: 600; text-align: center; margin: 10px auto; max-width: 300px; box-shadow: 0 2px 8px rgba(23, 162, 184, 0.3); animation: pulse 2s infinite;">👁️ VIEW ONLY MODE - Editing Disabled</div>`;
    header.insertAdjacentElement('afterend', indicator);
  }
}

function removeViewOnlyIndicator() { const indicator = document.getElementById('viewOnlyIndicator'); if (indicator) { indicator.remove(); } }

async function autoSaveToCloud() {
  if (isViewOnlyMode) { console.log("Auto-save blocked - View Only Mode"); return; }
  const gameId = localStorage.getItem("gameId");
  if (!gameId || !window.db) return;
  const data = localStorage.getItem("scoreData");
  if (!data) return;
  try {
    await window.firestore.setDoc(window.firestore.doc(window.db, "gameData", gameId), { data: JSON.parse(data), lastUpdated: window.firestore.serverTimestamp(), version: "1.0" });
    console.log("Auto-save: Game data saved to gameData collection for gameId:", gameId);
    document.title = "⭐ Rummy Score Master (Synced)"; setTimeout(() => (document.title = "⭐ Rummy Score Master"), 2000);
  } catch (error) { console.error("Auto-save failed:", error); }
}

function startRealtimeListener(gameId) {
  if (!isViewOnlyMode || !gameId || !window.db) { console.log("Not starting real-time listener: isViewOnlyMode=", isViewOnlyMode, "gameId=", gameId, "window.db=", !!window.db); return; }
  stopRealtimeListener();
  console.log("🔴 Starting real-time listener for gameId:", gameId);
  try {
    const gameDataRef = window.firestore.doc(window.db, "gameData", gameId);
    localStorage.setItem("gameId", gameId);
    realtimeListener = window.firestore.onSnapshot(gameDataRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const cloudData = docSnapshot.data();
        const cloudUpdateTime = cloudData.lastUpdated;
        if (!lastKnownUpdateTime || (cloudUpdateTime && cloudUpdateTime.toMillis() > lastKnownUpdateTime)) {
          console.log("📥 Real-time update received for gameId:", gameId);
          lastKnownUpdateTime = cloudUpdateTime ? cloudUpdateTime.toMillis() : Date.now();
          localStorage.setItem("scoreData", JSON.stringify(cloudData.data));
          document.getElementById("pointValue").value = cloudData.data.pointValue || 1.0;
          document.getElementById("gstPercent").value = cloudData.data.gstPercent || 18.0;
          console.log("Updating tables from real-time data");
          generateTable(cloudData.data, false);
          calculateScores();
          updateWhatsAppButtons();
          showRealtimeUpdateNotification();
          document.title = "⭐ Rummy Score Master (Updated)";
          setTimeout(() => { const mode = isViewOnlyMode ? " (View Only)" : ""; document.title = "⭐ Rummy Score Master" + mode; }, 3000);
        }
      } else {
        console.log("⚠️ Game document deleted or not found");
        showToast("⚠️ Game data not found. Game may have been deleted.", "error");
      }
    }, (error) => {
      console.error("Real-time listener error:", error);
      if (error.code !== 'permission-denied') { console.warn("Real-time listener failed, will retry on next load"); }
    });
  } catch (error) { console.error("Failed to start real-time listener:", error); }
}

function stopRealtimeListener() { if (realtimeListener) { console.log("🔴 Stopping real-time listener"); realtimeListener(); realtimeListener = null; lastKnownUpdateTime = null; } }

function showRealtimeUpdateNotification() {
  const notification = document.createElement("div");
  notification.style.cssText = `position: fixed; top: 70px; right: 20px; background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; z-index: 9998; box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3); animation: slideInRight 0.3s ease-out; opacity: 0.9;`;
  notification.textContent = "📊 Data updated in real-time";
  document.body.appendChild(notification);
  setTimeout(() => { notification.style.animation = "slideOutRight 0.3s ease-in"; setTimeout(() => notification.remove(), 300); }, 2000);
}

function showToast(message, type = "info", duration = 4000) {
  const existingToast = document.getElementById("toast"); if (existingToast) { existingToast.remove(); }
  const toast = document.createElement("div"); toast.id = "toast"; toast.textContent = message;
  const baseStyles = { position: "fixed", top: "20px", right: "20px", padding: "12px 20px", borderRadius: "8px", color: "white", fontWeight: "500", fontSize: "14px", zIndex: "9999", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", maxWidth: "350px", wordWrap: "break-word", animation: "slideInRight 0.3s ease-out", fontFamily: "Arial, sans-serif" };
  const typeStyles = { loading: { backgroundColor: "#17a2b8", borderLeft: "4px solid #138496" }, success: { backgroundColor: "#28a745", borderLeft: "4px solid #1e7e34" }, error: { backgroundColor: "#dc3545", borderLeft: "4px solid #c82333" }, info: { backgroundColor: "#007bff", borderLeft: "4px solid #0056b3" } };
  Object.assign(toast.style, baseStyles, typeStyles[type] || typeStyles.info);
  if (type === "loading") { const spinner = document.createElement("span"); spinner.innerHTML = "⏳ "; spinner.style.marginRight = "8px"; toast.insertBefore(spinner, toast.firstChild); }
  document.body.appendChild(toast);
  if (type !== "loading") { setTimeout(() => { if (toast.parentNode) { toast.style.animation = "slideOutRight 0.3s ease-in"; setTimeout(() => toast.remove(), 300); } }, duration); }
  return toast;
}

function hideLoadingToast() { const toast = document.getElementById("toast"); if (toast) { toast.style.animation = "slideOutRight 0.3s ease-in"; setTimeout(() => toast.remove(), 300); } }

function updateGameIdDisplay() {
  const gameId = localStorage.getItem("gameId");
  const gamePin = localStorage.getItem("gamePin");
  const display = document.getElementById("gameIdDisplay");
  const qrContainer = document.getElementById("qrCodeContainer");
  const gameIdPinText = document.getElementById("gameIdPinText");
  let input = document.getElementById("gameIdInput");
  if (!input) {
    input = document.createElement("input");
    input.type = "text"; input.id = "gameIdInput"; input.readOnly = true; input.style.display = "none";
    if (qrContainer && qrContainer.parentNode) { qrContainer.parentNode.appendChild(input); }
  }
  if (gameId) {
    input.value = gameId; display.style.display = "block";
    if (qrContainer) { qrContainer.innerHTML = ""; new QRCode(qrContainer, { text: gameId, width: 90, height: 90, colorDark: "#1565c0", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H }); }
    if (gameIdPinText) { gameIdPinText.textContent = `ID: ${gameId}   |   PIN: ${gamePin || ''}`; }
  } else {
    display.style.display = "none"; if (qrContainer) qrContainer.innerHTML = ""; if (gameIdPinText) gameIdPinText.textContent = ""; input.value = "";
  }
}

function copyGameId() {
  const gameIdInput = document.getElementById("gameIdInput");
  const qrContainer = document.getElementById("qrCodeContainer");
  const gameId = gameIdInput.value;
  if (!gameId) { showToast("❌ No Game ID to copy!", "error"); return; }
  navigator.clipboard.writeText(gameId).then(() => {
    showToast(`✅ Game ID copied: ${gameId}`, "success", 3000);
    qrContainer.classList.add("copied"); setTimeout(() => { qrContainer.classList.remove("copied"); }, 1000);
  }).catch(() => {
    gameIdInput.select(); document.execCommand("copy");
    showToast(`✅ Game ID copied: ${gameId}`, "success", 3000);
    qrContainer.classList.add("copied"); setTimeout(() => { qrContainer.classList.remove("copied"); }, 1000);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const gameIdInput = document.getElementById("gameIdInput");
  if (gameIdInput) { gameIdInput.addEventListener("click", function () { this.select(); }); }
  const modeRadios = document.querySelectorAll('input[name="scanMode"]');
  const pinContainer = document.getElementById("pinContainer");
  const pinInput = document.getElementById("pinInput");
  const pinMessage = document.getElementById("pinMessage");
  modeRadios.forEach(radio => { radio.addEventListener("change", function() { if (this.value === "edit") { pinContainer.style.display = "block"; pinMessage.textContent = ""; pinMessage.style.color = "#856404"; pinInput.value = ""; pinInput.focus(); } else { pinContainer.style.display = "none"; pinMessage.textContent = "👁️ View Only Mode - No PIN required"; pinMessage.style.color = "#28a745"; } }); });
  if (pinInput) {
    pinInput.addEventListener("input", function() { this.value = this.value.replace(/[^0-9]/g, ''); pinMessage.textContent = ""; pinMessage.style.color = "#856404"; if (this.value.length === 4) { setTimeout(() => validatePIN(this.value), 300); } });
    pinInput.addEventListener("keypress", function(e) { if (e.key === "Enter" && this.value.length === 4) { validatePIN(this.value); } });
  }
  const qrModal = document.getElementById("qrScannerModal");
  if (qrModal) { qrModal.addEventListener("click", function (event) { if (event.target === qrModal) { closeQRScanner(); } }); }
  document.addEventListener("keydown", function (event) { if (event.key === "Escape" && qrModal.style.display === "block") { closeQRScanner(); } });
});

window.onload = function () {
  loadData();
  updateGameIdDisplay();
  setTimeout(updateWhatsAppButtons, 100);
  setTimeout(() => { if (isViewOnlyMode) { const gameId = localStorage.getItem("gameId"); if (gameId) { startRealtimeListener(gameId); } } }, 1000);
  const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      if (mutation.type === 'childList' && (mutation.target.id === 'scoreTableContainer' || mutation.target.id === 'leaderboard')) { updateWhatsAppButtons(); break; }
    }
  });
  observer.observe(document.getElementById('scoreTableContainer'), { childList: true });
  observer.observe(document.getElementById('leaderboard'), { childList: true });
  startUpdateChecker();
};

async function closeGame() {
  await saveCurrentDataToCloud();
  localStorage.removeItem("scoreData");
  localStorage.removeItem("gameId");
  localStorage.removeItem("gamePin");
  localStorage.removeItem("gameMode");
  localStorage.clear();
  isViewOnlyMode = false; removeViewOnlyIndicator(); stopRealtimeListener();
  document.getElementById("scoreTableContainer").innerHTML = "";
  document.getElementById("leaderboard").innerHTML = "";
  const canvas = document.getElementById("scoreChart"); const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height); if (chart) { chart.destroy(); chart = null; }
  document.getElementById("pointValue").value = "1.00";
  document.getElementById("gstPercent").value = "18.00";
  const gameIdDisplay = document.getElementById("gameIdDisplay"); if (gameIdDisplay) { gameIdDisplay.style.display = "none"; }
  const gameIdInput = document.getElementById("gameIdInput"); if (gameIdInput) { gameIdInput.value = ""; }
  enableGameSettings();
  document.title = "⭐ Rummy Score Master";
  updateWhatsAppButtons();
}

async function saveCurrentDataToCloud() {
  if (isViewOnlyMode) { console.log("Cloud save blocked - View Only Mode"); return; }
  const gameId = localStorage.getItem("gameId");
  const data = localStorage.getItem("scoreData");
  if (!gameId || !data || !window.db) { return; }
  try {
    const gameData = JSON.parse(data);
    const gameDataRef = window.firestore.doc(window.db, "gameData", gameId);
    await window.firestore.setDoc(gameDataRef, { data: gameData, lastUpdated: window.firestore.serverTimestamp(), version: "1.0" });
    console.log("Data saved to gameData collection for gameId:", gameId);
  } catch (error) { console.error("Failed to save to cloud:", error); }
}

function confirmCloseGame() { showModal("🗑️ Clear Local Game Data", "This will permanently delete all game data from your browser's local storage and reset the app. Any data saved to the cloud will remain safe. Continue?", () => { closeGame(); }); }

function updateWhatsAppButtons() {
  const whatsAppButtons = document.querySelectorAll('button[onclick^="post"][onclick$="WhatsApp()"]');
  const gameData = localStorage.getItem("scoreData");
  whatsAppButtons.forEach(button => { if (gameData) { button.style.display = "flex"; } else { button.style.display = "none"; } });
  if (whatsAppButtons.length === 0 && gameData) { setTimeout(updateWhatsAppButtons, 500); }
}

function getLastCompletedRoundResults() {
  const numPlayers = document.querySelectorAll('input[id^="name"]').length;
  let lastCompletedRound = 0;
  for (let round = 1; round <= 10; round++) {
    let completedPlayers = 0;
    for (let player = 1; player <= numPlayers; player++) {
      const scoreInput = document.getElementById(`p${player}r${round}`);
      if (scoreInput && scoreInput.value !== '' && scoreInput.value !== '-1') { completedPlayers++; }
    }
    if (completedPlayers === numPlayers) { lastCompletedRound = round; } else { break; }
  }
  const roundResults = [];
  if (lastCompletedRound === 0) { return { roundNumber: 0, currentRound: 'NO ROUNDS COMPLETED', results: [] }; }
  for (let i = 1; i <= numPlayers; i++) {
    const nameInput = document.getElementById(`name${i}`);
    const scoreInput = document.getElementById(`p${i}r${lastCompletedRound}`);
    if (nameInput && scoreInput) {
      const name = nameInput.value.trim() || `Player ${i}`;
      const score = scoreInput.value;
      const randomNumber = nameInput.dataset.randomNumber;
      roundResults.push({ name, score, randomNumber });
    }
  }
  return { roundNumber: lastCompletedRound, currentRound: `R${lastCompletedRound}`, results: roundResults };
}

function formatRoundResultsForWhatsApp() {
  const roundData = getLastCompletedRoundResults();
  const gameId = localStorage.getItem("gameId");
  const pointValue = parseFloat(document.getElementById("pointValue").value) || 0.15;
  if (roundData.roundNumber === 0) { return "No rounds completed yet. Complete a round to share results!"; }
  let message = `🎯 *ROUND ${roundData.roundNumber} RESULTS* 🎯\n\n`;
  message += `Game ID: ${gameId}\n`;
  message += `Point Value: ₹${pointValue}\n\n`;
  const sortedResults = roundData.results.sort((a, b) => { const scoreA = a.score === "0" ? 0 : parseInt(a.score) || -1; const scoreB = b.score === "0" ? 0 : parseInt(b.score) || -1; return scoreA - scoreB; });
  sortedResults.forEach((player, index) => {
    const score = player.score === "0" ? 0 : parseInt(player.score) || -1;
    const scoreText = score === -1 ? "Not played" : score.toString();
    const playerName = player.randomNumber ? `${player.name} (#${player.randomNumber})` : player.name;
    let emoji = "";
    if (index === 0 && score !== -1) emoji = "🥇"; else if (index === 1 && score !== -1) emoji = "🥈"; else if (index === 2 && score !== -1) emoji = "🥉"; else if (score === -1) emoji = "⏳"; else emoji = "📊";
    message += `${emoji} ${playerName}: ${scoreText}\n`;
  });
  message += `\n${roundData.currentRound === 'GAME OVER' ? '🏁 GAME COMPLETED! 🏁' : '🎮 Keep playing!'}`;
  return message;
}

function formatLeaderboardForWhatsApp() {
  const gameId = localStorage.getItem("gameId");
  const pointValue = parseFloat(document.getElementById("pointValue").value) || 0.15;
  const gstPercent = parseFloat(document.getElementById("gstPercent").value) || 25.0;
  const numPlayers = document.querySelectorAll('input[id^="name"]').length;
  const scores = [];
  for (let i = 1; i <= numPlayers; i++) {
    let total = 0;
    for (let j = 1; j <= 10; j++) {
      const scoreInput = document.getElementById(`p${i}r${j}`);
      if (scoreInput) { const val = parseInt(scoreInput.value); total += isNaN(val) || val === -1 ? 0 : val; }
    }
    const nameInput = document.getElementById(`name${i}`);
    const name = nameInput ? nameInput.value.trim() : `Player ${i}`;
    const randomNumber = nameInput ? nameInput.dataset.randomNumber : null;
    scores.push({ name, total, randomNumber });
  }
  const sortedScores = [...scores].sort((a, b) => a.total - b.total);
  const totalAllScores = sortedScores.reduce((sum, score) => sum + score.total, 0);
  sortedScores.forEach((score) => {
    score.grossAmount = Math.round((totalAllScores - score.total * numPlayers) * pointValue);
    if (score.grossAmount > 0) { score.gstPaid = Math.round((score.grossAmount * gstPercent) / 100); score.netAmount = score.grossAmount - score.gstPaid; }
    else { score.gstPaid = 0; score.netAmount = score.grossAmount; }
  });
  let message = `🏆 *FINAL LEADERBOARD* 🏆\n\n`;
  message += `Game ID: ${gameId}\n`;
  message += `Point Value: ₹${pointValue}\n`;
  message += `GST: ${gstPercent}%\n\n`;
  sortedScores.forEach((score, index) => {
    const playerName = score.randomNumber ? `${score.name} (#${score.randomNumber})` : score.name;
    let emoji = "";
    if (index === 0) emoji = "🥇"; else if (index === 1) emoji = "🥈"; else if (index === 2) emoji = "🥉"; else emoji = `${index + 1}.`;
    const amountText = score.netAmount > 0 ? `+₹${score.netAmount}` : `₹${score.netAmount}`;
    const amountColor = score.netAmount > 0 ? "🟢" : score.netAmount < 0 ? "🔴" : "⚪";
    message += `${emoji} ${playerName}\n   Score: ${score.total}\n   ${amountColor} ${amountText}\n\n`;
  });
  const totalGstCollected = sortedScores.reduce((sum, score) => sum + score.gstPaid, 0);
  message += `💰 Total GST Collected: ₹${totalGstCollected}\n\n`;
  message += `🎉 Thanks for playing! 🎉`;
  return message;
}

function postRoundResultsToWhatsApp() {
  const message = formatRoundResultsForWhatsApp();
  if (message === "No rounds completed yet. Complete a round to share results!") { showToast("⚠️ No rounds completed yet. Complete a round to share results!", "warning", 3000); return; }
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
  showToast("📱 Opening WhatsApp with last completed round results. Select your GST group and click 'Send'!", "success", 4000);
}

function postLeaderboardToWhatsApp() {
  const message = formatLeaderboardForWhatsApp();
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
  showToast("📱 Opening WhatsApp with leaderboard. Select your GST group and click 'Send'!", "success", 4000);
}

// Expose functions to window for inline HTML event handlers
window.startNewGame = startNewGame;
window.loadFromCloud = loadFromCloud;
window.switchCamera = switchCamera;
window.manualEntry = manualEntry;
window.closeQRScanner = closeQRScanner;
window.postRoundResultsToWhatsApp = postRoundResultsToWhatsApp;
window.postLeaderboardToWhatsApp = postLeaderboardToWhatsApp;
window.confirmCloseGame = confirmCloseGame;
window.deletePlayer = deletePlayer;
window.addPlayer = addPlayer;
window.copyGameId = copyGameId;

