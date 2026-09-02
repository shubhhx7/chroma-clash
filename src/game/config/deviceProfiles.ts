/**
 * Named device profile presets used by tests and the debug HUD; runtime
 * detection lives in responsive/DeviceProfile.ts.
 */
export interface DeviceProfilePreset {
  name: string;
  cssWidth: number;
  cssHeight: number;
  touch: boolean;
}

export const DEVICE_PROFILE_PRESETS: readonly DeviceProfilePreset[] = [
  { name: 'desktop-1080p', cssWidth: 1920, cssHeight: 1080, touch: false },
  { name: 'laptop-768', cssWidth: 1366, cssHeight: 768, touch: false },
  { name: 'tablet-landscape', cssWidth: 1024, cssHeight: 768, touch: true },
  { name: 'phone-landscape-844', cssWidth: 844, cssHeight: 390, touch: true },
  { name: 'phone-landscape-915', cssWidth: 915, cssHeight: 412, touch: true },
  { name: 'phone-portrait-390', cssWidth: 390, cssHeight: 844, touch: true },
  { name: 'phone-portrait-412', cssWidth: 412, cssHeight: 915, touch: true },
] as const;
