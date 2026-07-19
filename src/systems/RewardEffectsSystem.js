// Reward effect system: coin confetti, catchable emerald/energy/auto-pop
// drops, and the mega jackpot coin stream. Writes reward deltas into the
// scene's game state + sync buffer as effects land.
export default class RewardEffectsSystem {
  constructor(scene) {
    this.scene = scene;
    this.activeConfettiSprites = new Set(); // Track active confetti sprites
  }

  createCoinConfetti(coinAmount, isBigPayout = false, skipTotalUpdate = false) {
    // Get chest position
    const chestX = this.scene.player.x;
    const chestY = this.scene.player.y;

    // Create exact number of coins matching the reward amount
    const coinCount = coinAmount;

    for (let i = 0; i < coinCount; i++) {
      // Create coin sprite
      const coin = this.scene.physics.add.sprite(chestX, chestY, 'statusbar_coin');

      // Track this sprite for UI slide-in monitoring
      this.activeConfettiSprites.add(coin);

      // Set depth in front of sun (10), sparkles (5), and chest (20)
      coin.setDepth(100);

      // Random scale for variety
      const scale = Phaser.Math.FloatBetween(0.3, 0.5);
      coin.setScale(scale);

      // Set random physics velocities for burst effect
      // Big payouts spread wider to prevent bunching
      const velocityX = isBigPayout
        ? Phaser.Math.Between(-350, 350) // Big payout: wider spread (700px range)
        : Phaser.Math.Between(-200, 200); // Normal: standard spread (400px range)
      // Random height variation for all coins
      const velocityY = isBigPayout
        ? Phaser.Math.Between(-400, -1000) // Big payout: random height (low to very high)
        : Phaser.Math.Between(-400, -1000); // Normal: same random range
      coin.setVelocity(velocityX, velocityY);

      // Apply gravity for realistic arc
      coin.setGravityY(900);

      // Random rotation for tumbling effect
      const angularVelocity = Phaser.Math.Between(-360, 360);
      coin.setAngularVelocity(angularVelocity);

      // Pop-in scale animation
      coin.setScale(0);
      this.scene.tweens.add({
        targets: coin,
        scaleX: scale,
        scaleY: scale,
        duration: 150,
        ease: 'Back.out',
        onComplete: () => {
          // Random zoom effect - 50% chance towards camera (bigger), 50% away (smaller)
          const zoomTowards = Math.random() < 0.5;
          const zoomMultiplier = zoomTowards
            ? Phaser.Math.FloatBetween(1.5, 3.0)  // Zoom in: 1.5x to 3.0x
            : Phaser.Math.FloatBetween(0.3, 0.6); // Zoom out: 0.3x to 0.6x

          // If zooming away (getting smaller), move behind chest (depth 15)
          // If zooming towards (getting bigger), stay in front (depth 100)
          if (!zoomTowards) {
            coin.setDepth(15); // Behind chest (20) but in front of sun (10) and sparkles (5)
          }

          this.scene.tweens.add({
            targets: coin,
            scaleX: scale * zoomMultiplier,
            scaleY: scale * zoomMultiplier,
            duration: 1000,
            ease: 'Power2.easeIn',
            delay: 200
          });
        }
      });

      // Destroy after falling off screen - big payouts stay longer
      const destroyDelay = isBigPayout ? 3000 : 2500; // Big payout: 3s total, Normal: 2.5s total
      this.scene.time.delayedCall(destroyDelay, () => {
        // Remove from tracking set before destroying
        this.activeConfettiSprites.delete(coin);
        coin.destroy();
      });
    }

    // Create floating "+X" text that rises and fades (skip for streaming mode)
    if (!skipTotalUpdate) {
      const floatingText = this.scene.add.text(chestX, chestY, `+${coinAmount}`, {
        fontFamily: 'Tilt Warp',
        fontSize: isBigPayout ? '72px' : '48px', // Larger for big payouts
        fill: isBigPayout ? '#FFD700' : '#FFFFFF', // Golden for big payouts, white for normal
        stroke: '#000000',
        strokeThickness: isBigPayout ? 8 : 6, // Thicker stroke for big payouts
        padding: { x: 20, y: 20 },
        resolution: 2
      }).setOrigin(0.5).setDepth(1200); // Same depth as mega jackpot text, in front of coins

      // Animate text floating upward and fading out
      // Big payouts go higher and stay longer
      this.scene.tweens.add({
        targets: floatingText,
        y: isBigPayout ? chestY - 450 : chestY - 250, // Big payouts float much higher
        alpha: 0, // Fade to transparent
        duration: isBigPayout ? 2000 : 1000, // Big payouts stay 2 seconds, normal 1 second
        ease: 'Sine.easeOut', // Smooth deceleration
        onComplete: () => floatingText.destroy()
      });
    }

    // Update total coins (skip for streaming mode - updated manually)
    if (!skipTotalUpdate) {
      const currentCoins = this.scene.coinsState.get();
      const newTotal = currentCoins + coinAmount;
      this.scene.coinsState.set(newTotal);
      this.scene.syncBuffer.coins_earned += coinAmount;

      // Update StatusBar with animation
      this.scene.statusBar.setResource('coins', newTotal, true);
    }
  }

