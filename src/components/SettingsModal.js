import Phaser from 'phaser';
import { withPersistentState } from '../utils/persistentState.js';

/**
 * SettingsModal Component
 *
 * A modal dialog for game settings with sound and haptic toggles.
 * Features dark overlay, animated transitions, and persistent state.
 *
 * @example
 * const modal = new SettingsModal(scene, {
 *   onSoundToggle: (enabled) => console.log('Sound:', enabled),
 *   onHapticToggle: (enabled) => console.log('Haptic:', enabled)
 * });
 * scene.add.existing(modal);
 * modal.show(); // Open modal
 * modal.hide(); // Close modal
 */
export default class SettingsModal extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene - The scene this modal belongs to
   * @param {Object} config - Configuration object
   * @param {Function} config.onSoundToggle - Callback when sound is toggled (enabled: boolean)
   * @param {Function} config.onHapticToggle - Callback when haptic is toggled (enabled: boolean)
   */
  constructor(scene, config = {}) {
    super(scene, 0, 0);

    this.config = {
      onSoundToggle: config.onSoundToggle || (() => {}),
      onHapticToggle: config.onHapticToggle || (() => {})
    };

    // Initialize persistent state
    this.soundEnabledState = withPersistentState(scene, 'soundEnabled', true);
    this.hapticEnabledState = withPersistentState(scene, 'hapticEnabled', true);

    // Check if current user should see reset button (only for Telegram ID 253305963)
    this.showResetButton = false;
    if (scene.telegramUser && scene.telegramUser.id === 253305963) {
      this.showResetButton = true;
      console.log('Reset Stats button enabled for dev user');
    }

    // Modal dimensions - match reference better
    this.modalWidth = Math.min(500, scene.scale.width * 0.9);
    this.modalHeight = 380;

    // Initially hidden
    this.setVisible(false);
    this.setDepth(5000); // Higher depth to cover status bar

    this.createModal();
    this.setupInteractivity();
  }

  createModal() {
    const centerX = this.scene.scale.width / 2;
    const centerY = this.scene.scale.height / 2;

    // Dark overlay covering entire screen including status bar
    this.overlay = this.scene.add.rectangle(
      0,
      0,
      this.scene.scale.width * 2,
      this.scene.scale.height * 2,
      0x000000,
      0.7
    );
    this.overlay.setOrigin(0, 0);
    this.overlay.setScrollFactor(0);
    this.overlay.setInteractive({ useHandCursor: false });
    this.add(this.overlay);

    // Modal panel background (NineSlice) - with slight tint for better visibility
    this.panel = this.scene.add.nineslice(
      centerX,
      centerY,
      'settings_modal_bg',
      null,
      this.modalWidth,
      this.modalHeight,
      25, 25, 25, 25
    );
    this.panel.setOrigin(0.5);
    this.panel.setTint(0xf5f5f5); // Light gray tint for better contrast
    this.add(this.panel);

    // Header ribbon - using NineSlice to stretch the center
    // Original image: 406×157px
    // Add 130px to original width: 406 + 130 = 536px, then scale by 0.45
    this.headerRibbon = this.scene.add.nineslice(
      centerX,
      centerY - this.modalHeight / 2 - 10,
      'settings_header_ribbon',
      null,
      650,  // Target width: 130px wider than original
      157,  // Original height
      100, 100, 30, 30  // Left, right, top, bottom slices (preserve ribbon ends)
    );
    this.headerRibbon.setOrigin(0.5);
    this.headerRibbon.setScale(0.45);
    this.add(this.headerRibbon);

    // "SETTINGS" text - much smaller
    this.headerText = this.scene.add.text(
      centerX,
      centerY - this.modalHeight / 2 - 20,
      'SETTINGS',
      {
        fontFamily: 'Tilt Warp',
        fontSize: '32px',
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 5,
        padding: { x: 15, y: 15 },
        resolution: 2
       // resolution: window.devicePixelRatio // key change
      }
    );
    this.headerText.setOrigin(0.5);
    this.add(this.headerText);

    // Reset Stats button (only for dev user ID 253305963)
    if (this.showResetButton) {
      this.createResetButton(centerX, centerY - this.modalHeight / 2 + 95);
    }

    // Close button - positioned in upper-right corner of screen
    this.closeButton = this.scene.add.image(
      this.scene.scale.width - 30,
      30,
      'settings_close_btn'
    );
    this.closeButton.setScale(0.2);
    this.closeButton.setInteractive({ useHandCursor: true });
    this.closeButton.setScrollFactor(0); // Keep fixed on screen
    this.add(this.closeButton);

    // Sound toggle row - more spacing from header
    this.createToggleRow(
      centerX,
      centerY - 10,
      'SOUND EFFECTS',
      'settings_sound_icon',
      this.soundEnabledState.get(),
      (enabled) => {
        this.soundEnabledState.set(enabled);
        this.config.onSoundToggle(enabled);
      }
    );

    // Haptic toggle row - more spacing between rows
    this.createToggleRow(
      centerX,
      centerY + 70,
      'HAPTICS',
      'settings_haptic_icon',
      this.hapticEnabledState.get(),
      (enabled) => {
        this.hapticEnabledState.set(enabled);
        this.config.onHapticToggle(enabled);
      }
    );
  }

  /**
   * Creates the Reset Stats button (only visible for dev user)
   */
  createResetButton(x, y) {
    // Create button background
    const buttonBg = this.scene.add.rectangle(x, y, 140, 35, 0xff4444); // Red background
    buttonBg.setStrokeStyle(2, 0x000000); // Black border
    buttonBg.setInteractive({ useHandCursor: true });
    this.add(buttonBg);

    // Create button text
    const buttonText = this.scene.add.text(x, y, 'Reset Stats', {
      fontFamily: 'LINESeed',
      fontSize: '14px',
      fill: '#FFFFFF',
      fontStyle: 'bold',
      resolution: 2
    });
    buttonText.setOrigin(0.5);
    this.add(buttonText);

    // Store references
    this.resetButton = buttonBg;
    this.resetButtonText = buttonText;

    // Button press animation
    buttonBg.on('pointerdown', () => {
      buttonBg.setScale(0.95);
      buttonText.setScale(0.95);

      // Haptic feedback
      if (this.hapticEnabledState.get() && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      }
    });

    // Button release and action
    buttonBg.on('pointerup', () => {
      buttonBg.setScale(1.0);
      buttonText.setScale(1.0);

      // Play button sound
      if (this.scene.sound) {
        this.scene.sound.play('button_sound');
      }

      // Execute reset
      this.resetStats();
    });
  }

  /**
   * Reset game stats to default values (coins=0, gems=0, energy=100)
   * Only callable by dev user (Telegram ID 253305963)
   */
  async resetStats() {
    if (!this.showResetButton) {
      console.warn('Reset stats called by unauthorized user');
      return;
    }

    console.log('Resetting stats to defaults...');

    try {
      // Reset localStorage values
      this.scene.coinsState.set(0);
      this.scene.gemsState.set(0);
      this.scene.batteryState.set(100);

      // Reset first-time events to default (brand new player experience)
      this.scene.firstTimeEvents = {
        guaranteed_mega_jackpot: false,
        tutorial_completed: false,
        welcome_bonus_claimed: false
      };
      console.log('First-time events reset to defaults');

      // Update UI immediately
      this.scene.statusBar.setResource('coins', 0, true);
      this.scene.statusBar.setResource('gems', 0, true);
      this.scene.statusBar.setResource('energy', 100, true);

      // Reset in Supabase database
      if (this.scene.supabase && this.scene.telegramUser) {
        const { error } = await this.scene.supabase
          .from('user_stats')
          .update({
            coins: 0,
            gems: 0,
            energy: 100,
            last_energy_update: new Date().toISOString(),
            first_time_events: {
              guaranteed_mega_jackpot: false,
              tutorial_completed: false,
              welcome_bonus_claimed: false
            }
          })
          .eq('telegram_id', this.scene.telegramUser.id);

        if (error) {
          throw error;
        }

        console.log('Stats reset successfully in database');
      }

      // Show success feedback
      if (this.hapticEnabledState.get() && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }

      // Flash the button text to confirm action
      this.scene.tweens.add({
        targets: this.resetButtonText,
        alpha: 0.3,
        duration: 100,
        yoyo: true,
        repeat: 2
      });

    } catch (error) {
      console.error('Failed to reset stats:', error);

      // Error haptic feedback
      if (this.hapticEnabledState.get() && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      }
    }
  }

  /**
   * Creates a toggle row with icon, label, and switch
   */
  createToggleRow(x, y, labelText, iconKey, initialState, onToggle) {
    // Label text - moved to the right
    const label = this.scene.add.text(x - 150, y, labelText, {
      fontFamily: 'LINESeed',
      fontSize: '16px',
      fill: '#3a4a5a',
      fontStyle: 'bold',
      resolution: 2
    });
    label.setOrigin(0, 0.5);
    this.add(label);

    // Icon - positioned closer to toggle
    const icon = this.scene.add.image(x + 25, y, iconKey);
    icon.setScale(0.45);
    this.add(icon);

    // Toggle container position
    const toggleX = x + 95;

    // Background using NineSlice to create proper pill shape
    // Original image is 150×94px - pill shaped with rounded ends
    // Reduce left/right slices to make middle wider, preserving less of the rounded ends
    const toggleBg = this.scene.add.nineslice(
      toggleX,
      y,
      initialState ? 'toggle_bg_on' : 'toggle_bg_off',
      null,
      200,  // Target width (will stretch middle)
      94,   // Original height
      35, 35, 10, 10  // Smaller left/right (35px) for wider middle, small top/bottom
    );
    toggleBg.setOrigin(0.5);
    toggleBg.setScale(0.45);  // Scale down more
    this.add(toggleBg);

    // Toggle switch button inside container
    // Calculate slide range: button moves left/right within the background
    const slideDistance = 25; // Distance to slide in each direction
    const initialX = initialState ? toggleX + slideDistance : toggleX - slideDistance;

    const toggleSwitch = this.scene.add.image(
      initialX,
      y,
      initialState ? 'toggle_button_on' : 'toggle_button_off'
    );
    toggleSwitch.setScale(0.32);
    this.add(toggleSwitch);

    // Make entire container interactive
    toggleBg.setInteractive({ useHandCursor: true });

    let isEnabled = initialState;

    toggleBg.on('pointerdown', () => {
      isEnabled = !isEnabled;

      // Swap background texture
      toggleBg.setTexture(isEnabled ? 'toggle_bg_on' : 'toggle_bg_off');
      toggleSwitch.setTexture(isEnabled ? 'toggle_button_on' : 'toggle_button_off');

      // Animate button sliding to new position
      const targetX = isEnabled ? toggleX + slideDistance : toggleX - slideDistance;
      this.scene.tweens.add({
        targets: toggleSwitch,
        x: targetX,
        duration: 150,
        ease: 'Cubic.out'
      });

      // Trigger callback
      onToggle(isEnabled);

      // Haptic feedback for toggle selection change (if enabled)
      if (this.hapticEnabledState.get() && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      }
    });

    // Store references for state updates
    return { toggleBg, toggleSwitch };
  }

  setupInteractivity() {
    // Close button
    this.closeButton.on('pointerdown', () => {
      this.closeButton.setScale(0.18);

      // Haptic feedback
      if (this.hapticEnabledState.get() && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      }
    });

    this.closeButton.on('pointerup', () => {
      this.closeButton.setScale(0.2);

      // Play button sound (same as BottomTabMenu and settings gear)
      if (this.scene.sound) {
        this.scene.sound.play('button_sound');
      }

      this.hide();
    });

    // Click overlay to close
    this.overlay.on('pointerdown', () => {
      this.hide();
    });

    // Prevent clicks on modal panel from closing
    this.panel.setInteractive();
    this.panel.on('pointerdown', (pointer, localX, localY, event) => {
      event.stopPropagation();
    });
  }

  /**
   * Show the modal with animation
   */
  show() {
    this.setVisible(true);
    this.setAlpha(0);
    this.setScale(0.8);

    // Calculate offset to simulate upper-right origin
    // When scaling from 0.8 to 1, we need to shift position to keep upper-right fixed
    const scaleChange = 1 - 0.8; // 0.2
    const startOffsetX = this.scene.scale.width * scaleChange;
    const startOffsetY = 0;

    this.x = startOffsetX;
    this.y = startOffsetY;

    // Add black overlay to HTML avatar (if it exists)
    const avatarOverlay = document.querySelector('div[style*="position: absolute"]');
    if (avatarOverlay && avatarOverlay.querySelector('img')) {
      // Store original border color
      avatarOverlay.dataset.originalBorder = avatarOverlay.style.border;
      // Darken the white border to match the overlay
      avatarOverlay.style.border = '2px solid rgba(255, 255, 255, 0.3)';

      // Add a black overlay div
      const overlayDiv = document.createElement('div');
      overlayDiv.id = 'avatar-modal-overlay';
      overlayDiv.style.position = 'absolute';
      overlayDiv.style.top = '0';
      overlayDiv.style.left = '0';
      overlayDiv.style.width = '100%';
      overlayDiv.style.height = '100%';
      overlayDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'; // 70% black, matching modal overlay
      overlayDiv.style.borderRadius = '50%';
      overlayDiv.style.pointerEvents = 'none';
      overlayDiv.style.zIndex = '1';
      avatarOverlay.appendChild(overlayDiv);
    }

    // Fade in overlay with position animation to simulate upper-right origin
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scale: 1,
      x: 0,
      y: 0,
      duration: 300,
      ease: 'Back.out'
    });

    // Haptic feedback
    if (this.hapticEnabledState.get() && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
  }

  /**
   * Hide the modal with animation
   */
  hide() {
    // Remove the black overlay from HTML avatar and restore border
    const avatarOverlay = document.querySelector('div[style*="position: absolute"]');
    if (avatarOverlay && avatarOverlay.dataset.originalBorder) {
      avatarOverlay.style.border = avatarOverlay.dataset.originalBorder;
      delete avatarOverlay.dataset.originalBorder;
    }

    const overlayDiv = document.getElementById('avatar-modal-overlay');
    if (overlayDiv) {
      overlayDiv.remove();
    }

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.8,
      duration: 200,
      ease: 'Cubic.in',
      onComplete: () => {
        this.setVisible(false);
      }
    });

    // Haptic feedback
    if (this.hapticEnabledState.get() && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
  }

  /**
   * Get current settings state
   */
  getSettings() {
    return {
      soundEnabled: this.soundEnabledState.get(),
      hapticEnabled: this.hapticEnabledState.get()
    };
  }
}
