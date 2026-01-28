/**
 * The Counting House - Mock Settings Data
 * Settings and fiscal years for development before Supabase connection
 */

import type { FiscalYear, AppSetting } from '@/types/database';

// ============================================
// MOCK FISCAL YEARS
// ============================================

export const mockFiscalYears: FiscalYear[] = [
  {
    id: 'fy-2026-0001',
    year: 2026,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'fy-2025-0001',
    year: 2025,
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'fy-2024-0001',
    year: 2024,
    created_at: '2024-01-01T00:00:00Z',
  },
];

// ============================================
// MOCK SETTINGS
// ============================================

export interface Settings {
  fiscal_year_id: string;
  openrouter_model: string;
}

export const mockSettings: Settings = {
  fiscal_year_id: 'fy-2026-0001',
  openrouter_model: 'anthropic/claude-3-haiku',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

let currentSettings: Settings = { ...mockSettings };

/**
 * Get current app settings
 */
export function getSettings(): Settings {
  return { ...currentSettings };
}

/**
 * Update app settings
 */
export function updateSettings(updates: Partial<Settings>): Settings {
  currentSettings = {
    ...currentSettings,
    ...updates,
  };
  return { ...currentSettings };
}

/**
 * Get all fiscal years
 */
export function getFiscalYears(): FiscalYear[] {
  return [...mockFiscalYears].sort((a, b) => b.year - a.year);
}

/**
 * Get fiscal year by ID
 */
export function getFiscalYearById(id: string): FiscalYear | undefined {
  return mockFiscalYears.find(fy => fy.id === id);
}

/**
 * Create a new fiscal year
 */
export function createFiscalYear(year: number): FiscalYear {
  const newFiscalYear: FiscalYear = {
    id: `fy-${year}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    year,
    created_at: new Date().toISOString(),
  };
  mockFiscalYears.push(newFiscalYear);
  return newFiscalYear;
}

/**
 * Get current fiscal year
 */
export function getCurrentFiscalYear(): FiscalYear | undefined {
  return getFiscalYearById(currentSettings.fiscal_year_id);
}