  createEmeraldReward() {
    // Get chest position
    const chestX = this.scene.player.x;
    const chestY = this.scene.player.y;

    // Create single emerald sprite with physics
    const emerald = this.scene.physics.add.sprite(chestX, chestY, 'statusbar_gem');

    // Track this sprite for UI slide-in monitoring
    this.activeConfettiSprites.add(emerald);

    // Set depth in front of sun (10), sparkles (5), and chest (20)
    emerald.setDepth(100);

    // Larger scale for visibility (emerald is special/rare)
    const scale = 0.9;

    // Set upward physics velocity with random height variation
    const velocityX = Phaser.Math.Between(-200, 200); // Moderate horizontal drift
    const velocityY = Phaser.Math.Between(-400, -1000); // Random height: low to very high
    emerald.setVelocity(velocityX, velocityY);

    // Apply gravity for realistic arc
    emerald.setGravityY(900);

    // Gentle spin for visual interest
    emerald.setAngularVelocity(180);

    // Pop-in scale animation
    emerald.setScale(0);
    this.scene.tweens.add({
      targets: emerald,
      scaleX: scale,
      scaleY: scale,
      duration: 150,
      ease: 'Back.out',
      onComplete: () => {
        // Make it interactive AFTER pop-in completes, so hit area is based on actual size
        emerald.setInteractive({ useHandCursor: true });

        // Random zoom effect - 50% chance towards camera (bigger), 50% away (smaller)
        const zoomTowards = Math.random() < 0.5;
        const zoomMultiplier = zoomTowards
          ? Phaser.Math.FloatBetween(1.5, 3.0)  // Zoom in: 1.5x to 3.0x
          : Phaser.Math.FloatBetween(0.3, 0.6); // Zoom out: 0.3x to 0.6x

        // If zooming away (getting smaller), move behind chest (depth 15)
        // If zooming towards (getting bigger), stay in front (depth 100)
        if (!zoomTowards) {
          emerald.setDepth(15); // Behind chest (20) but in front of sun (10) and sparkles (5)
        }

        this.scene.tweens.add({
          targets: emerald,
          scaleX: scale * zoomMultiplier,
          scaleY: scale * zoomMultiplier,
          duration: 1000,
          ease: 'Power2.easeIn',
          delay: 200
        });
      }
    });

    // Click handler - collect emerald
    emerald.on('pointerdown', () => {
      // Prevent multiple clicks
      emerald.disableInteractive();

      // Unlock audio if needed
      if (!this.scene.audioUnlocked) {
        this.scene.sound.context.resume().then(() => {
          this.scene.audioUnlocked = true;
        }).catch(err => {
          console.warn('Failed to unlock audio:', err);
        });
      }

      // Track combo BEFORE applying rewards
      this.scene.combo.handleSpecialtyItemClick('gems', 1);

      // Play emerald collection sound
      this.scene.sound.play('emerald_sound');

      // Trigger success haptic feedback for specialty item collection
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }

      // Update gems state
      const currentGems = this.scene.gemsState.get();
      const newTotal = currentGems + 1;
      this.scene.gemsState.set(newTotal);
      this.scene.syncBuffer.gems_earned += 1;

      // Update StatusBar with animation
      this.scene.statusBar.setResource('gems', newTotal, true);

      // Create floating "+1 Emerald" text (bright green color)
      const floatingText = this.scene.add.text(chestX, chestY, '+1 Gem', {
        fontFamily: 'Tilt Warp',
        fontSize: '48px',
        fill: '#a1fe26', // Bright green for emerald
        stroke: '#000000',
        strokeThickness: 6,
        padding: { x: 20, y: 20 },
        resolution: 2
      }).setOrigin(0.5).setDepth(1200);

      // Animate text floating upward and fading out (big payout style)
      this.scene.tweens.add({
        targets: floatingText,
        y: chestY - 450, // Float much higher (same as big payout)
        alpha: 0,
        duration: 2000, // Stay 2 seconds (same as big payout)
        ease: 'Sine.easeOut',
        onComplete: () => floatingText.destroy()
      });

      // Bubble pop animation - scale up and fade out
      this.scene.tweens.add({
        targets: emerald,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        angle: emerald.angle + 180, // Add rotation for dynamics
        duration: 250,
        ease: 'Back.easeIn',
        onComplete: () => {
          // Remove from tracking set and destroy after animation
          this.activeConfettiSprites.delete(emerald);
          emerald.destroy();
        }
      });
    });

