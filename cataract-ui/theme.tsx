import React, { createContext, useContext, useState, ReactNode } from 'react';

// --- MATERIAL DESIGN THEME CONFIGURATION ---

type ThemeConfig = {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
};

export const THEMES: Record<string, ThemeConfig> = {
  default: {
    id: 'default',
    name: 'Default (Blue)',
    primaryColor: 'blue', // Material Blue
    secondaryColor: 'indigo'
  },
  magenta: {
    id: 'magenta',
    name: 'Magenta',
    primaryColor: 'pink',
    secondaryColor: 'rose'
  },
  lavender: {
    id: 'lavender',
    name: 'Lavender',
    primaryColor: 'violet',
    secondaryColor: 'purple'
  },
  turquoise: {
    id: 'turquoise',
    name: 'Turquoise',
    primaryColor: 'cyan',
    secondaryColor: 'teal'
  },
  gradient: {
    id: 'gradient',
    name: 'Gradient',
    primaryColor: 'violet', // Base color for text/borders
    secondaryColor: 'cyan'
  }
};

// --- UTILITIES TO GENERATE CLASSES ---
export const getThemeClasses = (theme: ThemeConfig) => {
  const p = theme.primaryColor;
  const isGradient = theme.id === 'gradient';

  // Base classes generation (Standard Material Logic)
  const baseClasses = {
    // Layout & Surfaces
    appBackground: `bg-slate-50`,
    surface: `bg-white`,
    surfaceVariant: `bg-${p}-50`,

    // Header (Top App Bar)
    headerBg: `bg-${p}-50`,
    headerText: `text-${p}-900`,
    headerIconContainer: `bg-${p}-100 text-${p}-700`,

    // Typography & Icons
    primaryText: `text-${p}-700`,
    onPrimaryText: `text-white`,
    secondaryText: `text-slate-600`,

    // Interactive Elements (Buttons / FABs)
    fabBg: `bg-${p}-600 hover:bg-${p}-700 shadow-md hover:shadow-lg active:bg-${p}-800`,
    buttonPrimary: `bg-${p}-600 text-white hover:bg-${p}-700 shadow-sm hover:shadow active:shadow-none rounded-full px-6 py-2.5 font-medium tracking-wide`,

    // 3D Cube
    cube: {
      // Front face is the main branding
      frontGradient: `bg-${p}-600`,
      frontIconBg: `bg-white/20`,
      frontTitle: `text-white`,

      // Sides are lighter/darker shades to simulate lighting
      top: `bg-${p}-400`,
      bottom: `bg-${p}-800`,
      left: `bg-${p}-500`,
      right: `bg-white`, // Info face
      back: `bg-${p}-900`,

      // Content on the Right Face (Info)
      rightBorder: `border-${p}-100`,
      rightTitle: `text-${p}-800`,
      rightText: `text-slate-600`,
      rightActionText: `text-${p}-700`,
      rightActionBg: `bg-${p}-50`,
    },

    // Dialog / Modal
    dialogOverlay: `bg-slate-900/40`,
    dialogPanel: `bg-white`,
    dialogHighlight: `bg-${p}-100`,

    // FAQ / Chat
    chatHeader: `bg-${p}-600`,
    userBubble: `bg-${p}-600 text-white`,
    botBubble: `bg-${p}-50 text-slate-800`,
    suggestionChip: `border border-${p}-200 text-${p}-700 hover:bg-${p}-50 bg-white`,

    // Footer
    footerBg: 'bg-transparent',
    footerBorder: 'border-slate-200/60',
    footerIcon: `text-${p}-500`,
    footerLink: `text-${p}-600 hover:text-${p}-800`,
    footerAccent: `bg-${p}-50 text-${p}-600`,
  };

  // Override for Gradient Theme
  if (isGradient) {
    return {
      ...baseClasses,
      // Gradients for interactive elements
      fabBg: `bg-gradient-to-br from-cyan-500 to-violet-600 hover:shadow-lg hover:brightness-110`,
      chatHeader: `bg-gradient-to-r from-cyan-500 to-violet-600`,
      userBubble: `bg-gradient-to-r from-cyan-500 to-violet-600 text-white`,

      cube: {
        ...baseClasses.cube,
        // The requested Cyan to Violet Gradient
        frontGradient: `bg-gradient-to-br from-cyan-400 to-violet-600`,
        // Adjust sides to match the gradient palette
        top: `bg-cyan-400`,    // Light top (cyan side)
        left: `bg-violet-500`, // Side (violet side)
        bottom: `bg-violet-800`,
        back: `bg-violet-950`,
      }
    };
  }

  return baseClasses;
};

// --- CONTEXT SETUP ---

interface ThemeContextType {
  currentTheme: ThemeConfig;
  setTheme: (id: string) => void;
  classes: ReturnType<typeof getThemeClasses>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState<string>('lavender');

  const currentTheme = THEMES[currentThemeId] || THEMES['default'];
  const classes = getThemeClasses(currentTheme);

  const setTheme = (id: string) => {
    if (THEMES[id]) {
      setCurrentThemeId(id);
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, classes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};