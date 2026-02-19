/**
 * Escrow State Store (Zustand)
 * Manages all escrow-related application state
 */

import { create } from 'zustand';
import { EscrowConfig } from '../../types';

interface EscrowStore {
  // State
  escrows: Record<string, EscrowConfig>;
  selectedEscrowId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  addEscrow: (escrow: EscrowConfig) => void;
  updateEscrow: (id: string, updates: Partial<EscrowConfig>) => void;
  removeEscrow: (id: string) => void;
  selectEscrow: (id: string | null) => void;
  getEscrow: (id: string) => EscrowConfig | null;
  getAllEscrows: () => EscrowConfig[];
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useEscrowStore = create<EscrowStore>((set, get) => ({
  // Initial state
  escrows: {},
  selectedEscrowId: null,
  loading: false,
  error: null,

  // Actions
  addEscrow: (escrow: EscrowConfig) =>
    set((state) => ({
      escrows: {
        ...state.escrows,
        [escrow.id]: escrow,
      },
      selectedEscrowId: escrow.id,
    })),

  updateEscrow: (id: string, updates: Partial<EscrowConfig>) =>
    set((state) => ({
      escrows: {
        ...state.escrows,
        [id]: {
          ...state.escrows[id],
          ...updates,
        },
      },
    })),

  removeEscrow: (id: string) =>
    set((state) => {
      const { [id]: _, ...rest } = state.escrows;
      return {
        escrows: rest,
        selectedEscrowId: state.selectedEscrowId === id ? null : state.selectedEscrowId,
      };
    }),

  selectEscrow: (id: string | null) =>
    set({ selectedEscrowId: id }),

  getEscrow: (id: string) => {
    const escrow = get().escrows[id];
    return escrow || null;
  },

  getAllEscrows: () => {
    return Object.values(get().escrows);
  },

  setLoading: (loading: boolean) =>
    set({ loading }),

  setError: (error: string | null) =>
    set({ error }),

  clear: () =>
    set({
      escrows: {},
      selectedEscrowId: null,
      loading: false,
      error: null,
    }),
}));
