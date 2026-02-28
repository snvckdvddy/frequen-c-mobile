import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Battery from 'expo-battery';
import { palette } from '../design/tokens/materials';

// Define the shape of our context
interface ThemeContextType {
  isVoltageSag: boolean;
  themeColors: typeof palette;
}

const ThemeContext = createContext<ThemeContextType>({
  isVoltageSag: false,
  themeColors: palette,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isVoltageSag, setIsVoltageSag] = useState(false);

  useEffect(() => {
    // Check initial battery level
    const checkBattery = async () => {
      const level = await Battery.getBatteryLevelAsync();
      setBatteryLevel(level);
      setIsVoltageSag(level > 0 && level <= 0.10);
    };
    checkBattery();

    // Listen for battery changes
    const subscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      setBatteryLevel(batteryLevel);
      setIsVoltageSag(batteryLevel <= 0.10);
    });

    return () => subscription.remove();
  }, []);

  // Dynamically overwrite the primary action and ice colors if Voltage Sag is active
  const activeColors = isVoltageSag
    ? {
      ...palette,
      orange: '#FFB347', // Warm amber (replaces ice #00E5FF)
      ice: 'rgba(255, 179, 71, 0.12)', // derived from warmOrange
    }
    : palette;

  return (
    <ThemeContext.Provider value={{ isVoltageSag, themeColors: activeColors as typeof palette }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme anywhere in the app
export const useTheme = () => useContext(ThemeContext);