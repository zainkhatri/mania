// Mobile Layout Configuration
// Tweak these settings to customize mobile appearance without affecting desktop

export const mobileConfig = {
  // Header settings
  header: {
    show: true,
    height: 'h-14',
    sticky: true,
    backgroundColor: 'bg-black/95',
    backdropBlur: 'backdrop-blur-md',
    borderColor: 'border-white/20',
  },

  // Layout settings
  layout: {
    padding: 'p-4',
    spacing: 'space-y-4',
    backgroundColor: 'bg-black',
    borderRadius: 'rounded-lg',
    shadow: 'shadow-lg',
    compactMode: false,
  },

  // Form elements
  form: {
    fontSize: 'text-sm',
    inputHeight: 'h-10',
    buttonSize: 'p-2',
    textareaHeight: 'min-h-[120px]',
    borderColor: 'border-white/30',
    focusBorderColor: 'border-white',
    focusRingColor: 'ring-white/30',
  },

  // Color picker
  colorPicker: {
    size: 'w-8 h-8',
    borderRadius: 'rounded-md',
    horizontalScroll: true,
    scrollbarHeight: '8px',
    scrollbarColor: 'rgba(255, 255, 255, 0.4)',
    scrollbarTrackColor: 'rgba(255, 255, 255, 0.1)',
  },

  // Image upload
  imageUpload: {
    height: 'h-24',
    borderRadius: 'rounded-xl',
    borderStyle: 'border-dashed',
    borderColor: 'border-white/30',
    hoverBorderColor: 'border-white/50',
    backgroundColor: 'bg-black/30',
    hoverBackgroundColor: 'bg-black/40',
  },

  // Journal preview
  journalPreview: {
    height: 'min-h-[300px]',
    borderRadius: 'rounded-xl',
    backgroundColor: 'bg-gradient-to-br from-[#1a1a1a]/70 to-[#2a2a2a]/70',
    borderColor: 'border-white/10',
    collapsible: true,
    maxHeight: 'max-h-[60vh]',
  },

  // Navigation
  navigation: {
    sticky: true,
    backgroundColor: 'bg-black/90',
    backdropBlur: 'backdrop-blur-md',
    borderColor: 'border-white/20',
    zIndex: 50,
  },

  // Action buttons
  actionButtons: {
    size: 'p-2',
    gap: 'gap-2',
    downloadColor: 'bg-blue-600',
    downloadHoverColor: 'bg-blue-700',
    clearColor: 'bg-red-600',
    clearHoverColor: 'bg-red-700',
    iconSize: 'h-5 w-5',
  },

  // Date picker
  datePicker: {
    height: 'h-10',
    fontSize: 'text-sm',
    borderRadius: 'rounded-lg',
    backgroundColor: 'bg-black/40',
    borderColor: 'border-white/30',
    calendarBackground: '#000000',
    calendarBorderColor: 'rgba(255, 255, 255, 0.2)',
  },

  // Layout toggle
  layoutToggle: {
    justifyContent: 'justify-center',
    gap: 'gap-0.5rem',
    buttonSize: 'p-2',
    activeColor: 'bg-white/20',
    inactiveColor: 'bg-transparent',
  },

  // Animations
  animations: {
    fadeInDuration: '0.3s',
    slideUpDuration: '0.3s',
    hoverTransition: 'transition-all duration-200',
    focusTransition: 'transition-all duration-200',
  },

  // Responsive breakpoints
  breakpoints: {
    mobile: 'max-width: 768px',
    tablet: 'max-width: 1024px',
    desktop: 'min-width: 1025px',
  },

  // Custom mobile classes
  customClasses: {
    // Add any custom CSS classes here
    mobileContainer: 'mobile-layout-container',
    mobileScroll: 'mobile-scroll-container',
    mobileHeader: 'mobile-header',
    mobileInput: 'mobile-input',
    mobileButton: 'mobile-button',
    mobileColorPicker: 'mobile-color-picker',
    mobileImageUpload: 'mobile-image-upload',
    mobileJournalPreview: 'mobile-journal-preview',
    mobileHorizontalScroll: 'mobile-horizontal-scroll',
    mobileCompact: 'mobile-compact',
    mobileSection: 'mobile-section',
    mobileNavTabs: 'mobile-nav-tabs',
    mobileFormGrid: 'mobile-form-grid',
    mobileJournalCanvas: 'mobile-journal-canvas',
    mobileActionButtons: 'mobile-action-buttons',
    mobileTextarea: 'mobile-textarea',
    mobileDatePicker: 'mobile-date-picker',
    mobileLayoutToggle: 'mobile-layout-toggle',
    mobileColorGrid: 'mobile-color-grid',
    mobileImageGallery: 'mobile-image-gallery',
    mobileLoading: 'mobile-loading',
    mobileError: 'mobile-error',
    mobileSuccess: 'mobile-success',
    mobileTooltip: 'mobile-tooltip',
    mobileTooltipText: 'mobile-tooltip-text',
    mobileFadeIn: 'mobile-fade-in',
    mobileSlideUp: 'mobile-slide-up',
  },

  // Text sizes
  textSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
  },

  // Spacing
  spacing: {
    p1: '0.25rem',
    p2: '0.5rem',
    p3: '0.75rem',
    p4: '1rem',
    p6: '1.5rem',
    m1: '0.25rem',
    m2: '0.5rem',
    m3: '0.75rem',
    m4: '1rem',
    m6: '1.5rem',
    gap1: '0.25rem',
    gap2: '0.5rem',
    gap3: '0.75rem',
    gap4: '1rem',
    gap6: '1.5rem',
  },

  // Colors
  colors: {
    primary: '#000000',
    secondary: '#ffffff',
    accent: '#3b82f6',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#06b6d4',
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },

  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    full: '9999px',
  },
};

// Helper function to get mobile config with overrides
export const getMobileConfig = (overrides: Partial<typeof mobileConfig> = {}) => {
  return {
    ...mobileConfig,
    ...overrides,
  };
};

// Export individual sections for easy access
export const {
  header,
  layout,
  form,
  colorPicker,
  imageUpload,
  journalPreview,
  navigation,
  actionButtons,
  datePicker,
  layoutToggle,
  animations,
  breakpoints,
  customClasses,
  textSizes,
  spacing,
  colors,
  shadows,
  borderRadius,
} = mobileConfig; 