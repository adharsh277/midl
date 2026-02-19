/**
 * Create Escrow Form Component
 */

'use client';

import { useState } from 'react';
import { Button, Card, Input, Select, Alert } from './ui';
import { isValidBitcoinAddress, isValidAmount, generateEscrowId, btcToSats } from '@/lib/utils';
import { buildTimelockScript, buildMultisigScript } from '@/lib/bitcoin/scripts';
import { createEscrowAddress } from '@/lib/bitcoin/address';
import { useXverseWallet } from '@/lib/hooks/useXverseWallet';
import { useEscrowStore } from '@/lib/store/escrow';
import { EscrowConfig } from '@/types';

export interface CreateEscrowFormProps {
  onSuccess?: (escrow: EscrowConfig) => void;
}

export function CreateEscrowForm({ onSuccess }: CreateEscrowFormProps) {
  const { wallet, sendBitcoin } = useXverseWallet();
  const { addEscrow } = useEscrowStore();

  const [formData, setFormData] = useState({
    receiverAddress: '',
    amountBtc: '',
    unlockType: 'timelock' as 'timelock' | 'dual-approval',
    unlockBlockHeight: '850000',
    buyerAddress: '',
    sellerAddress: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generatedEscrow, setGeneratedEscrow] = useState<{
    id: string;
    escrowAddress: string;
    script: string;
    fundingTxid?: string;
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
      setLoading(true);

      const escrowId = generateEscrowId();
      let script: Buffer;

      if (formData.unlockType === 'timelock') {
        const unlockTime = parseInt(formData.unlockBlockHeight);
        script = buildTimelockScript(unlockTime, wallet.publicKey);
      } else {
        script = buildMultisigScript(formData.buyerAddress, formData.sellerAddress);
      }

      const scriptHex = script.toString('hex');
      const escrowAddress = createEscrowAddress(script);

      const amountSats = btcToSats(parseFloat(formData.amountBtc));

      // Store in state
      const escrow: EscrowConfig = {
        id: escrowId,
        fundingTxid: '',
        receiverAddress: formData.receiverAddress,
        amount: amountSats,
        unlockType: formData.unlockType,
        locker: wallet.address,
        unlockTime:
          formData.unlockType === 'timelock' ? parseInt(formData.unlockBlockHeight) : undefined,
        buyerAddress: formData.unlockType === 'dual-approval' ? formData.buyerAddress : undefined,
        sellerAddress: formData.unlockType === 'dual-approval' ? formData.sellerAddress : undefined,
        status: 'pending',
        createdAt: Math.floor(Date.now() / 1000),
        scriptHex,
      };

      addEscrow(escrow);

      // Fund the escrow address via Xverse wallet (user confirms in the popup)
      let fundingTxid: string | undefined;
      try {
        fundingTxid = await sendBitcoin(escrowAddress, amountSats);
        // Update store with confirmed txid
        useEscrowStore.getState().updateEscrow(escrowId, { fundingTxid });
      } catch (sendErr: any) {
        // User may have cancelled – still show the escrow address so they can fund manually
        console.warn('Send cancelled or failed:', sendErr?.message);
      }

      setGeneratedEscrow({
        id: escrowId,
        escrowAddress,
        script: scriptHex,
        fundingTxid,
      });
      setSuccess(true);
      onSuccess?.({ ...escrow, fundingTxid: fundingTxid ?? '' });
    } catch (error: any) {
      setErrors({ submit: error?.message || 'Failed to generate script' });
    } finally {
      setLoading(false);
    }
  };

  if (success && generatedEscrow) {
    const mempoolLink = generatedEscrow.fundingTxid
      ? `https://mempool.space/testnet/tx/${generatedEscrow.fundingTxid}`
      : null;

    return (
      <Card title="✅ Escrow Created" className="bg-green-50 border-green-200">
        <div className="space-y-4">
          {generatedEscrow.fundingTxid ? (
            <Alert type="success">
              Escrow funded! Transaction broadcast to Bitcoin testnet.
            </Alert>
          ) : (
            <Alert type="info">
              Script generated. Send BTC to <strong>{generatedEscrow.escrowAddress}</strong> to fund the escrow.
            </Alert>
          )}

          <div className="bg-gray-50 p-4 rounded border border-gray-300 space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1"><strong>Escrow ID:</strong></p>
              <p className="font-mono text-sm break-all">{generatedEscrow.id}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1"><strong>Escrow Address (P2SH):</strong></p>
              <p className="font-mono text-sm break-all">{generatedEscrow.escrowAddress}</p>
            </div>

            {generatedEscrow.fundingTxid && (
              <div>
                <p className="text-sm text-gray-600 mb-1"><strong>Funding Transaction:</strong></p>
                <p className="font-mono text-xs break-all text-blue-700">{generatedEscrow.fundingTxid}</p>
                {mempoolLink && (
                  <a
                    href={mempoolLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline text-xs"
                  >
                    View on mempool.space ↗
                  </a>
                )}
              </div>
            )}

            <div>
              <p className="text-sm text-gray-600 mb-1"><strong>Redeem Script (Hex):</strong></p>
              <p className="font-mono text-xs break-all text-gray-500">{generatedEscrow.script}</p>
            </div>
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
    <Card title="🔐 Create New Escrow">
      <div className="space-y-4">
        {errors.submit && <Alert type="error">{errors.submit}</Alert>}

        <Input
          label="Receiver Address"
          placeholder="tb1q..."
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
              placeholder="tb1q..."
              value={formData.buyerAddress}
              onChange={(e) => setFormData({ ...formData, buyerAddress: e.target.value })}
              error={errors.buyerAddress}
            />
            <Input
              label="Seller Address"
              placeholder="tb1q..."
              value={formData.sellerAddress}
              onChange={(e) => setFormData({ ...formData, sellerAddress: e.target.value })}
              error={errors.sellerAddress}
            />
          </>
        )}

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleGenerateScript}
          isLoading={loading}
          disabled={!wallet.isConnected}
        >
          {!wallet.isConnected ? 'Connect Wallet First' : 'Generate Escrow Script'}
        </Button>
      </div>
    </Card>
  );
}
