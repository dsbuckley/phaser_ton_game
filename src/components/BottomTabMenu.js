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

    // Create UI elements
    this.createBackground();
    this.createTabs();
  }

  /**
   * Calculate layout dimensions based on screen width
   * @returns {Object} Layout info { totalWidth, tabWidth, barHeight }
   */
  calculateLayout() {
    const screenWidth = this.scene.cameras.main.width;
    const tabCount = this.config.tabs.length;
    const barHeight = 70;

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

    // Create NineSlice background (same asset as StatusBar)
    if (this.scene.textures.exists(this.config.bgTexture)) {
      this.background = this.scene.add.nineslice(
        0, 0,
        this.config.bgTexture,
        null,
        totalWidth, barHeight,
        11, 11, 15, 15 // NineSlice values for statusbar_bg_small
      ).setOrigin(0.5);
    } else {
      // Fallback: dark rounded rectangle
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0x000000, 0.9);
      graphics.fillRoundedRect(-totalWidth / 2, -barHeight / 2, totalWidth, barHeight, 10);
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

    // Notification dot (optional)
    let notificationDot = null;
    if (tab.showNotification) {
      const dotX = x + width / 2 - 15; // Top-right corner of tab
      const dotY = y - height / 2 + 10;

      notificationDot = this.scene.add.circle(dotX, dotY, 6, 0xff0000);
      notificationDot.setStrokeStyle(2, 0xffffff, 1);
      this.add(notificationDot);
    }

    // Add interaction effects
    this.addTabInteractions(hitArea, icon, label, tab);

    return {
      key: tab.key,
      hitArea: hitArea,
      icon: icon,
      label: label,
      notificationDot: notificationDot,
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

    // Hover effect
    hitArea.on('pointerover', () => {
      icon.setTint(0xdddddd);
      label.setTint(0xdddddd);
    });

    hitArea.on('pointerout', () => {
      icon.clearTint();
      label.clearTint();
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
   */
  setNotification(tabKey, visible) {
    const tabElement = this.tabElements.find(t => t.key === tabKey);
    if (tabElement && tabElement.notificationDot) {
      tabElement.notificationDot.setVisible(visible);
    } else if (tabElement && visible && !tabElement.notificationDot) {
      // Create notification dot if it doesn't exist
      const layout = this.calculateLayout();
      const tabWidth = layout.tabWidth;
      const barHeight = layout.barHeight;

      const dotX = tabElement.icon.x + tabWidth / 2 - 15;
      const dotY = tabElement.icon.y - barHeight / 2 + 10;

      const notificationDot = this.scene.add.circle(dotX, dotY, 6, 0xff0000);
      notificationDot.setStrokeStyle(2, 0xffffff, 1);
      this.add(notificationDot);

      tabElement.notificationDot = notificationDot;
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
   * Set active tab (future feature for highlighting)
   * @param {string} tabKey - Tab key identifier
   */
  setActiveTab(tabKey) {
    // TODO: Implement active state visual (tint, underline, scale, etc.)
    console.log(`Active tab set to: ${tabKey}`);
  }
}
