/**
 * Create Escrow Form Component
 * Generate and create Bitcoin escrow contracts
 */

'use client';

import { useState } from 'react';
import { Button, Card, Input, Select, Alert } from './ui';
import { isValidBitcoinAddress, isValidAmount, btcToSats, getMempoolAddressLink } from '@/lib/utils';
import { useXverseWallet } from '@/lib/hooks/useXverseWallet';
import { useEscrowOps } from '@/lib/hooks/useEscrowOps';
import { useEscrowStore } from '@/lib/store/escrow';
import { EscrowConfig } from '@/types';

export interface CreateEscrowFormProps {
  onSuccess?: (escrow: EscrowConfig) => void;
}

export function CreateEscrowForm({ onSuccess }: CreateEscrowFormProps) {
  const { wallet } = useXverseWallet();
  const { createEscrow, loading, error } = useEscrowOps();
  const { updateEscrow } = useEscrowStore();

  const [formData, setFormData] = useState({
    receiverAddress: '',
    amountBtc: '',
    unlockType: 'timelock' as 'timelock' | 'dual-approval',
    unlockBlockHeight: '850000',
    buyerAddress: '',
    sellerAddress: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [generatedEscrow, setGeneratedEscrow] = useState<{
    id: string;
    escrowAddress: string;
    script: string;
    mempoolLink: string;
  } | null>(null);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!isValidBitcoinAddress(formData.receiverAddress)) {
      newErrors.receiverAddress = 'Invalid Bitcoin address';
    }

    const amountBtc = parseFloat(formData.amountBtc);
    if (!isValidAmount(btcToSats(amountBtc))) {
      newErrors.amountBtc = 'Invalid amount (must be positive)';
    }

    if (formData.unlockType === 'timelock') {
      const blockHeight = parseInt(formData.unlockBlockHeight);
      if (!Number.isInteger(blockHeight) || blockHeight <= 0) {
        newErrors.unlockBlockHeight = 'Invalid block height';
      }
    } else {
      if (!isValidBitcoinAddress(formData.buyerAddress)) {
        newErrors.buyerAddress = 'Invalid buyer address';
      }
      if (!isValidBitcoinAddress(formData.sellerAddress)) {
        newErrors.sellerAddress = 'Invalid seller address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGenerateScript = async () => {
    if (!validateForm()) return;
    if (!wallet.publicKey) {
      setErrors({ submit: 'Wallet not connected' });
      return;
    }

    try {
      const amountSats = btcToSats(parseFloat(formData.amountBtc));
      const unlockTime = parseInt(formData.unlockBlockHeight);

      // Build recipient public key for dual-approval
      let recipientPubKey: string | undefined;
      if (formData.unlockType === 'dual-approval') {
        // In a real app, you'd fetch this from the other party
        // For demo, we'll use a placeholder - in production, exchange via backend
        recipientPubKey = wallet.publicKey; // This should be from other party
      }

      // Create escrow using service
      const result = await createEscrow({
        lockerAddress: wallet.address,
        lockerPublicKey: wallet.publicKey,
        receiverAddress: formData.receiverAddress,
        amount: amountSats,
        unlockType: formData.unlockType,
        unlockTime,
        recipientPublicKey: recipientPubKey,
      });

      // Create escrow config for storage
      const escrowConfig: EscrowConfig = {
        id: result.escrowId,
        fundingTxid: '', // Will be filled when funded
        receiverAddress: formData.receiverAddress,
        amount: amountSats,
        unlockType: formData.unlockType,
        locker: wallet.address,
        unlockTime: formData.unlockType === 'timelock' ? unlockTime : undefined,
        status: 'pending',
        createdAt: Math.floor(Date.now() / 1000),
        scriptHex: result.script,
      };

      // The escrow was already added by useEscrowOps.createEscrow()
      // Just update with display info if needed
      updateEscrow(result.escrowId, {
        scriptHex: result.script,
      });

      setGeneratedEscrow({
        id: result.escrowId,
        escrowAddress: result.escrowAddress,
        script: result.script,
        mempoolLink: result.mempoolLink,
      });
      setSuccess(true);
      onSuccess?.(escrowConfig);
    } catch (err: any) {
      setErrors({ submit: err?.message || 'Failed to generate script' });
    }
  };

  if (success && generatedEscrow) {
    return (
      <Card className="bg-green-50 border-green-200 border-2">
        <div className="space-y-4">
          <h3 className="font-bold text-green-900">✅ Escrow Script Generated</h3>

          <Alert type="success">
            Script ready! Send BTC to the escrow address to fund it.
          </Alert>

          <div className="bg-white p-4 rounded border border-green-300 space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Escrow ID</p>
              <p className="font-mono text-sm break-all bg-gray-50 p-2 rounded">
                {generatedEscrow.id}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Escrow Address (P2SH)</p>
              <p className="font-mono text-sm break-all bg-gray-50 p-2 rounded">
                {generatedEscrow.escrowAddress}
              </p>
              <a
                href={getMempoolAddressLink(generatedEscrow.escrowAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs mt-1 inline-block"
              >
                  View address on explorer →
              </a>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Script Hex</p>
              <p className="font-mono text-xs break-all bg-gray-50 p-2 rounded max-h-24 overflow-auto">
                {generatedEscrow.script}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded text-xs text-blue-800">
            Next step: Send Bitcoin to the escrow address above using your Xverse wallet or any wallet.
          </div>

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setSuccess(false);
              setGeneratedEscrow(null);
              setFormData({
                receiverAddress: '',
                amountBtc: '',
                unlockType: 'timelock',
                unlockBlockHeight: '850000',
                buyerAddress: '',
                sellerAddress: '',
              });
            }}
          >
            Create Another Escrow
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4">
        <h3 className="font-bold text-lg">🔐 Create New Escrow</h3>

        {error && <Alert type="error">{error}</Alert>}

        <Input
          label="Receiver Address"
          placeholder="bcrt1..."
          value={formData.receiverAddress}
          onChange={(e) => setFormData({ ...formData, receiverAddress: e.target.value })}
          error={errors.receiverAddress}
        />

        <Input
          label="Amount (BTC)"
          type="number"
          step="0.00000001"
          min="0"
          placeholder="0.1"
          value={formData.amountBtc}
          onChange={(e) => setFormData({ ...formData, amountBtc: e.target.value })}
          error={errors.amountBtc}
        />

        <Select
          label="Unlock Type"
          value={formData.unlockType}
          onChange={(e) =>
            setFormData({ ...formData, unlockType: e.target.value as 'timelock' | 'dual-approval' })
          }
          options={[
            { value: 'timelock', label: '⏳ Time-based (Block Height)' },
            { value: 'dual-approval', label: '👥 Dual Approval (2-of-2 Multisig)' },
          ]}
        />

        {formData.unlockType === 'timelock' && (
          <Input
            label="Unlock Block Height"
            type="number"
            min="0"
            value={formData.unlockBlockHeight}
            onChange={(e) => setFormData({ ...formData, unlockBlockHeight: e.target.value })}
            error={errors.unlockBlockHeight}
          />
        )}

        {formData.unlockType === 'dual-approval' && (
          <>
            <Input
              label="Buyer Address"
              placeholder="bcrt1..."
              value={formData.buyerAddress}
              onChange={(e) => setFormData({ ...formData, buyerAddress: e.target.value })}
              error={errors.buyerAddress}
            />
            <Input
              label="Seller Address"
              placeholder="bcrt1..."
              value={formData.sellerAddress}
              onChange={(e) => setFormData({ ...formData, sellerAddress: e.target.value })}
              error={errors.sellerAddress}
            />
          </>
        )}

        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          onClick={handleGenerateScript}
          disabled={!wallet.isConnected || loading}
        >
          {!wallet.isConnected ? 'Connect Wallet First' : loading ? 'Generating...' : 'Generate Escrow Script'}
        </Button>

        <p className="text-xs text-gray-600">
          💡 Your connected wallet is the locker. Receiver will be able to spend after conditions are met.
        </p>
      </div>
    </Card>
  );
}
