import Phaser from 'phaser';

/**
 * StatusBar Component
 *
 * Reusable top status bar displaying user avatar, resources, and settings button.
 * Matches Telegram mobile game UI patterns with dark rounded background.
 *
 * Features:
 * - User avatar with level indicator
 * - Three configurable resource displays (coins, energy, gems, etc.)
 * - Settings/menu button
 * - Responsive positioning with safe area padding
 * - Number formatting with K/M suffixes
 *
 * @extends Phaser.GameObjects.Container
 */
export default class StatusBar extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene - The scene this status bar belongs to
   * @param {number} x - X position (typically 0 for full-width bar)
   * @param {number} y - Y position (typically near top of screen)
   * @param {Object} config - Configuration object
   * @param {string} config.avatarTexture - Texture key for user avatar (optional)
   * @param {string} config.avatarUrl - URL for Telegram user photo (optional)
   * @param {number} config.userLevel - User level number (default: 1)
   * @param {Array} config.resources - Array of resource configs [{icon, value, key}]
   * @param {Function} config.onSettingsClick - Callback for settings button tap
   */
  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    // Store configuration
    this.config = {
      avatarTexture: config.avatarTexture || 'avatar_default',
      avatarUrl: config.avatarUrl || null,
      userLevel: config.userLevel || 1,
      resources: config.resources || [
        { key: 'coins', icon: 'statusbar_coin', value: 0 },
        { key: 'energy', icon: 'statusbar_energy', value: 0 },
        { key: 'gems', icon: 'statusbar_gem', value: 0 }
      ],
      onSettingsClick: config.onSettingsClick || (() => console.log('Settings clicked'))
    };

    // Resource value storage
    this.resourceValues = {};
    this.config.resources.forEach(res => {
      this.resourceValues[res.key] = res.value;
    });

    // Create UI elements
    this.createAvatar();
    this.createResourceDisplays(); // Now creates individual pill containers
    this.createSettingsButton();

    // Load Telegram user photo if URL provided
    if (this.config.avatarUrl) {
      this.loadTelegramPhoto(this.config.avatarUrl);
    }
  }

  /**
   * Create user avatar with circular frame and level text
   */
  createAvatar() {
    const avatarX = 35; // Reduced left padding
    const avatarY = 0;

    // Avatar frame (circular background with white border) - smaller size
    this.avatarFrame = this.scene.add.circle(avatarX, avatarY, 24, 0x2c3e50);
    this.avatarFrame.setStrokeStyle(2, 0xffffff, 1); // 2px white border
    this.add(this.avatarFrame);

    // Avatar image (will be replaced with Telegram photo if available)
    if (this.scene.textures.exists(this.config.avatarTexture)) {
      this.avatarImage = this.scene.add.image(avatarX, avatarY, this.config.avatarTexture);
      this.avatarImage.setDisplaySize(42, 42); // Smaller avatar
      this.avatarImage.setOrigin(0.5);

      // Create circular mask for avatar
      const maskShape = this.scene.make.graphics();
      maskShape.fillStyle(0xffffff);
      maskShape.fillCircle(avatarX, avatarY, 21);
      const mask = maskShape.createGeometryMask();
      this.avatarImage.setMask(mask);

      this.add(this.avatarImage);
    }

    // Level text below avatar - smaller font
    this.levelText = this.scene.add.text(avatarX, avatarY + 24, `${this.config.userLevel} LVL`, {
      fontFamily: 'LINESeed',
      fontSize: '9px', // Smaller level text
      fill: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 2
    }).setOrigin(0.5);
    this.add(this.levelText);
  }

  /**
   * Calculate layout for pill-shaped resource containers
   * Returns positioning info for each resource pill
   */
  calculatePillLayout() {
    const resourceCount = this.config.resources.length;
    const startX = 70; // Start after avatar
    const availableWidth = this.scene.cameras.main.width - 140; // Space between avatar and settings

    // Pill dimensions - compact to match reference catalog
    const pillWidth = 82; // Further reduced for tighter fit
    const pillGap = 4; // Tighter gap for compact layout

    // Calculate total width needed and centering offset
    const totalPillsWidth = (pillWidth * resourceCount) + (pillGap * (resourceCount - 1));
    const centerOffset = (availableWidth - totalPillsWidth) / 2;

    return {
      startX: startX + centerOffset,
      pillWidth,
      pillGap,
      pillHeight: 30 // Further reduced for more compact appearance
    };
  }

  /**
   * Create resource displays with individual pill-shaped containers
   */
  createResourceDisplays() {
    const layout = this.calculatePillLayout();
    this.resourceDisplays = [];

    this.config.resources.forEach((resource, index) => {
      // Calculate X position for this pill
      const pillX = layout.startX + (index * (layout.pillWidth + layout.pillGap));
      const pillY = 0;

      // Create pill-shaped background container
      const pill = this.createResourcePill(
        pillX,
        pillY,
        layout.pillWidth,
        layout.pillHeight,
        resource.icon,
        resource.value,
        resource.key
      );

      this.resourceDisplays.push(pill);
    });
  }

  /**
   * Create a single pill-shaped resource container
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Pill width
   * @param {number} height - Pill height
   * @param {string} iconKey - Icon texture key
   * @param {number} value - Resource value
   * @param {string} resourceKey - Resource identifier
   * @returns {Object} Object containing pill elements
   */
  createResourcePill(x, y, width, height, iconKey, value, resourceKey) {
    // Create pill background using NineSlice for proper scaling
    let pillBg;
    if (this.scene.textures.exists('label_oval_demo')) {
      pillBg = this.scene.add.nineslice(
        x, y,
        'label_oval_demo',
        null,
        width, height,
        26, 26, 18, 18 // Adjusted slices for smaller oval shape
      ).setOrigin(0, 0.5);
      pillBg.setTint(0x000000); // Black tint for dark appearance
    } else {
      // Fallback: draw rounded rectangle
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0x000000, 0.9);
      graphics.fillRoundedRect(x, y - height/2, width, height, height/2); // Pill shape
      pillBg = graphics;
    }
    this.add(pillBg);

    // Resource icon - compact size for tight layout
    const iconSize = 18; // Smaller icon to fit compact pills
    const iconX = x + 16; // Tighter left padding
    const iconY = y;

    let icon;
    if (this.scene.textures.exists(iconKey)) {
      icon = this.scene.add.image(iconX, iconY, iconKey);
      icon.setDisplaySize(iconSize, iconSize);
    } else {
      // Fallback: colored circle
      icon = this.scene.add.circle(iconX, iconY, iconSize/2, 0xf39c12);
    }
    this.add(icon);

    // Resource value text - positioned very close to icon
    const textX = x + 25; // Position very close to icon, left-aligned
    const textY = y;

    const valueText = this.scene.add.text(textX, textY, this.formatNumber(value), {
      fontFamily: 'LINESeed',
      fontSize: '13px', // Smaller font for compact layout
      fill: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: 2
    }).setOrigin(0, 0.5); // Left-align text
    this.add(valueText);

    return {
      key: resourceKey,
      background: pillBg,
      icon: icon,
      text: valueText
    };
  }

  /**
   * Create settings button on the right
   */
  createSettingsButton() {
    const buttonX = this.scene.cameras.main.width - 30; // Closer to edge
    const buttonY = 0;

    // Settings icon button - smaller
    if (this.scene.textures.exists('settings_icon')) {
      this.settingsButton = this.scene.add.image(buttonX, buttonY, 'settings_icon');
      this.settingsButton.setDisplaySize(28, 28); // Reduced from 32px
    } else {
      // Fallback: gear icon using graphics
      this.settingsButton = this.scene.add.circle(buttonX, buttonY, 16, 0x95a5a6);
    }

    this.settingsButton.setInteractive({ useHandCursor: true });

    // Hover/tap effects
    this.settingsButton.on('pointerover', () => {
      this.settingsButton.setTint(0xdddddd);
    });

    this.settingsButton.on('pointerout', () => {
      this.settingsButton.clearTint();
    });

    this.settingsButton.on('pointerdown', () => {
      this.settingsButton.setScale(0.9);
      this.config.onSettingsClick();
    });

    this.settingsButton.on('pointerup', () => {
      this.settingsButton.setScale(1);
    });

    this.add(this.settingsButton);
  }

  /**
   * Load Telegram user photo from URL
   * @param {string} photoUrl - URL to Telegram profile photo
   */
  loadTelegramPhoto(photoUrl) {
    // Use Phaser's dynamic texture loading
    const uniqueKey = `telegram_avatar_${Date.now()}`;

    this.scene.load.image(uniqueKey, photoUrl);
    this.scene.load.once('complete', () => {
      if (this.scene.textures.exists(uniqueKey)) {
        // Replace avatar image with loaded photo
        if (this.avatarImage) {
          this.avatarImage.setTexture(uniqueKey);
        }
      }
    });
    this.scene.load.start();
  }

  /**
   * Update a resource value
   * @param {string} key - Resource key (e.g., 'coins', 'energy')
   * @param {number} value - New value
   * @param {boolean} animate - Whether to animate the change (default: false)
   */
  setResource(key, value, animate = false) {
    this.resourceValues[key] = value;

    const display = this.resourceDisplays.find(d => d.key === key);
    if (display) {
      const formattedValue = this.formatNumber(value);

      if (animate) {
        // Scale animation for value change
        this.scene.tweens.add({
          targets: display.text,
          scaleX: 1.2,
          scaleY: 1.2,
          duration: 100,
          yoyo: true,
          onStart: () => {
            display.text.setText(formattedValue);
          }
        });
      } else {
        display.text.setText(formattedValue);
      }
    }
  }

  /**
   * Get a resource value
   * @param {string} key - Resource key
   * @returns {number} Current value
   */
  getResource(key) {
    return this.resourceValues[key] || 0;
  }

  /**
   * Update user level display
   * @param {number} level - New level
   */
  setLevel(level) {
    this.config.userLevel = level;
    this.levelText.setText(`${level} LVL`);
  }

  /**
   * Format numbers with K/M suffixes
   * @param {number} num - Number to format
   * @returns {string} Formatted string (e.g., "1.5K", "2.3M")
   */
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
    }
    return num.toString();
  }
}
