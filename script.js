(() => {
  "use strict";

  const BOARD_SIZE = 4;
  const ANIM_MS = 180;
  const STORAGE_KEYS = {
    best: "game2048_best_score",
    theme: "game2048_theme",
    sound: "game2048_sound_enabled"
  };

  const state = {
    board: createEmptyBoard(),
    score: 0,
    bestScore: 0,
    won: false,
    gameOver: false,
    theme: "neumorph",
    soundEnabled: true,
    previousState: null,
    overlay: null,
    isAnimating: false,
    lastSpawn: null,
    lastMergedKeys: new Set(),
    lastScoreDelta: 0
  };

  const dom = {
    board: document.getElementById("board"),
    grid: document.getElementById("grid"),
    tileLayer: document.getElementById("tile-layer"),
    fxLayer: document.getElementById("fx-layer"),
    score: document.getElementById("score"),
    bestScore: document.getElementById("best-score"),
    status: document.getElementById("status"),
    newGame: document.getElementById("new-game"),
    undo: document.getElementById("undo"),
    toggleTheme: document.getElementById("toggle-theme"),
    toggleSound: document.getElementById("toggle-sound"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlay-title"),
    overlayMessage: document.getElementById("overlay-message"),
    overlayContinue: document.getElementById("overlay-continue"),
    overlayRestart: document.getElementById("overlay-restart")
  };

  const scoreCard = dom.score.closest(".score-card");
  const bestCard = dom.bestScore.closest(".score-card");

  let audioCtx = null;
  let touchStart = null;
  let cellMetrics = [];

  init();

  function init() {
    buildGrid();
    loadPrefs();
    bindEvents();
    requestAnimationFrame(() => {
      recomputeCellMetrics();
      newGame();
    });
  }

  function buildGrid() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i += 1) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      fragment.appendChild(cell);
    }
    dom.grid.appendChild(fragment);
  }

  function bindEvents() {
    dom.newGame.addEventListener("click", newGame);
    dom.undo.addEventListener("click", undoMove);
    dom.toggleTheme.addEventListener("click", toggleTheme);
    dom.toggleSound.addEventListener("click", toggleSound);
    dom.overlayContinue.addEventListener("click", () => {
      state.overlay = null;
      renderOverlay();
      setStatus("Keep going.");
    });
    dom.overlayRestart.addEventListener("click", newGame);

    window.addEventListener("resize", () => {
      recomputeCellMetrics();
      renderBoard();
    });

    document.addEventListener("keydown", (event) => {
      const mapping = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right"
      };
      const direction = mapping[event.key];
      if (!direction) {
        return;
      }
      event.preventDefault();
      processMove(direction);
    });

    dom.board.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) {
          return;
        }
        const touch = event.touches[0];
        touchStart = { x: touch.clientX, y: touch.clientY };
      },
      { passive: true }
    );

    dom.board.addEventListener(
      "touchend",
      (event) => {
        if (!touchStart || event.changedTouches.length !== 1) {
          return;
        }
        const touch = event.changedTouches[0];
        const dx = touch.clientX - touchStart.x;
        const dy = touch.clientY - touchStart.y;
        touchStart = null;

        const threshold = 28;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) {
          return;
        }
        if (Math.abs(dx) > Math.abs(dy)) {
          processMove(dx > 0 ? "right" : "left");
        } else {
          processMove(dy > 0 ? "down" : "up");
        }
      },
      { passive: true }
    );
  }

  function newGame() {
    state.board = createEmptyBoard();
    state.score = 0;
    state.won = false;
    state.gameOver = false;
    state.overlay = null;
    state.previousState = null;
    state.lastSpawn = null;
    state.lastMergedKeys = new Set();
    state.lastScoreDelta = 0;
    state.isAnimating = false;
    dom.fxLayer.innerHTML = "";

    addRandomTile(state.board);
    addRandomTile(state.board);

    renderAll();
    setStatus("Use arrow keys or swipe to play.");
  }

  function undoMove() {
    if (!state.previousState || state.isAnimating) {
      return;
    }
    const snapshot = state.previousState;
    state.board = cloneBoard(snapshot.board);
    state.score = snapshot.score;
    state.won = snapshot.won;
    state.gameOver = snapshot.gameOver;
    state.overlay = null;
    state.previousState = null;
    state.lastSpawn = null;
    state.lastMergedKeys = new Set();
    state.lastScoreDelta = 0;
    renderAll();
    setStatus("Undid last move.");
  }

  function processMove(direction) {
    if (state.isAnimating || state.overlay === "lose" || state.overlay === "win") {
      return;
    }

    const result = computeMove(state.board, direction);
    if (!result.moved) {
      setStatus("No tiles moved.");
      return;
    }

    state.previousState = {
      board: cloneBoard(state.board),
      score: state.score,
      won: state.won,
      gameOver: state.gameOver
    };

    state.score += result.scoreDelta;
    if (state.score > state.bestScore) {
      state.bestScore = state.score;
      persistBestScore();
      bestCard.classList.add("bump");
      setTimeout(() => bestCard.classList.remove("bump"), 280);
    }

    const finalBoard = cloneBoard(result.board);
    const spawn = addRandomTile(finalBoard);

    state.isAnimating = true;
    state.lastScoreDelta = result.scoreDelta;

    if (result.scoreDelta > 0) {
      scoreCard.classList.add("bump");
      setTimeout(() => scoreCard.classList.remove("bump"), 280);
    }

    if (result.merges.length > 0) {
      playMergeSound();
    } else {
      playMoveSound();
    }

    renderHud();
    animateMove(state.board, result.moves, result.merges);

    setTimeout(() => {
      state.board = finalBoard;
      state.lastSpawn = spawn;
      state.lastMergedKeys = new Set(result.merges.map((merge) => posKey(merge.to.r, merge.to.c)));
      state.isAnimating = false;
      state.lastScoreDelta = 0;

      if (!state.won && hasValue(state.board, 2048)) {
        state.won = true;
        state.overlay = "win";
        playWinSound();
      }

      if (!canMove(state.board)) {
        state.gameOver = true;
        state.overlay = "lose";
        playLoseSound();
      }

      renderAll();
      if (state.overlay === "win") {
        setStatus("You reached 2048.");
      } else if (state.overlay === "lose") {
        setStatus("No more valid moves.");
      } else {
        setStatus("Move complete.");
      }
    }, ANIM_MS + 20);
  }

  function animateMove(baseBoard, moves, merges) {
    const movingSources = new Set();
    for (const move of moves) {
      movingSources.add(posKey(move.from.r, move.from.c));
    }
    for (const merge of merges) {
      movingSources.add(posKey(merge.from1.r, merge.from1.c));
      movingSources.add(posKey(merge.from2.r, merge.from2.c));
    }

    const boardForAnimation = cloneBoard(baseBoard);
    movingSources.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      boardForAnimation[r][c] = 0;
    });

    dom.fxLayer.innerHTML = "";
    renderBoard(boardForAnimation, { suppressEffects: true });

    const animationTiles = [];
    for (const move of moves) {
      animationTiles.push({
        from: move.from,
        to: move.to,
        value: move.value
      });
    }
    for (const merge of merges) {
      animationTiles.push(
        { from: merge.from1, to: merge.to, value: merge.value / 2 },
        { from: merge.from2, to: merge.to, value: merge.value / 2 }
      );
    }

    const fxFragment = document.createDocumentFragment();
    for (const item of animationTiles) {
      const fromPos = getTilePosition(item.from.r, item.from.c);
      const toPos = getTilePosition(item.to.r, item.to.c);
      const tile = buildTileNode(item.value, fromPos.x, fromPos.y, ["moving"], true);
      tile.dataset.toX = String(toPos.x);
      tile.dataset.toY = String(toPos.y);
      fxFragment.appendChild(tile);
    }
    dom.fxLayer.appendChild(fxFragment);

    requestAnimationFrame(() => {
      const nodes = dom.fxLayer.querySelectorAll(".tile.moving");
      nodes.forEach((node) => {
        const x = Number(node.dataset.toX);
        const y = Number(node.dataset.toY);
        node.style.transform = `translate(${x}px, ${y}px)`;
      });
    });

    setTimeout(() => {
      dom.fxLayer.innerHTML = "";
    }, ANIM_MS + 10);
  }

  function computeMove(board, direction) {
    const nextBoard = createEmptyBoard();
    const moves = [];
    const merges = [];
    let scoreDelta = 0;
    let changed = false;

    for (let lineIndex = 0; lineIndex < BOARD_SIZE; lineIndex += 1) {
      const cells = getLineCells(board, direction, lineIndex);
      const nonZero = cells.filter((cell) => cell.value !== 0);
      const placed = [];

      for (let i = 0; i < nonZero.length; i += 1) {
        if (i + 1 < nonZero.length && nonZero[i].value === nonZero[i + 1].value) {
          const mergedValue = nonZero[i].value * 2;
          placed.push({
            value: mergedValue,
            sources: [nonZero[i], nonZero[i + 1]]
          });
          scoreDelta += mergedValue;
          i += 1;
        } else {
          placed.push({
            value: nonZero[i].value,
            sources: [nonZero[i]]
          });
        }
      }

      for (let i = 0; i < BOARD_SIZE; i += 1) {
        const dest = cells[i];
        const placement = placed[i];
        const value = placement ? placement.value : 0;
        nextBoard[dest.r][dest.c] = value;

        if (board[dest.r][dest.c] !== value) {
          changed = true;
        }

        if (!placement) {
          continue;
        }

        if (placement.sources.length === 1) {
          const src = placement.sources[0];
          if (src.r !== dest.r || src.c !== dest.c) {
            moves.push({
              from: { r: src.r, c: src.c },
              to: { r: dest.r, c: dest.c },
              value: placement.value
            });
          }
        } else {
          merges.push({
            from1: { r: placement.sources[0].r, c: placement.sources[0].c },
            from2: { r: placement.sources[1].r, c: placement.sources[1].c },
            to: { r: dest.r, c: dest.c },
            value: placement.value
          });
        }
      }
    }

    return {
      board: nextBoard,
      moved: changed,
      scoreDelta,
      moves,
      merges
    };
  }

  function getLineCells(board, direction, index) {
    const cells = [];
    if (direction === "left") {
      for (let c = 0; c < BOARD_SIZE; c += 1) {
        cells.push({ r: index, c, value: board[index][c] });
      }
      return cells;
    }
    if (direction === "right") {
      for (let c = BOARD_SIZE - 1; c >= 0; c -= 1) {
        cells.push({ r: index, c, value: board[index][c] });
      }
      return cells;
    }
    if (direction === "up") {
      for (let r = 0; r < BOARD_SIZE; r += 1) {
        cells.push({ r, c: index, value: board[r][index] });
      }
      return cells;
    }
    for (let r = BOARD_SIZE - 1; r >= 0; r -= 1) {
      cells.push({ r, c: index, value: board[r][index] });
    }
    return cells;
  }

  function canMove(board) {
    for (let r = 0; r < BOARD_SIZE; r += 1) {
      for (let c = 0; c < BOARD_SIZE; c += 1) {
        if (board[r][c] === 0) {
          return true;
        }
        if (c + 1 < BOARD_SIZE && board[r][c] === board[r][c + 1]) {
          return true;
        }
        if (r + 1 < BOARD_SIZE && board[r][c] === board[r + 1][c]) {
          return true;
        }
      }
    }
    return false;
  }

  function hasValue(board, value) {
    for (let r = 0; r < BOARD_SIZE; r += 1) {
      for (let c = 0; c < BOARD_SIZE; c += 1) {
        if (board[r][c] === value) {
          return true;
        }
      }
    }
    return false;
  }

  function addRandomTile(board) {
    const empties = [];
    for (let r = 0; r < BOARD_SIZE; r += 1) {
      for (let c = 0; c < BOARD_SIZE; c += 1) {
        if (board[r][c] === 0) {
          empties.push({ r, c });
        }
      }
    }
    if (empties.length === 0) {
      return null;
    }
    const pick = empties[Math.floor(Math.random() * empties.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    board[pick.r][pick.c] = value;
    return { r: pick.r, c: pick.c, value };
  }

  function renderAll() {
    renderHud();
    renderBoard();
    renderOverlay();
  }

  function renderHud() {
    dom.score.textContent = String(state.score);
    dom.bestScore.textContent = String(state.bestScore);
    dom.undo.disabled = !state.previousState || state.isAnimating;
    dom.toggleTheme.textContent = state.theme === "neumorph" ? "Theme: Soft" : "Theme: Contrast";
    dom.toggleTheme.setAttribute("aria-pressed", state.theme === "contrast" ? "true" : "false");
    dom.toggleSound.textContent = state.soundEnabled ? "Sound: On" : "Sound: Off";
    dom.toggleSound.setAttribute("aria-pressed", state.soundEnabled ? "true" : "false");
  }

  function renderBoard(board = state.board, options = {}) {
    if (cellMetrics.length !== BOARD_SIZE * BOARD_SIZE) {
      recomputeCellMetrics();
    }

    const suppressEffects = options.suppressEffects === true;
    const spawnKey = state.lastSpawn ? posKey(state.lastSpawn.r, state.lastSpawn.c) : null;
    const merged = state.lastMergedKeys;
    const fragment = document.createDocumentFragment();

    for (let r = 0; r < BOARD_SIZE; r += 1) {
      for (let c = 0; c < BOARD_SIZE; c += 1) {
        const value = board[r][c];
        if (value === 0) {
          continue;
        }
        const key = posKey(r, c);
        const classes = [];
        if (!suppressEffects && spawnKey === key) {
          classes.push("tile-spawn");
        }
        if (!suppressEffects && merged.has(key)) {
          classes.push("tile-merge");
        }
        const pos = getTilePosition(r, c);
        fragment.appendChild(buildTileNode(value, pos.x, pos.y, classes, false));
      }
    }

    dom.tileLayer.innerHTML = "";
    dom.tileLayer.appendChild(fragment);
  }

  function buildTileNode(value, x, y, extraClasses, isFx) {
    const tile = document.createElement("div");
    const colorClass = value > 2048 ? "value-super" : `value-${value}`;
    tile.className = `tile ${colorClass} ${extraClasses.join(" ")}`.trim();
    if (value >= 1024) {
      tile.classList.add("small-text");
    }
    if (isFx) {
      tile.style.zIndex = "8";
    }
    tile.textContent = String(value);
    tile.style.transform = `translate(${x}px, ${y}px)`;
    return tile;
  }

  function renderOverlay() {
    if (!state.overlay) {
      dom.overlay.classList.add("hidden");
      return;
    }
    if (state.overlay === "win") {
      dom.overlayTitle.textContent = "You made 2048!";
      dom.overlayMessage.textContent = "You can continue playing for a higher score.";
      dom.overlayContinue.hidden = false;
    } else {
      dom.overlayTitle.textContent = "Game over";
      dom.overlayMessage.textContent = "No valid moves left. Start a new game.";
      dom.overlayContinue.hidden = true;
    }
    dom.overlay.classList.remove("hidden");
  }

  function setStatus(message) {
    dom.status.textContent = message;
  }

  function toggleTheme() {
    state.theme = state.theme === "neumorph" ? "contrast" : "neumorph";
    applyTheme();
    persistTheme();
    recomputeCellMetrics();
    renderAll();
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    if (state.soundEnabled) {
      ensureAudioContext();
      playMoveSound();
    }
    persistSoundPreference();
    renderHud();
  }

  function applyTheme() {
    document.body.classList.remove("theme-neumorph", "theme-contrast");
    document.body.classList.add(`theme-${state.theme}`);
  }

  function loadPrefs() {
    const best = Number(window.localStorage.getItem(STORAGE_KEYS.best));
    if (Number.isFinite(best) && best >= 0) {
      state.bestScore = best;
    }

    const theme = window.localStorage.getItem(STORAGE_KEYS.theme);
    if (theme === "neumorph" || theme === "contrast") {
      state.theme = theme;
    }

    const sound = window.localStorage.getItem(STORAGE_KEYS.sound);
    state.soundEnabled = sound === "1";

    applyTheme();
    renderHud();
  }

  function persistBestScore() {
    window.localStorage.setItem(STORAGE_KEYS.best, String(state.bestScore));
  }

  function persistTheme() {
    window.localStorage.setItem(STORAGE_KEYS.theme, state.theme);
  }

  function persistSoundPreference() {
    window.localStorage.setItem(STORAGE_KEYS.sound, state.soundEnabled ? "1" : "0");
  }

  function ensureAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playMoveSound() {
    if (!state.soundEnabled) {
      return;
    }
    ensureAudioContext();
    tone(280, 0.08, "triangle", 0.15);
  }

  function playMergeSound() {
    if (!state.soundEnabled) {
      return;
    }
    ensureAudioContext();
    tone(320, 0.1, "triangle", 0.2);
    setTimeout(() => tone(470, 0.12, "triangle", 0.18), 50);
  }

  function playWinSound() {
    if (!state.soundEnabled) {
      return;
    }
    ensureAudioContext();
    [523, 659, 784, 1047].forEach((frequency, index) => {
      setTimeout(() => tone(frequency, 0.15, "sine", 0.25), index * 120);
    });
  }

  function playLoseSound() {
    if (!state.soundEnabled) {
      return;
    }
    ensureAudioContext();
    [392, 330, 262, 196].forEach((frequency, index) => {
      setTimeout(() => tone(frequency, 0.18, "sawtooth", 0.2), index * 130);
    });
  }

  function tone(freq, durationSec, type, gainValue) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.015);
  }

  function recomputeCellMetrics() {
    const boardRect = dom.board.getBoundingClientRect();
    const cells = dom.grid.querySelectorAll(".grid-cell");
    const next = [];
    cells.forEach((cell, index) => {
      const rect = cell.getBoundingClientRect();
      const row = Math.floor(index / BOARD_SIZE);
      const col = index % BOARD_SIZE;
      next.push({
        row,
        col,
        x: rect.left - boardRect.left,
        y: rect.top - boardRect.top
      });
    });
    cellMetrics = next;
  }

  function getTilePosition(row, col) {
    const metric = cellMetrics[row * BOARD_SIZE + col];
    if (!metric) {
      recomputeCellMetrics();
      return getTilePosition(row, col);
    }
    return { x: metric.x, y: metric.y };
  }

  function createEmptyBoard() {
    return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  }

  function cloneBoard(board) {
    return board.map((row) => row.slice());
  }

  function posKey(r, c) {
    return `${r},${c}`;
  }
})();
