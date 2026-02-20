/**
 * Global Wallet Store (Zustand)
 * Single source of truth for Xverse wallet connection state.
 * All components that call useXverseWallet() share this state.
 */

import { create } from 'zustand';
import { WalletInfo } from '../../types';

interface WalletStore {
  wallet: WalletInfo;
  loading: boolean;
  error: string | null;

  setWallet: (wallet: WalletInfo) => void;
  updateWallet: (updates: Partial<WalletInfo>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  disconnect: () => void;
}

const INITIAL_WALLET: WalletInfo = {
  address: '',
  publicKey: '',
  balance: 0,
  isConnected: false,
};

export const useWalletStore = create<WalletStore>((set) => ({
  wallet: INITIAL_WALLET,
  loading: false,
  error: null,

  setWallet: (wallet) => set({ wallet }),
  updateWallet: (updates) =>
    set((state) => ({ wallet: { ...state.wallet, ...updates } })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  disconnect: () => set({ wallet: INITIAL_WALLET, error: null }),
}));
