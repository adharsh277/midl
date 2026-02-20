/**
 * NavBar — top navigation with wallet status badge
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useXverseWallet } from '@/lib/hooks/useXverseWallet';
import { formatAddress, formatSats } from '@/lib/utils';
import { useEscrowStore } from '@/lib/store/escrow';

export function NavBar() {
  const pathname = usePathname();
  const { wallet, connect, disconnect, loading } = useXverseWallet();
  const escrowCount = useEscrowStore((s) => Object.keys(s.escrows).length);

  const navLink = (href: string, label: string, badge?: number) => {
    const active = pathname === href || (href !== '/' && pathname.startsWith(href));
    return (
      <Link
        href={href}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          active
            ? 'bg-orange-100 text-orange-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        {label}
        {badge !== undefined && badge > 0 && (
          <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full leading-none">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl">🔐</span>
          <span className="font-bold text-gray-900 hidden sm:block">Bitcoin Escrow</span>
          <span className="text-xs text-orange-600 font-medium bg-orange-50 px-1.5 py-0.5 rounded">
            TESTNET4
          </span>
        </Link>

        {/* Nav links — only when connected */}
        {wallet.isConnected && (
          <nav className="flex items-center gap-1">
            {navLink('/', '📋 Dashboard', escrowCount)}
            {navLink('/create', '➕ Create Escrow')}
          </nav>
        )}

        {/* Wallet badge */}
        <div className="shrink-0">
          {wallet.isConnected ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-right">
                <p className="text-xs text-gray-500 leading-none mb-0.5">{formatAddress(wallet.address, 6)}</p>
                <p className="text-xs font-semibold text-green-700 leading-none">{formatSats(wallet.balance)} BTC</p>
              </div>
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-700 font-medium hidden sm:block">Connected</span>
                <button
                  onClick={disconnect}
                  className="ml-1 text-gray-400 hover:text-red-500 transition-colors text-xs"
                  title="Disconnect wallet"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={loading}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                <>🔌 Connect Wallet</>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
