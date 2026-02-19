/**
 * Home / Landing Page
 */

'use client';

import { WalletConnect } from '@/components/WalletConnect';
import { EscrowList } from '@/components/EscrowList';
import { Card, Button } from '@/components/ui';
import { useXverseWallet } from '@/lib/hooks/useXverseWallet';
import { useEscrowStore } from '@/lib/store/escrow';
import Link from 'next/link';

export default function Home() {
  const { wallet } = useXverseWallet();
  const { getAllEscrows } = useEscrowStore();
  const escrows = getAllEscrows();

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 shadow-lg">
        <div className="max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            🔐 Bitcoin Smart Escrow
          </h2>
          <p className="text-blue-100 text-lg mb-6">
            Create programmable escrows with timelock or dual-approval conditions. Lock Bitcoin funds
            securely without a custodian. All transactions are verifiable on-chain.
          </p>
          <div className="flex gap-3">
            {wallet.isConnected && (
              <Link href="/create">
                <Button variant="primary" className="bg-white text-blue-600 hover:bg-blue-50">
                  Create Escrow →
                </Button>
              </Link>
            )}
            <a href="#features" className="inline-block">
              <Button variant="secondary" className="bg-blue-100 text-blue-900 hover:bg-blue-200">
                Learn More
              </Button>
            </a>
          </div>
        </div>
      </Card>

      {/* Wallet Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4">👛 Wallet Connection</h2>
        <WalletConnect />
      </section>

      {/* Features Section */}
      <section id="features">
        <h2 className="text-2xl font-bold mb-4">✨ Features</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <div className="flex gap-4">
              <div className="text-4xl">⏳</div>
              <div>
                <h3 className="font-bold text-lg mb-2">Time-based Unlock</h3>
                <p className="text-gray-600">
                  Lock funds with OP_CHECKLOCKTIMEVERIFY. Funds unlock automatically after a
                  specified block height.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex gap-4">
              <div className="text-4xl">👥</div>
              <div>
                <h3 className="font-bold text-lg mb-2">Dual Approval</h3>
                <p className="text-gray-600">
                  Create 2-of-2 multisig escrows. Both parties must sign to release funds. Perfect
                  for buyer-seller agreements.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex gap-4">
              <div className="text-4xl">🔌</div>
              <div>
                <h3 className="font-bold text-lg mb-2">Xverse Integration</h3>
                <p className="text-gray-600">
                  Connect your Xverse wallet seamlessly. Sign transactions directly from the
                  extension.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex gap-4">
              <div className="text-4xl">✅</div>
              <div>
                <h3 className="font-bold text-lg mb-2">On-chain Verification</h3>
                <p className="text-gray-600">
                  All escrow transactions are broadcast to Bitcoin Testnet and verifiable via
                  Mempool.space.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Escrows Section */}
      {wallet.isConnected && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">📋 Your Escrows</h2>
            {escrows.length > 0 && (
              <Link href="/create">
                <Button variant="primary" size="sm">
                  + New Escrow
                </Button>
              </Link>
            )}
          </div>
          <EscrowList escrows={escrows} />
        </section>
      )}

      {/* Getting Started Section */}
      <section className="bg-blue-50 rounded-lg p-8 border border-blue-200">
        <h2 className="text-2xl font-bold mb-4">🚀 Quick Start</h2>
        <ol className="space-y-3 ml-4">
          <li className="flex gap-3">
            <span className="font-bold text-blue-600">1.</span>
            <span>Connect your Xverse wallet by clicking the button above</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-blue-600">2.</span>
            <span>Click "Create Escrow" to set up a new escrow with your conditions</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-blue-600">3.</span>
            <span>Send BTC to the generated escrow address to fund it</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-blue-600">4.</span>
            <span>
              Once funded, your escrow appears on the dashboard with status updates
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-blue-600">5.</span>
            <span>When conditions are met, click "Unlock" to redeem the funds</span>
          </li>
        </ol>
      </section>

      {/* Test Network Notice */}
      <section className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
        <p className="text-yellow-800">
          <strong>⚠️ Testnet Only:</strong> This application uses Bitcoin Testnet. You can get free
          testnet BTC from a{' '}
          <a
            href="https://mempool.space/testnet/faucet"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold"
          >
            faucet
          </a>
          .
        </p>
      </section>
    </div>
  );
}
