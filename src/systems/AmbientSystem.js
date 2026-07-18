// Ambient background system: chest/palm animation registrations, sun,
// parallax clouds, and sparkles. Pure decoration — touches no game state.
export default class AmbientSystem {
  constructor(scene) {
    this.scene = scene;
    this.sun = null;
    this.activeClouds = [];
    this.cloudLayers = [];
    this.cloudTimer = null;
    this.activeSparkles = [];
    this.sparkleTimer = null;
  }

  createChestAnimation() {
    // Build frame array for animation (frames 1, 3, 5, ... 37)
    const frames = [];
    for (let i = 1; i <= 38; i += 2) {
      const frameNum = String(i).padStart(4, '0');
      frames.push({ key: `chest_${frameNum}` });
    }

    // Create opening animation
    this.scene.anims.create({
      key: 'chest_open',
      frames: frames,
      frameRate: 38, // 19 frames at 38fps = ~0.5 seconds
      repeat: 0 // Play once
    });

    // Create closing animation (reverse order)
    this.scene.anims.create({
      key: 'chest_close',
      frames: frames.slice().reverse(),
      frameRate: 38,
      repeat: 0
    });
  }

  createPalmTreeAnimation() {
    // Build frame array for animation (first 75 frames)
    const frames = [];
    for (let i = 1; i <= 75; i++) {
      const frameNum = String(i).padStart(3, '0');
      frames.push({ key: `palm_${frameNum}` });
    }

    // Create swaying animation (plays slowly, forward then reverse, loops continuously)
    this.scene.anims.create({
      key: 'palm_tree_sway',
      frames: frames,
      frameRate: 15, // 75 frames at 30fps = 2.5 seconds per loop (smooth motion)
      repeat: -1, // Loop forever
      yoyo: true // Play forward then reverse for smooth back-and-forth motion
    });
  }

  createSun() {
    // Position sun in upper left where the background sun is
    const sunX = 30;
    const sunY = 230;

    // Create sun sprite
    this.sun = this.scene.add.image(sunX, sunY, 'sun');
    this.sun.setScale(0.4); // Scale to appropriate size
    this.sun.setDepth(10); // In front of clouds (-50 to -30) and sparkles (0)

    // Pulsating animation (scale up and down)
    this.scene.tweens.add({
      targets: this.sun,
      scaleX: 0.45,
      scaleY: 0.45,
      duration: 2000, // Slower: 3 seconds per pulse (was 2 seconds)
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1 // Loop forever
    });

    // Rotation animation (slow gentle rotation)
    this.scene.tweens.add({
      targets: this.sun,
      angle: 360,
      duration: 60000, // Slower: 120 seconds (2 minutes) for full rotation (was 60 seconds)
      ease: 'Linear',
      repeat: -1 // Loop forever
    });
  }

  createClouds() {
    // Track active clouds
    this.activeClouds = [];

    // Define three depth layers for parallax effect
    // Apply yOffset to move clouds up 30px in compact mode
    this.cloudLayers = [
      {
        depth: -50, // Behind everything (far)
        scale: { min: 0.15, max: 0.25 },
        alpha: 0.5, // More transparent (far away)
        speed: { min: 8, max: 12 }, // Very slow (far away)
        yPosition: { min: 50, max: 180 } // Expanded range - higher and lower
      },
      {
        depth: -40, // Middle distance
        scale: { min: 0.25, max: 0.35 },
        alpha: 0.65, // Medium transparency
        speed: { min: 12, max: 18 }, // Slow
        yPosition: { min: 80, max: 220 } // Expanded range
      },
      {
        depth: -30, // Closer
        scale: { min: 0.35, max: 0.5 },
        alpha: 0.8, // Less transparent
        speed: { min: 18, max: 25 }, // Moderate speed
        yPosition: { min: 100, max: 280 } // Expanded range
      }
    ];

    // Spawn initial clouds immediately across the screen (visible on load)
    this.spawnInitialClouds();

    // Create continuous spawning timer
    this.cloudTimer = this.scene.time.addEvent({
      delay: 8000, // New cloud every 8 seconds (much slower spawning)
      callback: () => {
        // Only spawn if we have fewer than 5 clouds active
        if (this.activeClouds.length < 5) {
          this.createSingleCloud();
        }
      },
      loop: true
    });
  }

  spawnInitialClouds() {
    // Spawn 4-5 clouds immediately at random positions across the screen
    const screenWidth = this.scene.cameras.main.width;
    const numClouds = Phaser.Math.Between(4, 5);

    for (let i = 0; i < numClouds; i++) {
      // Random X position across the entire screen width
      const startX = Phaser.Math.Between(0, screenWidth);

      // Create cloud at random screen position (not off-screen)
      this.createSingleCloud(startX);
    }
  }

