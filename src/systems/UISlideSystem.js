// Slides the UI chrome (avatar/settings, energy timer, bottom tab menu)
// out of the way while a chest opens and back in once effects finish.
export default class UISlideSystem {
  constructor(scene) {
    this.scene = scene;
    this.uiSlideCheckTimer = null; // Timer for checking when to slide UI back in
  }

  slideOut() {
    // Slide only avatar and settings button from StatusBar (keep resource pills visible)
    // Use absolute position -180 (above screen)
    if (this.scene.statusBar && this.scene.statusBar.slideAvatarAndControls) {
      this.scene.statusBar.slideAvatarAndControls(-180, 400, 'Power2.easeIn');
    }

    // Slide EnergyCountdownTimer up if visible
    if (this.scene.energyCountdownTimer && this.scene.energyCountdownTimer.visible) {
      this.scene.tweens.add({
        targets: this.scene.energyCountdownTimer,
        y: -100,
        duration: 400,
        ease: 'Power2.easeIn'
      });
    }


    // Slide BottomTabMenu down (out of screen at bottom)
    if (this.scene.bottomTabMenu) {
      const screenHeight = this.scene.cameras.main.height;
      const slideOutY = screenHeight + 150; // Slide down past screen edge

      this.scene.tweens.add({
        targets: this.scene.bottomTabMenu,
        y: slideOutY,
        duration: 400,
        ease: 'Power2.easeIn'
      });
    }
  }

  /**
   * Slide UI elements back into screen (downward for top, upward for bottom)
   * Brings back avatar and controls, keeps resource pills in place
   */
  slideIn() {
    // Slide avatar and settings button back to original position (y: 0)
    if (this.scene.statusBar && this.scene.statusBar.slideAvatarAndControls) {
      this.scene.statusBar.slideAvatarAndControls(0, 500, 'Power2.easeOut');
    }

    // Slide EnergyCountdownTimer down to original position if visible
    if (this.scene.energyCountdownTimer && this.scene.energyCountdownTimer.visible) {
      this.scene.tweens.add({
        targets: this.scene.energyCountdownTimer,
        y: 70,
        duration: 500,
        ease: 'Power2.easeOut'
      });
    }


    // Slide BottomTabMenu up (back to original position at bottom)
    if (this.scene.bottomTabMenu) {
      const screenHeight = this.scene.cameras.main.height;
      const barHeight = 100;
      const originalY = screenHeight - (barHeight / 2); // Original position

      this.scene.tweens.add({
        targets: this.scene.bottomTabMenu,
        y: originalY,
        duration: 500,
        ease: 'Power2.easeOut'
      });
    }
  }

  /**
   * Start monitoring for when to slide UI back in
   * Checks every 100ms if all confetti sprites are cleared
   */
  startSlideBackMonitoring() {
    // Clear any existing timer
    if (this.uiSlideCheckTimer) {
      this.uiSlideCheckTimer.remove();
    }

    this.uiSlideCheckTimer = this.scene.time.addEvent({
      delay: 100, // Check every 100ms
      callback: () => {
        // Check if all confetti is cleared and not playing jackpot
        if (this.scene.activeConfettiSprites.size === 0 && !this.scene.isJackpotPlaying) {
          // Slide UI back in
          this.slideIn();

          // Stop checking
          if (this.uiSlideCheckTimer) {
            this.uiSlideCheckTimer.remove();
            this.uiSlideCheckTimer = null;
          }
        }
      },
      loop: true
    });
  }

  destroy() {
    if (this.uiSlideCheckTimer) {
      this.uiSlideCheckTimer.remove();
      this.uiSlideCheckTimer = null;
    }
  }
}
