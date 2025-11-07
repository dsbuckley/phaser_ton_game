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

    // Header ribbon - smaller scale
    this.headerRibbon = this.scene.add.image(
      centerX,
      centerY - this.modalHeight / 2 + 35,
      'settings_header_ribbon'
    );
    this.headerRibbon.setScale(0.45);
    this.add(this.headerRibbon);

    // "SETTINGS" text - much smaller
    this.headerText = this.scene.add.text(
      centerX,
      centerY - this.modalHeight / 2 + 35,
      'SETTINGS',
      {
        fontFamily: 'Tilt Warp',
        fontSize: '22px',
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 4,
        padding: { x: 15, y: 15 },
        resolution: 2
      }
    );
    this.headerText.setOrigin(0.5);
    this.add(this.headerText);

    // Close button - smaller and better positioned
    this.closeButton = this.scene.add.image(
      centerX + this.modalWidth / 2 - 35,
      centerY - this.modalHeight / 2 + 35,
      'settings_close_btn'
    );
    this.closeButton.setScale(0.5);
    this.closeButton.setInteractive({ useHandCursor: true });
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
   * Creates a toggle row with icon, label, and switch
   */
  createToggleRow(x, y, labelText, iconKey, initialState, onToggle) {
    // Icon - smaller and positioned on left
    const icon = this.scene.add.image(x - 180, y, iconKey);
    icon.setScale(0.45);
    this.add(icon);

    // Label text - much smaller
    const label = this.scene.add.text(x - 130, y, labelText, {
      fontFamily: 'LINESeed',
      fontSize: '16px',
      fill: '#3a4a5a',
      fontStyle: 'bold',
      resolution: 2
    });
    label.setOrigin(0, 0.5);
    this.add(label);

    // Toggle container position (moved closer to center)
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

    // Toggle switch button inside container - smaller
    const toggleSwitch = this.scene.add.image(
      toggleX,
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

      // Swap both background AND button textures
      toggleBg.setTexture(isEnabled ? 'toggle_bg_on' : 'toggle_bg_off');
      toggleSwitch.setTexture(isEnabled ? 'toggle_button_on' : 'toggle_button_off');

      // Trigger callback
      onToggle(isEnabled);

      // Haptic feedback (if enabled)
      if (this.hapticEnabledState.get() && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      }
    });

    // Store references for state updates
    return { toggleBg, toggleSwitch };
  }

  setupInteractivity() {
    // Close button
    this.closeButton.on('pointerdown', () => {
      this.closeButton.setScale(0.45);

      // Haptic feedback
      if (this.hapticEnabledState.get() && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      }
    });

    this.closeButton.on('pointerup', () => {
      this.closeButton.setScale(0.5);
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

    // Fade in overlay
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scale: 1,
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