  createSingleCloud(startX = null) {
    const screenWidth = this.scene.cameras.main.width;

    // Choose random cloud image (1, 2, or 3)
    const cloudType = Phaser.Math.Between(1, 3);
    const cloudKey = `cloud${cloudType}`;

    // Choose random layer for parallax effect
    const layer = Phaser.Utils.Array.GetRandom(this.cloudLayers);

    // Random scale within layer range
    const scale = Phaser.Math.FloatBetween(layer.scale.min, layer.scale.max);

    // Random Y position within layer range
    const y = Phaser.Math.Between(layer.yPosition.min, layer.yPosition.max);

    // If startX not provided, start off-screen to the left
    if (startX === null) {
      startX = -200;
    }

    // Create cloud sprite
    const cloud = this.scene.add.image(startX, y, cloudKey);
    cloud.setScale(scale);
    cloud.setAlpha(layer.alpha);
    cloud.setDepth(layer.depth); // Set depth for proper layering

    // Add to active clouds array
    this.activeClouds.push(cloud);

    // Random speed within layer range
    const speed = Phaser.Math.Between(layer.speed.min, layer.speed.max);
    const duration = ((screenWidth + 400) / speed) * 1000; // Duration based on speed

    // Animate cloud moving from left to right
    this.scene.tweens.add({
      targets: cloud,
      x: screenWidth + 200, // Move off-screen to the right
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        // Remove from active clouds and destroy
        const index = this.activeClouds.indexOf(cloud);
        if (index > -1) {
          this.activeClouds.splice(index, 1);
        }
        cloud.destroy();
      }
    });
  }

  createSparkles() {
    // Sun is in the upper-left area of the background
    // Position sparkles below and to the right of the sun
    const sunX = 80; // Approximate sun position from the background
    const sunY = 280;

    // Define the area where sparkles can appear
    const sparkleAreaX = sunX + 50; // To the right of sun
    const sparkleAreaY = sunY + 50; // Below the sun
    const areaWidth = 200; // Spread area width
    const areaHeight = 150; // Spread area height

    // Track active sparkles
    this.activeSparkles = [];

    // Create sparkles continuously
    this.sparkleTimer = this.scene.time.addEvent({
      delay: 800, // Create a new sparkle every 0.8 seconds
      callback: () => {
        // Only create new sparkle if we have less than 6 active
        if (this.activeSparkles.length < 6) {
          this.createSingleSparkle(sparkleAreaX, sparkleAreaY, areaWidth, areaHeight);
        }
      },
      loop: true
    });
  }

  createSingleSparkle(baseX, baseY, areaWidth, areaHeight) {
    // Random position within the defined area
    const x = baseX + Phaser.Math.Between(-areaWidth / 2, areaWidth / 2);
    const y = baseY + Phaser.Math.Between(-areaHeight / 2, areaHeight / 2);

    // Random scale (256px image scaled down to 10-30px)
    const randomScale = Phaser.Math.FloatBetween(0.04, 0.12); // 10-30px from 256px

    // Create sparkle sprite
    const sparkle = this.scene.add.image(x, y, 'sparkle');
    sparkle.setScale(randomScale);
    sparkle.setAlpha(0); // Start invisible
    sparkle.setDepth(5); // Behind sun (10) but in front of clouds

    // Add to active sparkles array
    this.activeSparkles.push(sparkle);

    // Fade in, sparkle (scale pulse), fade out, then remove
    this.scene.tweens.add({
      targets: sparkle,
      alpha: 1,
      duration: 500,
      ease: 'Sine.easeIn',
      onComplete: () => {
        // Sparkle effect: pulse the scale
        this.scene.tweens.add({
          targets: sparkle,
          scaleX: randomScale * 1.3,
          scaleY: randomScale * 1.3,
          duration: 400,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: 1, // Pulse twice (once forward, once back)
          onComplete: () => {
            // Fade out
            this.scene.tweens.add({
              targets: sparkle,
              alpha: 0,
              duration: 600,
              ease: 'Sine.easeOut',
              onComplete: () => {
                // Remove from active sparkles and destroy
                const index = this.activeSparkles.indexOf(sparkle);
                if (index > -1) {
                  this.activeSparkles.splice(index, 1);
                }
                sparkle.destroy();
              }
            });
          }
        });
      }
    });
  }

  destroy() {
    if (this.cloudTimer) {
      this.cloudTimer.remove();
      this.cloudTimer = null;
    }
    if (this.sparkleTimer) {
      this.sparkleTimer.remove();
      this.sparkleTimer = null;
    }
  }
}
