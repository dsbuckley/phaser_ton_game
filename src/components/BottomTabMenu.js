import Phaser from 'phaser';

/**
 * BottomTabMenu Component
 *
 * Reusable bottom navigation bar with tabs for scene navigation.
 * Follows StatusBar architecture pattern with Container-based design.
 *
 * Features:
 * - 5 equal-width tabs with icons and labels
 * - Optional notification dots (red with white stroke)
 * - Interactive tap effects (tint, scale)
 * - Responsive layout based on screen width
 * - Fixed positioning at bottom of screen
 *
 * @extends Phaser.GameObjects.Container
 */
export default class BottomTabMenu extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene - The scene this tab menu belongs to
   * @param {number} x - X position (typically center of screen)
   * @param {number} y - Y position (typically near bottom of screen)
   * @param {Object} config - Configuration object
   * @param {Array} config.tabs - Array of tab configs [{key, icon, label, showNotification, onTap}]
   * @param {string} config.bgTexture - Background texture key (default: 'statusbar_bg_small')
   */
  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    // Store configuration
    this.config = {
      bgTexture: config.bgTexture || 'statusbar_bg_small',
      tabs: config.tabs || [
        { key: 'main', icon: 'icon_heart', label: 'MAIN', showNotification: false },
        { key: 'stickers', icon: 'icon_picture', label: 'STICKERS', showNotification: true },
        { key: 'wheel', icon: 'icon_setting', label: 'WHEEL', showNotification: false },
        { key: 'earn', icon: 'icon_gold', label: 'EARN', showNotification: true },
        { key: 'shop', icon: 'icon_trophy', label: 'SHOP', showNotification: false }
      ]
    };

    // Override with user config
    if (config.tabs) {
      this.config.tabs = config.tabs;
    }

    // Store tab elements for later access
    this.tabElements = [];

    // Track currently active tab
    this.activeTabKey = config.activeTab || null;

    // Create UI elements
    this.createBackground();
    this.createTabs();

    // Set initial active tab if specified
    if (this.activeTabKey) {
      this.setActiveTab(this.activeTabKey);
    }
  }

  /**
   * Calculate layout dimensions based on screen width
   * @returns {Object} Layout info { totalWidth, tabWidth, barHeight }
   */
  calculateLayout() {
    const screenWidth = this.scene.cameras.main.width;
    const tabCount = this.config.tabs.length;
    const barHeight = 100; // Increased to 100px for better spacing

    return {
      totalWidth: screenWidth,
      tabWidth: screenWidth / tabCount,
      barHeight: barHeight
    };
  }

  /**
   * Create background bar using NineSlice
   */
  createBackground() {
    const layout = this.calculateLayout();
    const { totalWidth, barHeight } = layout;

    // Add extra width to eliminate edge gaps (extend beyond screen edges)
    const bgWidth = totalWidth + 20; // 10px extra on each side

    // Shift background down by 15px so top edge is lower
    const bgYOffset = 15;

    // Create NineSlice background (same asset as StatusBar)
    if (this.scene.textures.exists(this.config.bgTexture)) {
      this.background = this.scene.add.nineslice(
        0, bgYOffset,
        this.config.bgTexture,
        null,
        bgWidth, barHeight,
        11, 11, 15, 15 // NineSlice values for statusbar_bg_small
      ).setOrigin(0.5);
    } else {
      // Fallback: dark rounded rectangle
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0x000000, 0.9);
      graphics.fillRoundedRect(-bgWidth / 2, bgYOffset - barHeight / 2, bgWidth, barHeight, 10);
      this.background = graphics;
    }

    this.add(this.background);
  }

  /**
   * Create all tab elements (icons, labels, notification dots)
   */
  createTabs() {
    const layout = this.calculateLayout();
    const { totalWidth, tabWidth, barHeight } = layout;
    const startX = -totalWidth / 2;

    this.config.tabs.forEach((tab, index) => {
      const tabCenterX = startX + (index * tabWidth) + (tabWidth / 2);
      const tabY = 0;

      const tabElement = this.createTab(tabCenterX, tabY, tab, tabWidth, barHeight);
      this.tabElements.push(tabElement);
    });
  }

  /**
   * Create a single tab with icon, label, and optional notification dot
   * @param {number} x - Tab center X position
   * @param {number} y - Tab center Y position
   * @param {Object} tab - Tab config {key, icon, label, showNotification, onTap}
   * @param {number} width - Tab width
   * @param {number} height - Tab height
   * @returns {Object} Tab element object
   */
  createTab(x, y, tab, width, height) {
    const iconSize = tab.iconSize || 32; // Allow custom icon size per tab
    const iconY = y - 10; // Position icon slightly above center
    const labelY = y + 18; // Position label below icon

    // Create active tab highlight background using NineSlice (initially hidden)
    // Add this FIRST so it's behind everything
    const highlightBg = this.scene.add.nineslice(
      x, y,
      'tab_focus',
      null,
      width - 10, height - 20,
      10, 10, 10, 10 // NineSlice values - adjust as needed
    );
    highlightBg.setVisible(false);
    highlightBg.setOrigin(0.5);
    this.add(highlightBg);

    // Create invisible interactive area for the entire tab
    const hitArea = this.scene.add.rectangle(x, y, width, height, 0xffffff, 0);
    hitArea.setInteractive({ useHandCursor: true });
    this.add(hitArea);

    // Tab icon
    let icon;
    if (this.scene.textures.exists(tab.icon)) {
      icon = this.scene.add.image(x, iconY, tab.icon);
      icon.setDisplaySize(iconSize, iconSize);
    } else {
      // Fallback: colored circle
      icon = this.scene.add.circle(x, iconY, iconSize / 2, 0xffffff);
    }
    this.add(icon);

    // Tab label
    const label = this.scene.add.text(x, labelY, tab.label, {
      fontFamily: 'LINESeed',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio
    }).setOrigin(0.5);
    this.add(label);

    // Notification badge (optional)
    let notificationDot = null;
    let notificationText = null;
    if (tab.showNotification) {
      const bgYOffset = 15; // Match background offset
      const dotX = x + width / 2 - 15; // Top-right corner of tab
      const dotY = y - height / 2 + 10 + bgYOffset; // Shift down with background

      // Check if there's notification text (like "NEW")
      const hasText = tab.notificationText && tab.notificationText.length > 0;

      if (hasText) {
        // Larger badge with text - more padding for readability
        notificationDot = this.scene.add.circle(dotX, dotY, 13, 0xff0000); // Increased from 10 to 13
        notificationDot.setStrokeStyle(2, 0xffffff, 1);
        this.add(notificationDot);

        // Add text inside the badge
        notificationText = this.scene.add.text(dotX, dotY, tab.notificationText, {
          fontFamily: 'LINESeed',
          fontSize: '9px', // Slightly larger font
          color: '#ffffff',
          fontStyle: 'bold',
          resolution: window.devicePixelRatio
        }).setOrigin(0.5);
        this.add(notificationText);
      } else {
        // Small dot without text
        notificationDot = this.scene.add.circle(dotX, dotY, 6, 0xff0000);
        notificationDot.setStrokeStyle(2, 0xffffff, 1);
        this.add(notificationDot);
      }
    }

    // Add interaction effects
    this.addTabInteractions(hitArea, icon, label, tab);

    return {
      key: tab.key,
      hitArea: hitArea,
      icon: icon,
      label: label,
      notificationDot: notificationDot,
      notificationText: notificationText,
      highlightBg: highlightBg,
      config: tab
    };
  }

  /**
   * Add interaction effects to tab (hover, tap, callbacks)
   * @param {Phaser.GameObjects.Rectangle} hitArea - Interactive area
   * @param {Phaser.GameObjects.Image} icon - Tab icon
   * @param {Phaser.GameObjects.Text} label - Tab label
   * @param {Object} tab - Tab config
   */
  addTabInteractions(hitArea, icon, label, tab) {
    // Store original scale values
    const iconOriginalScale = icon.scale;
    const labelOriginalScale = label.scale;

    // Hover effect (optional - can add subtle hover state if needed)
    hitArea.on('pointerover', () => {
      // Currently no hover effect to keep it clean
    });

    hitArea.on('pointerout', () => {
      // Currently no hover effect to keep it clean
    });

    // Tap effect (scale down then bounce back)
    hitArea.on('pointerdown', () => {
      // Kill any existing tweens to prevent conflicts
      this.scene.tweens.killTweensOf(icon);
      this.scene.tweens.killTweensOf(label);

      // Scale down animation
      this.scene.tweens.add({
        targets: icon,
        scaleX: iconOriginalScale * 0.85,
        scaleY: iconOriginalScale * 0.85,
        duration: 100,
        ease: 'Power2'
      });

      this.scene.tweens.add({
        targets: label,
        scaleX: labelOriginalScale * 0.85,
        scaleY: labelOriginalScale * 0.85,
        duration: 100,
        ease: 'Power2'
      });
    });

    hitArea.on('pointerup', () => {
      // Kill any existing tweens
      this.scene.tweens.killTweensOf(icon);
      this.scene.tweens.killTweensOf(label);

      // Bounce back to original scale
      this.scene.tweens.add({
        targets: icon,
        scaleX: iconOriginalScale,
        scaleY: iconOriginalScale,
        duration: 150,
        ease: 'Back.out'
      });

      this.scene.tweens.add({
        targets: label,
        scaleX: labelOriginalScale,
        scaleY: labelOriginalScale,
        duration: 150,
        ease: 'Back.out'
      });

      // Resume AudioContext on first interaction (required by browsers)
      if (!this.scene.audioUnlocked) {
        this.scene.sound.context.resume().then(() => {
          this.scene.audioUnlocked = true;
          console.log('Audio unlocked via tab menu');

          // Play button sound after unlocking
          if (this.scene.sound) {
            this.scene.sound.play('button_sound');
          }
        }).catch(err => {
          console.warn('Failed to unlock audio:', err);
        });
      } else {
        // Audio already unlocked, just play the sound
        if (this.scene.sound) {
          this.scene.sound.play('button_sound');
        }
      }

      // Trigger haptic feedback (same as chest click)
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      }

      // Set this tab as active
      this.setActiveTab(tab.key);

      // Trigger callback if provided
      if (tab.onTap && typeof tab.onTap === 'function') {
        tab.onTap(tab.key);
      }
    });
  }

  /**
   * Show or hide notification dot on a specific tab
   * @param {string} tabKey - Tab key identifier
   * @param {boolean} visible - Show (true) or hide (false)
   * @param {string|null} text - Optional text to display in badge (e.g., 'NEW')
   */
  setNotification(tabKey, visible, text = null) {
    const tabElement = this.tabElements.find(t => t.key === tabKey);

    if (tabElement) {
      // If hiding, just hide existing elements
      if (!visible) {
        if (tabElement.notificationDot) {
          tabElement.notificationDot.setVisible(false);
        }
        if (tabElement.notificationText) {
          tabElement.notificationText.setVisible(false);
        }
        return;
      }

      // If showing, determine if we need text badge or simple dot
      const hasText = text && text.length > 0;

      // Calculate position values
      const layout = this.calculateLayout();
      const tabWidth = layout.tabWidth;
      const barHeight = layout.barHeight;
      const bgYOffset = 15;
      const dotX = tabElement.icon.x + tabWidth / 2 - 15;
      const dotY = tabElement.icon.y - barHeight / 2 + 10 + bgYOffset;

      // Remove existing elements if switching between text/no-text
      if (tabElement.notificationDot) {
        tabElement.notificationDot.destroy();
        tabElement.notificationDot = null;
      }
      if (tabElement.notificationText) {
        tabElement.notificationText.destroy();
        tabElement.notificationText = null;
      }

      // Create appropriate notification style
      if (hasText) {
        // Larger badge with text
        tabElement.notificationDot = this.scene.add.circle(dotX, dotY, 13, 0xff0000);
        tabElement.notificationDot.setStrokeStyle(2, 0xffffff, 1);
        this.add(tabElement.notificationDot);

        tabElement.notificationText = this.scene.add.text(dotX, dotY, text, {
          fontFamily: 'LINESeed',
          fontSize: '9px',
          color: '#ffffff',
          fontStyle: 'bold',
          resolution: window.devicePixelRatio
        }).setOrigin(0.5);
        this.add(tabElement.notificationText);
      } else {
        // Small dot without text
        tabElement.notificationDot = this.scene.add.circle(dotX, dotY, 6, 0xff0000);
        tabElement.notificationDot.setStrokeStyle(2, 0xffffff, 1);
        this.add(tabElement.notificationDot);
      }
    }
  }

  /**
   * Get tab element by key
   * @param {string} tabKey - Tab key identifier
   * @returns {Object|null} Tab element or null if not found
   */
  getTab(tabKey) {
    return this.tabElements.find(t => t.key === tabKey) || null;
  }

  /**
   * Set active tab with visual highlighting
   * @param {string} tabKey - Tab key identifier
   */
  setActiveTab(tabKey) {
    // Hide all tab highlight backgrounds first
    this.tabElements.forEach(tabElement => {
      if (tabElement.highlightBg) {
        tabElement.highlightBg.setVisible(false);
      }
    });

    // Set new active tab
    const activeTab = this.tabElements.find(t => t.key === tabKey);
    if (activeTab) {
      // Show highlight background for active tab
      if (activeTab.highlightBg) {
        activeTab.highlightBg.setVisible(true);
      }

      // Update active tab tracker
      this.activeTabKey = tabKey;
      console.log(`Active tab set to: ${tabKey}`);
    }
  }
}
