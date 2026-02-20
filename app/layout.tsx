/**
 * Root Layout
 */

import { Metadata } from 'next';
import './globals.css';
import { NavBar } from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Bitcoin Smart Escrow',
  description: 'Bitcoin-native escrow with timelock and dual-approval — Testnet4',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body className="min-h-screen bg-gray-50">
        <NavBar />
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="mt-16 py-6 border-t border-gray-200 bg-white">
          <p className="text-center text-xs text-gray-500">
            Bitcoin Smart Escrow · Testnet4 · bitcoinjs-lib + sats-connect · No custodian, no trust
          </p>
        </footer>
      </body>
    </html>
  );
}
