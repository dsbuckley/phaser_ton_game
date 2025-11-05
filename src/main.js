import Phaser from 'phaser';
import LoadingScene from './scenes/LoadingScene.js';
import MainScene from './scenes/MainScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  scale: {
    mode: Phaser.Scale.FIT,  // Changed from RESIZE to FIT to maintain aspect
    autoCenter: Phaser.Scale.CENTER_BOTH,  // Center the game
    orientation: Phaser.Scale.Orientation.PORTRAIT  // Lock to portrait aspect
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
  scene: [LoadingScene, MainScene],
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
});

export default game;
