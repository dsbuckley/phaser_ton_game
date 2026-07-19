import { scaleCoins } from '../config/levels.js';

// Auto-pop system: after catching an auto-pop drop, opens 10 chests
// automatically (energy-free) with a rainbow countdown display. The
// scene-wide isAutoPopping flag stays on the scene — it gates openChest.
export default class AutoPopSystem {
  constructor(scene) {
    this.scene = scene;
    this.autoPopCountText = null; // Reference to countdown text
    this.autoPopPopsRemaining = 0; // Counter for remaining auto-pops (can stack)
    this.autoPopColorTimer = null;
    this.autoPopLight = null;
  }

  start() {
    // If already auto-popping, add 10 to the existing counter
    if (this.scene.isAutoPopping && this.autoPopCountText) {
      // Add 10 more pops to the queue
      if (!this.autoPopPopsRemaining) {
        this.autoPopPopsRemaining = 10;
      }
      this.autoPopPopsRemaining += 10;

      // Update the text immediately to show new total
      this.autoPopCountText.setText(`Auto Pop ${this.autoPopPopsRemaining}`);

      // Flash the text to indicate addition
      this.scene.tweens.add({
        targets: this.autoPopCountText,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 150,
        ease: 'Back.out',
        yoyo: true
      });

      return; // Don't start a new sequence
    }

    // Store original energy value to restore after sequence
    const originalEnergy = this.scene.batteryState.get();

    // Set flag to prevent manual chest clicks
    this.scene.isAutoPopping = true;

    // Disable chest interactivity
    this.scene.player.disableInteractive();

    // Create countdown text at top of screen
    const centerX = this.scene.cameras.main.width / 2;
    const topY = 75; // Closer to the top

    // Create spinning light in front of text
    this.autoPopLight = this.scene.add.image(centerX, topY, 'jackpot_light')
      .setOrigin(0.5)
      .setDepth(3001) // In front of text (3000)
      .setScale(1.0); // Full size

    // Rotating animation for light
    this.scene.tweens.add({
      targets: this.autoPopLight,
      angle: 360,
      duration: 2000, // 2 seconds per rotation
      ease: 'Linear',
      repeat: -1
    });

    this.autoPopCountText = this.scene.add.text(centerX, topY, 'Auto Pop 10', {
      fontFamily: 'Tilt Warp',
      fontSize: '32px', // Smaller font size
      fill: '#FF0000', // Start with red (will cycle through rainbow)
      stroke: '#000000',
      strokeThickness: 4,
      padding: { x: 20, y: 20 },
      resolution: 2
    }).setOrigin(0.5).setDepth(3000); // Above everything

    // Rainbow color animation (ROYGBIV)
    const rainbowColors = [
      '#FF0000', // Red
      '#FF7F00', // Orange
      '#FFFF00', // Yellow
      '#00FF00', // Green
      '#0000FF', // Blue
      '#4B0082', // Indigo
      '#9400D3'  // Violet
    ];

    // Create color cycling timeline
    let colorIndex = 0;
    this.autoPopColorTimer = this.scene.time.addEvent({
      delay: 150, // Change color every 150ms
      callback: () => {
        if (this.autoPopCountText && this.autoPopCountText.active) {
          colorIndex = (colorIndex + 1) % rainbowColors.length;
          this.autoPopCountText.setColor(rainbowColors[colorIndex]);
        }
      },
      loop: true
    });

    // Pulsing animation for countdown text (subtle now)
    this.scene.tweens.add({
      targets: this.autoPopCountText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 300,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    // Auto-pop loop: starts at 10, but can increase if more Auto Pops are clicked
    this.autoPopPopsRemaining = 10;

    const autoPopTimer = this.scene.time.addEvent({
      delay: 300, // 300ms between each pop
      callback: () => {
        // Update countdown text
        this.autoPopCountText.setText(`Auto Pop ${this.autoPopPopsRemaining}`);

        // Call openChest() but bypass energy consumption
        this.openChestAutoPop();

        this.autoPopPopsRemaining--;

        // Check if sequence complete
        if (this.autoPopPopsRemaining <= 0) {
          autoPopTimer.remove();

          // Wait 500ms before cleanup
          this.scene.time.delayedCall(500, () => {
            // Restore energy (no net consumption during auto-pop)
            this.scene.batteryState.set(originalEnergy);
            this.scene.statusBar.setResource('energy', originalEnergy, true);

            // Stop rainbow color timer
            if (this.autoPopColorTimer) {
              this.autoPopColorTimer.remove();
              this.autoPopColorTimer = null;
            }

            // Fade out and remove countdown text and light
            this.scene.tweens.add({
              targets: [this.autoPopCountText, this.autoPopLight],
              alpha: 0,
              duration: 300,
              onComplete: () => {
                this.autoPopCountText.destroy();
                this.autoPopCountText = null;

                if (this.autoPopLight) {
                  this.autoPopLight.destroy();
                  this.autoPopLight = null;
                }
              }
            });

            // Re-enable chest clicking
            this.scene.isAutoPopping = false;
            this.autoPopPopsRemaining = 0;
            this.scene.player.setInteractive({ useHandCursor: true });
          });
        }
      },
      loop: true
    });
  }

  openChestAutoPop() {
    // This is a modified version of openChest() that:
    // 1. Does NOT consume energy
    // 2. CAN spawn emerald, energy, and Auto Pop rewards (same as normal gameplay)

    // Record click time for battery regeneration logic
    this.scene.lastClickTime = this.scene.time.now;

    // Slide UI out (same as normal)
    this.scene.uiSlide.slideOut();

    // Trigger haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    // NOTE: Energy is NOT consumed here (skip energy decrease)

    // Increment total chests opened counter (for stats tracking)
    const chestsOpened = this.scene.totalChestsOpenedState.get();
    this.scene.totalChestsOpenedState.set(chestsOpened + 1);

    // Record deltas: auto-pop chests are free (no energy) — the server
    // validates them against collected auto-pops (10 opens each)
    this.scene.syncBuffer.chests_opened++;
    this.scene.syncBuffer.auto_pop_chests++;
    this.scene.syncBuffer.xp_earned++;
    this.scene.gainXp(1);

    // Determine payout size (same probability as normal, level-scaled)
    const rand = Math.random();
    const playerLevel = this.scene.userLevelState.get();
    let coinReward, isBigPayout = false;

    // NOTE: Mega jackpot disabled during auto-pop (too disruptive)
    if (rand < 0.10) {
      // 10% big payout
      isBigPayout = true;
      coinReward = scaleCoins(Phaser.Utils.Array.GetRandom([75, 100, 125, 150]), playerLevel);
    } else {
      // 90% normal payout
      coinReward = scaleCoins(Phaser.Math.Between(3, 49), playerLevel);
    }

    // Determine if emerald reward should spawn (10% chance)
    const isEmeraldReward = Math.random() < 0.1;

    // Determine if energy reward should spawn (25% chance)
    const isEnergyReward = Math.random() < 0.25;

    // Auto Pop rewards do NOT spawn during auto-pop sequences (prevents chaos)
    const isAutoPopReward = false;

    // Play chest sound
    this.scene.sound.play(isBigPayout ? 'chest_sound_big' : 'chest_sound');

    // Play chest opening animation
    this.scene.player.play('chest_open', true);

    // Trigger reward after 300ms delay
    this.scene.time.delayedCall(300, () => {
      // Always spawn coin confetti
      this.scene.rewards.createCoinConfetti(coinReward, isBigPayout);

      // 10% chance: ALSO spawn emerald
      if (isEmeraldReward) {
        this.scene.rewards.createEmeraldReward();
      }

      // 25% chance: ALSO spawn energy (1-3 items randomly)
      if (isEnergyReward) {
        const energyCount = Phaser.Math.Between(1, 3);
        for (let i = 0; i < energyCount; i++) {
          // Stagger spawns slightly for better visual effect
          this.scene.time.delayedCall(i * 50, () => {
            this.scene.rewards.createEnergyReward();
          });
        }
      }

      // 50% chance: ALSO spawn Auto Pop item
      if (isAutoPopReward) {
        this.scene.rewards.createAutoPopReward();
      }

      // Start monitoring for UI slide back
      this.scene.uiSlide.startSlideBackMonitoring();
    });

    // Play closing animation
    this.scene.time.delayedCall(500, () => {
      this.scene.player.play('chest_close', true);
    });

    // Deltas are picked up by the 10-second sync loop
  }

  destroy() {
    if (this.autoPopColorTimer) {
      this.autoPopColorTimer.remove();
      this.autoPopColorTimer = null;
    }
    if (this.autoPopCountText) {
      this.autoPopCountText.destroy();
      this.autoPopCountText = null;
    }
    if (this.autoPopLight) {
      this.autoPopLight.destroy();
      this.autoPopLight = null;
    }
    this.scene.isAutoPopping = false;
  }
}
