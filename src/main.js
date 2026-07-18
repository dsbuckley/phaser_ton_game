import Phaser from 'phaser';
import LoadingScene from './scenes/LoadingScene.js';
import MainScene from './scenes/MainScene.js';
import WheelScene from './scenes/WheelScene.js';
import StickersScene from './scenes/StickersScene.js';
import EarnScene from './scenes/EarnScene.js';
import ShopScene from './scenes/ShopScene.js';

// Get portrait dimensions even if device starts in landscape
const portraitWidth = window.innerWidth > window.innerHeight ? window.innerHeight : window.innerWidth;
const portraitHeight = window.innerWidth > window.innerHeight ? window.innerWidth : window.innerHeight;

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: portraitWidth,
  height: portraitHeight,
  scale: {
    mode: Phaser.Scale.NONE,  // No auto-resize - locked to portrait
    autoCenter: Phaser.Scale.CENTER_BOTH  // Center on screen
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  input: {
    activePointers: 1,
    touch: true,
    mouse: true
  },
  scene: [LoadingScene, MainScene, WheelScene, StickersScene, EarnScene, ShopScene],
  backgroundColor: '#1a1a2e'
};

// Initialize Telegram WebApp
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();

  // Request fullscreen mode for all launch contexts (Telegram WebApp v8.0+)
  // if (window.Telegram.WebApp.requestFullscreen) {
  //   window.Telegram.WebApp.requestFullscreen();
  // }
}

// Wait for fonts to load before starting the game
let game;
document.fonts.ready.then(() => {
  console.log('Fonts ready, starting game');
  game = new Phaser.Game(config);
  window.__game = game; // debug handle (harmless in production)
});

export default game;