    // Pulsing warning fade before disappearing
    this.scene.time.delayedCall(2500, () => {
      // Only fade if emerald still exists (not clicked)
      if (emerald && emerald.active) {
        // Disable interactivity during fade warning
        emerald.disableInteractive();

        // Create pulsing fade effect - faster and faster
        // First pulse: 400ms
        this.scene.tweens.add({
          targets: emerald,
          alpha: 0.3,
          duration: 400,
          ease: 'Sine.easeInOut',
          yoyo: true,
          onComplete: () => {
            // Second pulse: 300ms (faster)
            this.scene.tweens.add({
              targets: emerald,
              alpha: 0.3,
              duration: 300,
              ease: 'Sine.easeInOut',
              yoyo: true,
              onComplete: () => {
                // Third pulse: 200ms (even faster)
                this.scene.tweens.add({
                  targets: emerald,
                  alpha: 0.3,
                  duration: 200,
                  ease: 'Sine.easeInOut',
                  yoyo: true,
                  onComplete: () => {
                    // Final fast fade out
                    this.scene.tweens.add({
                      targets: emerald,
                      alpha: 0,
                      duration: 200,
                      ease: 'Power2',
                      onComplete: () => {
                        // Remove from tracking set before destroying
                        this.activeConfettiSprites.delete(emerald);
                        emerald.destroy();
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  createEnergyReward() {
    // Get chest position
    const chestX = this.scene.player.x;
    const chestY = this.scene.player.y;

    // Create single energy sprite with physics
    const energy = this.scene.physics.add.sprite(chestX, chestY, 'statusbar_energy');

    // Track this sprite for UI slide-in monitoring
    this.activeConfettiSprites.add(energy);

    // Set depth in front of sun (10), sparkles (5), and chest (20)
    energy.setDepth(100);

    // Larger scale for visibility (same size as emerald)
    const scale = 0.9;

    // Set upward physics velocity with random height variation
    const velocityX = Phaser.Math.Between(-200, 200); // Moderate horizontal drift
    const velocityY = Phaser.Math.Between(-400, -1000); // Random height: low to very high
    energy.setVelocity(velocityX, velocityY);

    // Apply gravity for realistic arc
    energy.setGravityY(900);

    // Gentle spin for visual interest
    energy.setAngularVelocity(180);

    // Pop-in scale animation
    energy.setScale(0);
    this.scene.tweens.add({
      targets: energy,
      scaleX: scale,
      scaleY: scale,
      duration: 150,
      ease: 'Back.out',
      onComplete: () => {
        // Make it interactive AFTER pop-in completes, so hit area is based on actual size
        energy.setInteractive({ useHandCursor: true });

        // Random zoom effect - 50% chance towards camera (bigger), 50% away (smaller)
        const zoomTowards = Math.random() < 0.5;
        const zoomMultiplier = zoomTowards
          ? Phaser.Math.FloatBetween(1.5, 3.0)  // Zoom in: 1.5x to 3.0x
          : Phaser.Math.FloatBetween(0.3, 0.6); // Zoom out: 0.3x to 0.6x

        // If zooming away (getting smaller), move behind chest (depth 15)
        // If zooming towards (getting bigger), stay in front (depth 100)
        if (!zoomTowards) {
          energy.setDepth(15); // Behind chest (20) but in front of sun (10) and sparkles (5)
        }

        this.scene.tweens.add({
          targets: energy,
          scaleX: scale * zoomMultiplier,
          scaleY: scale * zoomMultiplier,
          duration: 1000,
          ease: 'Power2.easeIn',
          delay: 200
        });
      }
    });

    // Click handler - collect energy
    energy.on('pointerdown', () => {
      // Prevent multiple clicks
      energy.disableInteractive();

      // Unlock audio if needed
      if (!this.scene.audioUnlocked) {
        this.scene.sound.context.resume().then(() => {
          this.scene.audioUnlocked = true;
        }).catch(err => {
          console.warn('Failed to unlock audio:', err);
        });
      }

      // Track combo BEFORE applying rewards
      this.scene.combo.handleSpecialtyItemClick('energy', 1);

      // Play energy collection sound
      this.scene.sound.play('energy_collect_sound');

      // Trigger success haptic feedback for specialty item collection
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }

      // Update energy state (+1, no cap)
      const currentEnergy = this.scene.batteryState.get();
      const newTotal = currentEnergy + 1;
      this.scene.batteryState.set(newTotal);
      this.scene.syncBuffer.energy_collected += 1;

      // Update StatusBar energy display (even if over 100)
      this.scene.statusBar.setResource('energy', newTotal, true);

      // Update energy countdown timer visibility
      this.scene.updateEnergyTimerVisibility();

      // Update BatteryBar display (will show over 100) - only if it exists
      if (this.scene.batteryBar && this.scene.batteryBar.setBattery) {
        this.scene.batteryBar.setBattery(newTotal, 100, true);
      }

      // Create floating "+1 Energy" text (cyan color)
      const floatingText = this.scene.add.text(chestX, chestY, '+1 Energy', {
        fontFamily: 'Tilt Warp',
        fontSize: '48px',
        fill: '#4df0ff', // Cyan color for energy
        stroke: '#000000',
        strokeThickness: 6,
        padding: { x: 20, y: 20 },
        resolution: 2
      }).setOrigin(0.5).setDepth(1200);

      // Animate text floating upward and fading out (big payout style)
      this.scene.tweens.add({
        targets: floatingText,
        y: chestY - 450, // Float much higher (same as big payout)
        alpha: 0,
        duration: 2000, // Stay 2 seconds (same as big payout)
        ease: 'Sine.easeOut',
        onComplete: () => floatingText.destroy()
      });

      // Bubble pop animation - scale up and fade out
      this.scene.tweens.add({
        targets: energy,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        angle: energy.angle + 180, // Add rotation for dynamics
        duration: 250,
        ease: 'Back.easeIn',
        onComplete: () => {
          // Remove from tracking set and destroy after animation
          this.activeConfettiSprites.delete(energy);
          energy.destroy();
        }
      });
    });

    // Pulsing warning fade before disappearing
    this.scene.time.delayedCall(2500, () => {
      // Only fade if energy still exists (not clicked)
      if (energy && energy.active) {
        // Disable interactivity during fade warning
        energy.disableInteractive();

        // Create pulsing fade effect - faster and faster
        // First pulse: 400ms
        this.scene.tweens.add({
          targets: energy,
          alpha: 0.3,
          duration: 400,
          ease: 'Sine.easeInOut',
          yoyo: true,
          onComplete: () => {
            // Second pulse: 300ms (faster)
            this.scene.tweens.add({
              targets: energy,
              alpha: 0.3,
              duration: 300,
              ease: 'Sine.easeInOut',
              yoyo: true,
              onComplete: () => {
                // Third pulse: 200ms (even faster)
                this.scene.tweens.add({
                  targets: energy,
                  alpha: 0.3,
                  duration: 200,
                  ease: 'Sine.easeInOut',
                  yoyo: true,
                  onComplete: () => {
                    // Final fast fade out
                    this.scene.tweens.add({
                      targets: energy,
                      alpha: 0,
                      duration: 200,
                      ease: 'Power2',
                      onComplete: () => {
                        // Remove from tracking set before destroying
                        this.activeConfettiSprites.delete(energy);
                        energy.destroy();
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  createAutoPopReward() {
    // Get chest position
    const chestX = this.scene.player.x;
    const chestY = this.scene.player.y;

    // Create single Auto Pop sprite with physics
    const autoPop = this.scene.physics.add.sprite(chestX, chestY, 'autopop_icon');

    // Track this sprite for UI slide-in monitoring
    this.activeConfettiSprites.add(autoPop);

    // Set depth in front of sun (10), sparkles (5), and chest (20)
    autoPop.setDepth(100);

    // Larger scale for visibility (same size as emerald/energy)
    const scale = 0.9;

    // Set upward physics velocity with random height variation
    const velocityX = Phaser.Math.Between(-200, 200); // Moderate horizontal drift
    const velocityY = Phaser.Math.Between(-400, -1000); // Random height: low to very high
    autoPop.setVelocity(velocityX, velocityY);

    // Apply gravity for realistic arc
    autoPop.setGravityY(900);

    // Gentle spin for visual interest
    autoPop.setAngularVelocity(180);

    // Pop-in scale animation
    autoPop.setScale(0);
    this.scene.tweens.add({
      targets: autoPop,
      scaleX: scale,
      scaleY: scale,
      duration: 150,
      ease: 'Back.out',
      onComplete: () => {
        // Make it interactive AFTER pop-in completes
        autoPop.setInteractive({ useHandCursor: true });

        // Random zoom effect - 50% chance towards camera (bigger), 50% away (smaller)
        const zoomTowards = Math.random() < 0.5;
        const zoomMultiplier = zoomTowards
          ? Phaser.Math.FloatBetween(1.5, 3.0)  // Zoom in: 1.5x to 3.0x
          : Phaser.Math.FloatBetween(0.3, 0.6); // Zoom out: 0.3x to 0.6x

        // If zooming away (getting smaller), move behind chest (depth 15)
        if (!zoomTowards) {
          autoPop.setDepth(15);
        }

        this.scene.tweens.add({
          targets: autoPop,
          scaleX: scale * zoomMultiplier,
          scaleY: scale * zoomMultiplier,
          duration: 1000,
          ease: 'Power2.easeIn',
          delay: 200
        });
      }
    });

    // Click handler - activate Auto Pop
    autoPop.on('pointerdown', () => {
      // Prevent multiple clicks
      autoPop.disableInteractive();

      // Unlock audio if needed
      if (!this.scene.audioUnlocked) {
        this.scene.sound.context.resume().then(() => {
          this.scene.audioUnlocked = true;
        }).catch(err => {
          console.warn('Failed to unlock audio:', err);
        });
      }

      // Play collection sound (reuse energy sound)
      this.scene.sound.play('energy_collect_sound');

      // Trigger success haptic feedback
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }

      // Record the collected auto-pop for the next sync
      this.scene.syncBuffer.auto_pops_collected++;

      // Start Auto Pop sequence
      this.scene.autoPop.start();

      // Bubble pop animation - scale up and fade out
      this.scene.tweens.add({
        targets: autoPop,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        angle: autoPop.angle + 180,
        duration: 250,
        ease: 'Back.easeIn',
        onComplete: () => {
          // Remove from tracking set and destroy
          this.activeConfettiSprites.delete(autoPop);
          autoPop.destroy();
        }
      });
    });

    // Pulsing warning fade before disappearing (same as energy/emerald)
    this.scene.time.delayedCall(2500, () => {
      if (autoPop && autoPop.active) {
        autoPop.disableInteractive();

        // Three accelerating pulses before final fade
        this.scene.tweens.add({
          targets: autoPop,
          alpha: 0.3,
          duration: 400,
          ease: 'Sine.easeInOut',
          yoyo: true,
          onComplete: () => {
            this.scene.tweens.add({
              targets: autoPop,
              alpha: 0.3,
              duration: 300,
              ease: 'Sine.easeInOut',
              yoyo: true,
              onComplete: () => {
                this.scene.tweens.add({
                  targets: autoPop,
                  alpha: 0.3,
                  duration: 200,
                  ease: 'Sine.easeInOut',
                  yoyo: true,
                  onComplete: () => {
                    this.scene.tweens.add({
                      targets: autoPop,
                      alpha: 0,
                      duration: 200,
                      ease: 'Power2',
                      onComplete: () => {
                        this.activeConfettiSprites.delete(autoPop);
                        autoPop.destroy();
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  streamMegaJackpotCoins(totalAmount) {
    // Set jackpot playing flag
    this.scene.isJackpotPlaying = true;

    // Play mega jackpot sounds at the start (yeah_sound delayed by 400ms)
    this.scene.sound.play('mega_jackpot_sound');
    this.scene.time.delayedCall(400, () => {
      this.scene.sound.play('yeah_sound');
    });

    // Create spinning light background centered on the chest
    const lightBg = this.scene.add.image(this.scene.player.x, this.scene.player.y, 'jackpot_light')
      .setOrigin(0.5)
      .setDepth(1300); // In front of coins (1100) but behind status bar (2000)

    // Scale to cover entire screen
    const scaleX = this.scene.cameras.main.width / lightBg.width;
    const scaleY = this.scene.cameras.main.height / lightBg.height;
    const scale = Math.max(scaleX, scaleY) * 1.2; // 1.2x for extra coverage
    lightBg.setScale(scale);

    // Rotating animation
    this.scene.tweens.add({
      targets: lightBg,
      angle: 360,
      duration: 3000,
      ease: 'Linear',
      repeat: -1
    });

    // Animate chest between frames 19 and 27 for bouncing effect
    const frames = ['chest_0019', 'chest_0021', 'chest_0023', 'chest_0025', 'chest_0027'];
    let currentFrameIndex = 0;
    let direction = 1; // 1 = forward, -1 = backward

    const textureKeeper = this.scene.time.addEvent({
      delay: 150, // Change frame every 150ms
      callback: () => {
        if (this.scene.isJackpotPlaying) {
          this.scene.player.setTexture(frames[currentFrameIndex]);

          // Move to next frame
          currentFrameIndex += direction;

          // Reverse direction at ends (yoyo effect)
          if (currentFrameIndex >= frames.length - 1) {
            direction = -1;
          } else if (currentFrameIndex <= 0) {
            direction = 1;
          }
        }
      },
      loop: true
    });

    // Create "MEGA JACKPOT!" text announcement
    const centerX = this.scene.cameras.main.width / 2;

    const megaText = this.scene.add.text(centerX, 140, `MEGA JACKPOT!\n+${totalAmount}`, {
      fontFamily: 'Tilt Warp',
      fontSize: '42px',
      fill: '#FFD700', // Gold
      stroke: '#FF4500', // Orange-red outline
      strokeThickness: 5,
      align: 'center',
      padding: { x: 15, y: 15 },
      resolution: 2
    }).setOrigin(0.5).setDepth(1200); // In front of coins (1100) but behind status bar (2000)

    // Create second spinning light background behind the text
    const textLightBg = this.scene.add.image(centerX, 140, 'jackpot_light')
      .setOrigin(0.5)
      .setDepth(1150); // Behind text (1200) but in front of coins (1100)

    // Scale to match chest light (same size)
    textLightBg.setScale(scale);

    // Rotating animation for text light
    this.scene.tweens.add({
      targets: textLightBg,
      angle: 360,
      duration: 3000,
      ease: 'Linear',
      repeat: -1
    });

    // Pulsing text animation
    this.scene.tweens.add({
      targets: megaText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    // Streaming configuration
    const coinsPerBurst = 50; // Spawn 100 coins per burst
    const burstInterval = 100; // Every 100ms
    const totalBursts = totalAmount / coinsPerBurst;
    let burstsCompleted = 0;

    // Start streaming timer after 700ms delay
    this.scene.time.delayedCall(700, () => {
      // Start monitoring AFTER first confetti burst for mega jackpot
      this.scene.uiSlide.startSlideBackMonitoring();

      const burstTimer = this.scene.time.addEvent({
        delay: burstInterval,
        callback: () => {
        // Play sound (overlapping allowed)
        this.scene.sound.play('chest_sound_big');

        // Trigger haptic feedback synchronized with sound
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }

        // Spawn coin burst (skip total update - we'll update incrementally)
        this.createCoinConfetti(coinsPerBurst, true, true);

        // Spawn 1-5 random energy sprites per burst
        const energyCount = Phaser.Math.Between(1, 5);
        for (let i = 0; i < energyCount; i++) {
          this.createEnergyReward();
        }

        // Update coins incrementally with each burst
        const currentCoins = this.scene.coinsState.get();
        const newTotal = currentCoins + coinsPerBurst;
        this.scene.coinsState.set(newTotal);
        this.scene.syncBuffer.coins_earned += coinsPerBurst;

        // Update StatusBar with animation
        this.scene.statusBar.setResource('coins', newTotal, true);

        burstsCompleted++;

        // Check if done
        if (burstsCompleted >= totalBursts) {
          burstTimer.remove();

          // Wait 1 second after final burst
          this.scene.time.delayedCall(1000, () => {
            // Stop texture keeper
            textureKeeper.remove();

            // Re-enable animations
            this.scene.player.anims.resume();

            // Play close animation
            this.scene.player.play('chest_close', true);

            // Remove mega text and light backgrounds
            this.scene.tweens.add({
              targets: [megaText, lightBg, textLightBg],
              alpha: 0,
              duration: 500,
              onComplete: () => {
                megaText.destroy();
                lightBg.destroy();
                textLightBg.destroy();
              }
            });

            // Re-enable chest clicking and interactivity
            this.scene.isJackpotPlaying = false;
            this.scene.player.setInteractive({ useHandCursor: true });
          });
        }
      },
      loop: true
    });
    }); // Close delayedCall callback
  }

  destroy() {
    this.activeConfettiSprites.clear();
  }
}
