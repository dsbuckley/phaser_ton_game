# Assets Directory

Place your game assets here.

## Required Assets

- **player.png** - Player sprite image (recommended size: 64x64 or 128x128 pixels)

## Adding Assets

1. Add image files to this directory
2. Reference them in your game code using `/assets/filename.png`
3. Load them in the `preload()` method of your scene

Example:
```javascript
this.load.image('player', '/assets/player.png');
```
