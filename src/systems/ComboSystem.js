import ComboBonusDisplay from '../components/ComboBonusDisplay.js';

// Combo system: tracks rapid consecutive catches of the same specialty
// item (energy/gems) and grants a bonus when 3+ land inside the window.
export default class ComboSystem {
  constructor(scene) {
    this.scene = scene;

    // Combo tracking state
    this.comboTracker = {
      itemType: null,        // 'energy' or 'gems'
      count: 0,              // Number of consecutive clicks
      lastClickTime: 0,      // Timestamp of last click
      pendingRewards: []     // Array of reward amounts to apply
    };
    this.comboTimer = null;  // Reference to 350ms delayed event
  }

  /**
   * Handle specialty item click for combo tracking
   *
   * IMPORTANT: Combos work ACROSS multiple chest opens!
   * Example: Open chest 3 times quickly:
   *   - Chest 1 spawns 1 energy → click it
   *   - Chest 2 spawns 2 energies → click both within 350ms
   *   - Chest 3 spawns 2 energies → click both within 350ms
   * Result: 5x combo = +3 bonus energy (floor(5/3) * 3)
   *
   * The 350ms window only cares about time between specialty item clicks,
   * NOT about which chest they came from.
   *
   * @param {string} itemType - 'energy' or 'gems'
   * @param {number} rewardAmount - Amount to give (usually 1)
   */
  handleSpecialtyItemClick(itemType, rewardAmount) {
    // Skip combo tracking during mega jackpot only (combos work during auto-pop!)
    if (this.scene.isJackpotPlaying) {
      return;
    }

    const now = this.scene.time.now;
    const timeSinceLastClick = now - this.comboTracker.lastClickTime;

    // Check if this is the same item type within 350ms window
    if (this.comboTracker.itemType === itemType && timeSinceLastClick <= 700) {
      // Continue combo: increment count and store reward
      this.comboTracker.count++;
      this.comboTracker.pendingRewards.push(rewardAmount);
      this.comboTracker.lastClickTime = now;

      console.log(`🔥 Combo continued: ${itemType} x${this.comboTracker.count}`);
    } else {
      // Different item type or window expired: finalize previous combo
      this.finalizeCombo();

      // Start new combo tracking
      this.comboTracker.itemType = itemType;
      this.comboTracker.count = 1;
      this.comboTracker.lastClickTime = now;
      this.comboTracker.pendingRewards = [rewardAmount];

      console.log(`✨ New combo started: ${itemType}`);
    }

    // Clear existing combo timer
    if (this.comboTimer) {
      this.comboTimer.remove();
    }

    // Start new 350ms timer to finalize combo if no more clicks
    this.comboTimer = this.scene.time.delayedCall(700, () => {
      this.finalizeCombo();
    });
  }

  /**
   * Finalize the current combo and apply rewards
   */
  finalizeCombo() {
    // Check if there's a combo to finalize
    if (this.comboTracker.count === 0) {
      return;
    }

    const totalCount = this.comboTracker.count;
    const itemType = this.comboTracker.itemType;
    const pendingRewards = this.comboTracker.pendingRewards;

    // Calculate total base rewards
    const totalBaseRewards = pendingRewards.reduce((sum, amount) => sum + amount, 0);

    // Check if combo qualifies (3 or more)
    if (totalCount >= 3) {
      // Bonus equals the total count (3x = +3, 4x = +4, 5x = +5, etc.)
      const bonusAmount = totalCount;

      console.log(`🎉 COMBO BONUS! ${itemType} x${totalCount} = +${bonusAmount} bonus`);

      // Apply base rewards + bonus
      this.applyComboRewards(itemType, totalBaseRewards, bonusAmount);
    } else {
      // No combo: apply base rewards only (already applied in click handler, so do nothing)
      console.log(`No combo: ${itemType} x${totalCount} (need 3+)`);
    }

    // Reset combo tracker
    this.resetComboTracker();
  }

  /**
   * Apply combo rewards and show UI
   * @param {string} itemType - 'energy' or 'gems'
   * @param {number} baseAmount - Base rewards already applied
   * @param {number} bonusAmount - Bonus rewards to apply
   */
  applyComboRewards(itemType, baseAmount, bonusAmount) {
    // Apply bonus rewards based on item type
    if (itemType === 'energy') {
      const currentEnergy = this.scene.batteryState.get();
      const newEnergy = currentEnergy + bonusAmount;
      this.scene.batteryState.set(newEnergy);
      this.scene.sync.buffer.energy_collected += bonusAmount;
      this.scene.statusBar.setResource('energy', newEnergy, true);
    } else if (itemType === 'gems') {
      const currentGems = this.scene.gemsState.get();
      const newGems = currentGems + bonusAmount;
      this.scene.gemsState.set(newGems);
      this.scene.sync.buffer.gems_earned += bonusAmount;
      this.scene.statusBar.setResource('gems', newGems, true);
    }

    // Show combo bonus UI (positioned higher on screen, closer to top)
    const centerX = this.scene.cameras.main.width / 2;
    const topY = this.scene.cameras.main.height * 0.25; // 25% from top (higher than center)

    const comboBonusDisplay = new ComboBonusDisplay(this.scene, centerX, topY, {
      itemType: itemType,
      bonusAmount: bonusAmount
    });
    this.scene.add.existing(comboBonusDisplay);
    comboBonusDisplay.setScrollFactor(0).setDepth(3000); // Top layer

    // Play combo sound effect only
    this.scene.sound.play('combo_sound');

    // Trigger haptic feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }

    // Deltas are picked up by the sync loop
  }

  /**
   * Reset combo tracker to initial state
   */
  resetComboTracker() {
    this.comboTracker.itemType = null;
    this.comboTracker.count = 0;
    this.comboTracker.lastClickTime = 0;
    this.comboTracker.pendingRewards = [];
  }

  destroy() {
    if (this.comboTimer) {
      this.comboTimer.remove();
      this.comboTimer = null;
    }
  }
}
