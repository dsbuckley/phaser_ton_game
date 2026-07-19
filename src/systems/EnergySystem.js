// Energy system: the 1s countdown tick (which also triggers the server-side
// hourly grant flush), countdown-timer visibility, and the offline-regen
// notification. Energy amounts themselves live in scene.batteryState and
// are granted server-side (apply_sync, server time).
export default class EnergySystem {
  constructor(scene) {
    this.scene = scene;
    this.countdownUpdateTimer = null;
  }

  showOfflineRegenNotification(energyGained) {
    const centerX = this.scene.cameras.main.width / 2;
    const startY = 150; // Start below battery bar

    // Create notification container with background
    const notification = this.scene.add.container(centerX, startY);

    // Create background pill (similar to StatusBar style)
    const bgWidth = 280;
    const bgHeight = 60;
    const bg = this.scene.add.nineslice(
      0, 0,
      'statusbar_bg_small',
      null,
      bgWidth, bgHeight,
      11, 11, 15, 15
    );
    bg.setOrigin(0.5);

    // Create energy icon (matching StatusBar energy icon)
    const icon = this.scene.add.image(-100, -5, 'statusbar_energy');
    icon.setScale(0.85); // Larger icon for better visibility

    // Create main text
    const mainText = this.scene.add.text(10, -8, `+${energyGained} Energy`, {
      fontFamily: 'Tilt Warp',
      fontSize: '22px',
      fill: '#4ADE80', // Green color for positive gain
      stroke: '#000000',
      strokeThickness: 4,
      padding: { x: 10, y: 10 },
      resolution: 2
    }).setOrigin(0.5);

    // Create subtitle text
    const subtitleText = this.scene.add.text(10, 12, 'while you were away', {
      fontFamily: 'LINESeed',
      fontSize: '14px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 3,
      padding: { x: 5, y: 5 },
      resolution: 2
    }).setOrigin(0.5);

    // Add elements to container
    notification.add([bg, icon, mainText, subtitleText]);
    notification.setAlpha(0);
    notification.setDepth(2000); // Above everything

    // Animate: Fade in, slide down, pause, fade out
    this.scene.tweens.add({
      targets: notification,
      alpha: 1,
      y: startY + 30,
      duration: 400,
      ease: 'Back.out',
      onComplete: () => {
        // Hold for 2 seconds
        this.scene.time.delayedCall(2000, () => {
          // Fade out
          this.scene.tweens.add({
            targets: notification,
            alpha: 0,
            y: startY + 50,
            duration: 400,
            ease: 'Power2',
            onComplete: () => notification.destroy()
          });
        });
      }
    });
  }

  startCountdown() {
    // Update countdown timer every second
    this.countdownUpdateTimer = this.scene.time.addEvent({
      delay: 1000, // 1 second
      callback: () => {
        // Hourly grants are server-side: when the server-provided grant
        // time passes, flush a sync — the response applies the grant and
        // shows the "+N energy" notification via applyServerState()
        if (this.scene.sync.nextGrantAt && Date.now() >= this.scene.sync.nextGrantAt && !this.scene.sync.syncInFlight) {
          this.scene.sync.nextGrantAt = null; // reset until server sends the next one
          this.scene.sync.flush();
        }

        // Update countdown timer display
        if (this.scene.energyCountdownTimer && this.scene.energyCountdownTimer.visible) {
          this.scene.energyCountdownTimer.updateCountdown();
        }
      },
      loop: true
    });
  }

  updateEnergyTimerVisibility() {
    if (!this.scene.energyCountdownTimer) return;

    const currentEnergy = this.scene.batteryState.get();
    const shouldBeVisible = currentEnergy < 100;

    // Only update if visibility needs to change
    if (this.scene.energyCountdownTimer.visible !== shouldBeVisible) {
      this.scene.energyCountdownTimer.setVisible(shouldBeVisible);
    }
  }

  destroy() {
    if (this.countdownUpdateTimer) {
      this.countdownUpdateTimer.remove();
      this.countdownUpdateTimer = null;
    }
  }
}
