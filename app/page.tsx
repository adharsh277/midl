'use client';

import Link from 'next/link';
import { useXverseWallet } from '@/lib/hooks/useXverseWallet';
import { useEscrowStore } from '@/lib/store/escrow';
import { formatSats } from '@/lib/utils';
import { EscrowConfig } from '@/types';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-blue-100 text-blue-800',
  'ready-to-unlock': 'bg-green-100 text-green-700',
  released: 'bg-gray-100 text-gray-600',
  expired: 'bg-red-100 text-red-700',
};

function EscrowRow({ escrow }: { escrow: EscrowConfig }) {
  const statusLabel = escrow.status.replace(/-/g, ' ');
  const statusCls = STATUS_STYLES[escrow.status] ?? 'bg-gray-100 text-gray-600';

  return (
    <Link href={`/escrow/${escrow.id}`} className="block group">
      <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white hover:border-bitcoin-500 hover:shadow-md transition-all duration-150">
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-2xl">{escrow.unlockType === 'timelock' ? '⏳' : '👥'}</span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {escrow.unlockType === 'timelock' ? 'Timelock Escrow' : 'Dual-Approval Escrow'}
            </p>
            <p className="text-sm text-gray-500 truncate">
              To: {escrow.receiverAddress.slice(0, 8)}…{escrow.receiverAddress.slice(-6)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-sm font-mono text-gray-700">{formatSats(escrow.amount)}</span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusCls}`}>
            {statusLabel}
          </span>
          {escrow.status === 'ready-to-unlock' && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-600 text-white animate-pulse">
              Action needed
            </span>
          )}
          <span className="text-gray-400 group-hover:text-bitcoin-500 transition-colors">→</span>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const { wallet, connect, loading } = useXverseWallet();
  const { getAllEscrows } = useEscrowStore();
  const escrows = getAllEscrows();

  /* ── Not connected ─────────────────────────────────────── */
  if (!wallet.isConnected) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 py-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="text-6xl">🔐</div>
          <h1 className="text-4xl font-extrabold text-gray-900">Bitcoin Smart Escrow</h1>
          <p className="text-gray-500 text-lg">
            Lock funds on-chain with timelock or dual-approval conditions — no custodian, fully verifiable.
          </p>
        </div>

        {/* Connect CTA */}
        <div className="rounded-2xl border-2 border-dashed border-bitcoin-500 bg-orange-50 p-8 text-center space-y-4">
          <p className="text-gray-700 font-medium">Connect your Xverse wallet to get started</p>
          <button
            onClick={connect}
            disabled={loading}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-bitcoin-500 hover:bg-bitcoin-600 text-white font-bold text-lg shadow-md disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M21 18v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            )}
            Connect Xverse Wallet
          </button>
          <p className="text-xs text-gray-400">Requires the <a href="https://www.xverse.app" target="_blank" rel="noopener noreferrer" className="underline">Xverse browser extension</a></p>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ['⏳', 'Timelock', 'Funds unlock at a block height via OP_CLTV'],
            ['👥', 'Dual-Approval', '2-of-2 multisig — both parties sign to release'],
            ['🔌', 'Xverse Native', 'Sign PSBTs directly in your wallet extension'],
            ['✅', 'On-chain', 'All transactions verifiable on Mempool.space'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="flex gap-3 p-4 rounded-xl border border-gray-200 bg-white">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="font-semibold text-gray-800">{title}</p>
                <p className="text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Testnet notice */}
        <p className="text-center text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg py-2 px-4">
          ⚠️ Testnet4 only — get free tBTC from the{' '}
          <a href="https://mempool.space/testnet4/faucet" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Mempool faucet</a>
        </p>
      </div>
    );
  }

  /* ── Connected ──────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {escrows.length === 0 ? 'No escrows yet' : `${escrows.length} escrow${escrows.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-bitcoin-500 hover:bg-bitcoin-600 text-white font-semibold shadow transition-colors"
        >
          + Create Escrow
        </Link>
      </div>

      {/* Escrow list */}
      {escrows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center space-y-3">
          <div className="text-5xl">📭</div>
          <p className="text-gray-600 font-medium">No escrows yet</p>
          <p className="text-gray-400 text-sm">Create your first escrow to lock funds with on-chain conditions</p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 mt-2 px-6 py-2.5 rounded-xl bg-bitcoin-500 hover:bg-bitcoin-600 text-white font-semibold transition-colors"
          >
            Create First Escrow →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {escrows.map((e) => (
            <EscrowRow key={e.id} escrow={e} />
          ))}
        </div>
      )}

      {/* Testnet notice */}
      <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg py-2 px-4">
        ⚠️ Testnet4 only — get free tBTC from the{' '}
        <a href="https://mempool.space/testnet4/faucet" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Mempool faucet</a>
      </p>
    </div>
  );
}
