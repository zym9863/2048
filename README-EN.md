**English** · [中文](README.md)

# 2048 Game

A modern web implementation of the classic 2048 puzzle game.

## 🎮 Game Overview

2048 is a popular sliding-tile puzzle where you combine tiles with the same numbers to reach the 2048 tile.

## ✨ Features

- **Classic gameplay** — Standard 4×4 grid with matching/merging tiles
- **Multiple controls** — Keyboard arrows and touch swipes supported
- **Scoring** — Live score and best score saved locally
- **Undo** — Revert the previous move
- **Theme switch** — Soft and Contrast themes
- **Sound effects** — Toggleable audio
- **Smooth animations** — Tile movement and merge animations
- **Responsive** — Works across screen sizes

## 🎯 Rules

1. Use the arrow keys (↑↓←→) or swipe to move all tiles
2. Tiles with the same number merge into one larger tile when they collide
3. A new tile (2 or 4) appears after each move
4. The goal is to create the 2048 tile
5. The game ends when no moves remain

## 🚀 Quick Start

### Play in the browser

Open `index.html` in your browser to start the game.

### Run locally

```bash
# Clone the repo
git clone https://github.com/zym9863/2048.git

# Enter the folder
cd 2048

# Open in your browser
open index.html
```

## 📁 Project Structure

```
2048/
├── index.html    # Main page
├── style.css     # Styles
├── script.js     # Game logic
└── README.md     # Project README (Chinese)
```

## 🛠️ Tech Stack

- **HTML5** — Structure
- **CSS3** — Styling & animations
- **JavaScript** — Game logic (vanilla JS)
- **Web Audio API** — Sound
- **LocalStorage** — Persistence

## 🎨 Theme Preview

- **Soft (default)** — Soft neumorphic look for comfortable play
- **Contrast** — High-contrast option for clarity

## 📱 Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Move tiles | Arrow keys ↑↓←→ | Swipe |
| New game | Click "New Game" | Same |
| Undo | Click "Undo" | Same |
| Switch theme | Click "Theme" | Same |
| Toggle sound | Click "Sound" | Same |

## 💾 Data Storage

LocalStorage keys used:

- `game2048_best_score`
- `game2048_theme`
- `game2048_sound_enabled`

## 📄 License

MIT License

## 🙏 Acknowledgements

Original 2048 game by Gabriele Cirulli.
