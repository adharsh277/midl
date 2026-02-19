/**
 * Create Escrow Page
 */

'use client';

import { CreateEscrowForm } from '@/components/CreateEscrowForm';
import { WalletConnect } from '@/components/WalletConnect';
import { Card } from '@/components/ui';
import { useXverseWallet } from '@/lib/hooks/useXverseWallet';

export default function CreatePage() {
  const { wallet } = useXverseWallet();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">🔐 Create New Escrow</h1>
        <p className="text-gray-600">Set up a new Bitcoin escrow with your conditions</p>
      </div>

      {!wallet.isConnected && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Step 1: Connect Wallet</h2>
          <WalletConnect />
        </div>
      )}

      {wallet.isConnected && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2">
            <CreateEscrowForm />
          </div>

          {/* Info Card */}
          <div>
            <Card title="💡 How It Works">
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Timelock Escrow</h4>
                  <p className="text-gray-700">
                    Funds lock until a specific block height is reached, then can be claimed by using
                    OP_CHECKLOCKTIMEVERIFY.
                  </p>
                </div>

                <hr />

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Dual Approval</h4>
                  <p className="text-gray-700">
                    Creates a 2-of-2 multisig. Both buyer and seller must sign the redeem
                    transaction.
                  </p>
                </div>

                <hr />

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Script Generation</h4>
                  <p className="text-gray-700">
                    Click "Generate Escrow Script" to create your Bitcoin script. You'll get an
                    escrow address to fund.
                  </p>
                </div>

                <hr />

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Funding</h4>
                  <p className="text-gray-700">
                    Send your desired amount of BTC to the escrow address. Once confirmed, the
                    escrow becomes "active".
                  </p>
                </div>
              </div>
            </Card>

            <Card title="⚠️ Important" className="mt-6 border-yellow-200 bg-yellow-50">
              <ul className="text-sm text-gray-700 space-y-2">
                <li>• Always test with small amounts first</li>
                <li>• Double-check recipient addresses</li>
                <li>• Keep your script hex for records</li>
                <li>• Funds cannot be recovered if sent to a wrong address</li>
                <li>• You need enough balance to cover fees</li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
