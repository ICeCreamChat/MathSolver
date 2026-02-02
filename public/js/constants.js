/**
 * MathSolver - Constants Module
 * Copyright (c) 2026 ICeCreamChat
 * Licensed under the MIT License.
 *
 * Centralized configuration and magic numbers.
 */
const CONSTANTS = {
    // Math symbols for particle effects and explosions
    MATH_SYMBOLS: ['∑', '∫', 'π', '∞', '√', '≈', '≠', '±', '∂', '∇', 'x', 'y'],
    MATH_SYMBOLS_3D: ['∑', '∫', 'π', 'e', '0', '1', 'sin', 'cos', '∞', '√', 'tan', 'log'],

    // Particle engine settings
    PARTICLE_COUNT_MOBILE: 1500,
    PARTICLE_COUNT_DESKTOP: 3000,
    PARTICLE_SPREAD_X: 400,
    PARTICLE_SPREAD_Y: 300,
    PARTICLE_SPREAD_Z: 200,
    PARTICLE_RESET_Y: 150,

    // Cropper settings
    MAX_CROP_DIMENSION: 2048,
    CROP_QUALITY: 0.9,

    // Chat history limits
    MAX_HISTORY_MESSAGES: 50,

    // UI breakpoints
    MOBILE_BREAKPOINT: 768,

    // Animation settings
    EXPLOSION_PARTICLE_COUNT: 12,
    EXPLOSION_VELOCITY_MIN: 60,
    EXPLOSION_VELOCITY_MAX: 120,

    // Context panel constraints
    PANEL_MIN_WIDTH: 300,
    PANEL_MIN_HEIGHT: 200,

    // Timeouts
    TOAST_DURATION: 3000,
    RESIZE_DEBOUNCE: 100,

    // Beijing time hours for theme switching
    DAY_START_HOUR: 6,
    DAY_END_HOUR: 19
};

// Expose to window for global access
window.CONSTANTS = CONSTANTS;
