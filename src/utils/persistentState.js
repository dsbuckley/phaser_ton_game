/**
 * Custom persistent state utility for Phaser
 * Provides localStorage-backed state management with automatic persistence
 * Uses modern Phaser events API (no deprecation warnings)
 */

export class PersistentState {
  constructor(scene, key, defaultValue, options = {}) {
    this.scene = scene;
    this.key = key;
    this.defaultValue = defaultValue;
    this.debug = options.debug || false;

    // Load initial value from localStorage
    this.currentValue = this.loadFromStorage();

    // Listen for scene shutdown to cleanup
    this.scene.events.once('shutdown', () => this.cleanup(), this);
    this.scene.events.once('destroy', () => this.cleanup(), this);

    if (this.debug) {
      console.log(`[PersistentState] Initialized "${key}" with value:`, this.currentValue);
    }
  }

  /**
   * Get the current value
   */
  get() {
    return this.currentValue;
  }

  /**
   * Set a new value and persist to localStorage
   */
  set(newValue) {
    this.currentValue = newValue;
    this.saveToStorage(newValue);

    if (this.debug) {
      console.log(`[PersistentState] Updated "${this.key}" to:`, newValue);
    }

    // Emit change event using modern Phaser API
    this.scene.events.emit('persistentstate:change', {
      key: this.key,
      value: newValue
    });
  }

  /**
   * Reset to default value
   */
  reset() {
    this.set(this.defaultValue);
  }

  /**
   * Load value from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.key);
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn(`[PersistentState] Failed to load "${this.key}":`, error);
    }
    return this.defaultValue;
  }

  /**
   * Save value to localStorage
   */
  saveToStorage(value) {
    try {
      localStorage.setItem(this.key, JSON.stringify(value));
    } catch (error) {
      console.warn(`[PersistentState] Failed to save "${this.key}":`, error);
    }
  }

  /**
   * Cleanup on scene destroy
   */
  cleanup() {
    if (this.debug) {
      console.log(`[PersistentState] Cleanup "${this.key}"`);
    }
  }
}

/**
 * Factory function to create persistent state (hook-like API)
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {string} key - LocalStorage key
 * @param {*} defaultValue - Default value if no stored value exists
 * @param {Object} options - Optional configuration { debug: boolean }
 * @returns {PersistentState} State object with .get() and .set() methods
 */
export function withPersistentState(scene, key, defaultValue, options = {}) {
  return new PersistentState(scene, key, defaultValue, options);
}

/**
 * Optional: React-style hook that returns [getter, setter] tuple
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {string} key - LocalStorage key
 * @param {*} defaultValue - Default value
 * @returns {[Function, Function]} Tuple of [getValue, setValue]
 */
export function usePersistentState(scene, key, defaultValue, options = {}) {
  const state = new PersistentState(scene, key, defaultValue, options);
  return [
    () => state.get(),
    (newValue) => state.set(newValue)
  ];
}
