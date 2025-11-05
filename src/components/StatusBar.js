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
   * @param {string} config.username - Username to display with level (default: 'Player')
   * @param {number} config.userLevel - User level number (default: 1)
   * @param {Array} config.resources - Array of resource configs [{icon, value, key}]
   * @param {Function} config.onSettingsClick - Callback for settings button tap
   */
  constructor(scene, x, y, config = {}) {
    super(scene, x, y);

    // Store Y position for HTML avatar positioning
    this.statusBarY = config.statusBarY || y;

    // Store configuration
    this.config = {
      avatarTexture: config.avatarTexture || 'avatar_default',
      avatarUrl: config.avatarUrl || null,
      username: config.username || 'Player',
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

    // Avatar image (always create it, even if texture doesn't exist)
    // This ensures loadTelegramPhoto() has a valid target
    const textureToUse = this.scene.textures.exists(this.config.avatarTexture)
      ? this.config.avatarTexture
      : '__DEFAULT'; // Phaser's built-in default texture

    this.avatarImage = this.scene.add.image(avatarX, avatarY, textureToUse);
    this.avatarImage.setDisplaySize(42, 42); // Smaller avatar
    this.avatarImage.setOrigin(0.5);

    // Create circular mask for avatar using container-relative coordinates
    const maskShape = this.scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillCircle(avatarX, avatarY, 21);
    const mask = maskShape.createGeometryMask();
    this.avatarImage.setMask(mask);

    this.add(this.avatarImage);

    // HTML avatar container for Telegram photos (overlays Phaser canvas)
    this.htmlAvatarContainer = null;

    // Level circle at bottom-right of avatar
    const levelCircleRadius = 10;
    const levelCircleX = avatarX + -25; // Bottom-right corner of avatar
    const levelCircleY = avatarY + 17;

    this.levelCircle = this.scene.add.circle(levelCircleX, levelCircleY, levelCircleRadius, 0x3498db);
    this.levelCircle.setStrokeStyle(2, 0xffffff, 1);
    this.add(this.levelCircle);

    // Level number text inside circle
    this.levelNumberText = this.scene.add.text(levelCircleX, levelCircleY, `${this.config.userLevel}`, {
      fontFamily: 'LINESeed',
      fontSize: 12,
      color: '#ffffff',
      fontStyle: 'bold',
      resolution: window.devicePixelRatio
    }).setOrigin(0.5);
    this.add(this.levelNumberText);

    // Username text below avatar, left-aligned with avatar left edge
    const usernameX = avatarX - 21; // Left edge of avatar (avatarX - radius)
    const usernameY = avatarY + 30; // Below avatar
    this.usernameText = this.scene.add.text(usernameX, usernameY, `${this.config.username}`, {
      fontFamily: 'LINESeed',
      fontSize: 16,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio
    }).setOrigin(0, 0.5); // Left-aligned

    this.add(this.usernameText);
  }

  /**
   * Calculate layout for pill-shaped resource containers
   * Returns positioning info for each resource pill
   */
  calculatePillLayout() {
    const startX = 70; // Start after avatar
    const availableWidth = this.scene.cameras.main.width - 140; // Space between avatar and settings

    // Pill dimensions - compact to match reference catalog
    const pillGap = 15; // Tighter gap for compact layout

    // Calculate total width needed (sum of all pill widths + gaps)
    const totalPillsWidth = this.config.resources.reduce((sum, resource, index) => {
      const pillWidth = resource.width || 75; // Default to 75 if not specified
      const gap = index > 0 ? pillGap : 0; // No gap before first pill
      return sum + gap + pillWidth;
    }, 0);

    const centerOffset = (availableWidth - totalPillsWidth) / 2;

    return {
      startX: startX + centerOffset,
      pillGap,
      pillHeight: 40 // Adjusted to work better with 60px tall asset (avoid excessive squashing)
    };
  }

  /**
   * Create resource displays with individual pill-shaped containers
   */
  createResourceDisplays() {
    const layout = this.calculatePillLayout();
    this.resourceDisplays = [];

    let currentX = layout.startX + 10; // Start position with 10px shift right

    this.config.resources.forEach((resource, index) => {
      const pillWidth = resource.width || 75; // Use custom width or default to 75
      const pillY = 0;

      // Create pill-shaped background container
      const pill = this.createResourcePill(
        currentX,
        pillY,
        pillWidth,
        layout.pillHeight,
        resource.icon,
        resource.value,
        resource.key
      );

      this.resourceDisplays.push(pill);

      // Move to next position (current pill width + gap)
      currentX += pillWidth + layout.pillGap;
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
    // Create pill background using NineSlice - use smaller Statusbar asset
    // Asset dimensions: 22px × 30px - compact pill-shaped with rounded ends
    let pillBg;
    if (this.scene.textures.exists('statusbar_bg_small')) {
      pillBg = this.scene.add.nineslice(
        x, y,
        'statusbar_bg_small',
        null,
        width, height,
        11, 11, 15, 15 // Match asset dimensions: 11px left/right (half of 22), 15px top/bottom (half of 30)
      ).setOrigin(0, 0.5);
    } else {
      // Fallback: draw rounded rectangle
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0x000000, 0.9);
      graphics.fillRoundedRect(x, y - height / 2, width, height, height / 2); // Pill shape
      pillBg = graphics;
    }
    this.add(pillBg);

    // Resource icon - compact size for tight layout
    const iconSize = 30; // Icon size
    const iconX = x + 5; // Left padding from pill edge (shifted right 5px more)
    const iconY = y;

    let icon;
    if (this.scene.textures.exists(iconKey)) {
      icon = this.scene.add.image(iconX, iconY, iconKey);
      icon.setDisplaySize(iconSize, iconSize);
    } else {
      // Fallback: colored circle
      icon = this.scene.add.circle(iconX, iconY, iconSize / 2, 0xf39c12);
    }
    this.add(icon);

    // Resource value text - positioned close to icon
    const textX = x + 20; // Position after icon with small gap (shifted right 5px more)
    const textY = y;

    const valueText = this.scene.add.text(textX, textY, this.formatNumber(value), {
      fontFamily: 'LINESeed',
      fontSize: 18, // Smaller font for compact layout
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio
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
    if (!photoUrl) {
      console.log('StatusBar: No photo URL provided');
      return;
    }

    console.log('StatusBar: Attempting to load Telegram photo from:', photoUrl);

    // Create HTML overlay for Telegram photo (avoids CORS issues entirely)
    // Position it over the Phaser canvas at the avatar location
    this.htmlAvatarContainer = document.createElement('div');
    this.htmlAvatarContainer.style.position = 'absolute';
    this.htmlAvatarContainer.style.width = '45px';
    this.htmlAvatarContainer.style.height = '45px';
    this.htmlAvatarContainer.style.borderRadius = '50%';
    this.htmlAvatarContainer.style.overflow = 'hidden';
    this.htmlAvatarContainer.style.pointerEvents = 'none'; // Don't block clicks
    this.htmlAvatarContainer.style.zIndex = '1001'; // Above Phaser canvas

    const img = document.createElement('img');
    img.src = photoUrl;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';

    img.onload = () => {
      console.log('StatusBar: Telegram avatar loaded successfully');
      // Hide the Phaser avatar image (we're using HTML overlay now)
      if (this.avatarImage) {
        this.avatarImage.setVisible(false);
      }
    };

    img.onerror = () => {
      console.error('StatusBar: Failed to load Telegram avatar');
      // Keep Phaser avatar visible as fallback
      if (this.htmlAvatarContainer && this.htmlAvatarContainer.parentNode) {
        this.htmlAvatarContainer.parentNode.removeChild(this.htmlAvatarContainer);
      }
    };

    this.htmlAvatarContainer.appendChild(img);
    document.body.appendChild(this.htmlAvatarContainer);

    // Position the HTML avatar over the Phaser canvas
    this.updateHtmlAvatarPosition();

    // Update position on window resize
    this.scene.scale.on('resize', () => this.updateHtmlAvatarPosition());
  }

  /**
   * Update the position of the HTML avatar overlay to match Phaser coordinates
   */
  updateHtmlAvatarPosition() {
    if (!this.htmlAvatarContainer) return;

    // Get canvas position and scale
    const canvas = this.scene.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();

    // Use stored StatusBar Y position (varies based on full-screen mode)
    // Avatar is at (35, 0) relative to StatusBar
    const avatarX = 35;
    const avatarY = 0;

    // Calculate final position (avatar center relative to canvas)
    const worldX = avatarX;
    const worldY = this.statusBarY + avatarY;

    // Convert to screen coordinates
    const screenX = canvasRect.left + worldX - 21; // -21 to center (42px / 2)
    const screenY = canvasRect.top + worldY - 21;

    this.htmlAvatarContainer.style.left = screenX + 'px';
    this.htmlAvatarContainer.style.top = screenY + 'px';
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
        // Kill any existing tweens on this text to prevent stacking
        this.scene.tweens.killTweensOf(display.text);

        // Reset scale to 1 before starting new animation
        display.text.setScale(1);

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
    this.levelNumberText.setText(`${level}`);
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
