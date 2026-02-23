'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useXverseWallet } from '@/lib/hooks/useXverseWallet';
import { useMidlRegister } from '@/lib/hooks/useMidlRegister';
import { CreateEscrowForm } from '@/components/CreateEscrowForm';
import { FundEscrowForm } from '@/components/FundEscrowForm';
import { PollingDetector } from '@/components/PollingDetector';
import { createEscrowAddress } from '@/lib/bitcoin/address';
import { formatSats, getMempoolAddressLink, getMempoolLink, getMidlTxLink } from '@/lib/utils';
import { EscrowConfig } from '@/types';

type Step = 'create' | 'fund' | 'confirm';

const STEPS: { id: Step; label: string }[] = [
  { id: 'create', label: '1. Configure' },
  { id: 'fund', label: '2. Fund' },
  { id: 'confirm', label: '3. Confirm' },
];

export default function CreatePage() {
  const { wallet, connect, loading: walletLoading } = useXverseWallet();
  const { registerEscrow, loading: midlLoading, error: midlError, clearError } = useMidlRegister();
  const [step, setStep] = useState<Step>('create');
  const [escrow, setEscrow] = useState<EscrowConfig | null>(null);
  const [fundingTxid, setFundingTxid] = useState<string | null>(null);
  const [midlTxHash, setMidlTxHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const escrowAddress = useMemo(() => {
    if (!escrow?.scriptHex) return null;
    try {
      return createEscrowAddress(Buffer.from(escrow.scriptHex, 'hex'));
    } catch {
      return null;
    }
  }, [escrow?.scriptHex]);

  const handleCopy = () => {
    if (!escrowAddress) return;
    navigator.clipboard.writeText(escrowAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleEscrowCreated = (created: EscrowConfig) => {
    setEscrow(created);
    setStep('fund');
  };

  const handleFunded = (txid: string) => {
    setFundingTxid(txid);
    setStep('confirm');
  };

  const handleRegisterMidl = async () => {
    if (!escrow) return;

    try {
      clearError();
      const result = await registerEscrow({
        escrowId: escrow.id,
        amountSats: escrow.amount,
        btcReceiver: escrow.receiverAddress,
      });

      if (result) {
        setMidlTxHash(result.hash);
      }
    } catch (error) {
      // Error is already set in the hook state
      console.error('Midl registration error:', error);
    }
  };

  /* ── Not connected ── */
  if (!wallet.isConnected) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-12">
        <div className="text-5xl">🔌</div>
        <h1 className="text-2xl font-bold text-gray-900">Connect Your Wallet</h1>
        <p className="text-gray-500">You need to connect your Xverse wallet before creating an escrow.</p>
        <button
          onClick={connect}
          disabled={walletLoading}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-bitcoin-500 hover:bg-bitcoin-600 text-white font-bold shadow-md disabled:opacity-60 transition-colors"
        >
          {walletLoading ? 'Connecting…' : 'Connect Xverse Wallet'}
        </button>
        <p className="text-sm">
          <Link href="/" className="text-gray-400 hover:text-gray-600 underline">← Back to Dashboard</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create Escrow</h1>
        <p className="text-gray-500 text-sm mt-1">Configure conditions, fund, and confirm on-chain</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const isDone = STEPS.findIndex((x) => x.id === step) > i;
          const isActive = s.id === step;
          return (
            <div key={s.id} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-bitcoin-500 text-white'
                    : isDone
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isDone ? '✓' : i + 1}. {s.label.split('. ')[1]}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${isDone ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Configure ── */}
      {step === 'create' && (
        <CreateEscrowForm onSuccess={handleEscrowCreated} />
      )}

      {/* ── Step 2: Fund ── */}
      {step === 'fund' && escrow && escrowAddress && (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <h2 className="font-bold text-lg text-gray-900">Fund Your Escrow</h2>
            <p className="text-gray-500 text-sm">
              Send <strong>{formatSats(escrow.amount)}</strong> to the escrow address below.
              You can use the button to trigger Xverse directly, or copy the address and send manually.
            </p>

            {/* Address display */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Escrow Address (P2SH)</p>
              <p className="font-mono text-sm break-all text-gray-800">{escrowAddress}</p>
              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="text-xs font-semibold text-bitcoin-500 hover:text-bitcoin-600 underline"
                >
                  {copied ? '✓ Copied!' : 'Copy address'}
                </button>
                <a
                  href={getMempoolAddressLink(escrowAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-blue-500 hover:underline"
                >
                  View on explorer →
                </a>
              </div>
            </div>

            {/* What type of escrow */}
            <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3">
              {escrow.unlockType === 'timelock' ? (
                <>⏳ Timelock escrow — unlocks at block <strong>{escrow.unlockTime}</strong></>
              ) : (
                <>👥 Dual-approval escrow — requires 2-of-2 signatures to release</>
              )}
            </div>
          </div>

          {/* Fund via Xverse */}
          <FundEscrowForm
            escrowId={escrow.id}
            escrowAddress={escrowAddress}
            expectedAmount={escrow.amount}
            onFunded={handleFunded}
          />

          <button
            onClick={() => setStep('confirm')}
            className="text-sm text-gray-400 hover:text-gray-600 underline block text-center"
          >
            Already sent? Skip to confirmation →
          </button>
        </div>
      )}

      {/* ── Step 3: Confirm ── */}
      {step === 'confirm' && escrow && escrowAddress && (
        <div className="space-y-5">
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
            <h2 className="font-bold text-lg text-green-900">⏳ Waiting for Confirmation</h2>
            <p className="text-green-800 text-sm">
              Your funding transaction is being monitored. The escrow will activate once the transaction is confirmed on-chain.
            </p>
            {fundingTxid && (
              <a
                href={getMempoolLink(fundingTxid)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-blue-600 hover:underline break-all"
              >
                View transaction on explorer →
              </a>
            )}
          </div>

          <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 space-y-3">
            <h3 className="font-bold text-orange-900">Register Escrow on Midl</h3>
            <p className="text-orange-800 text-sm">
              This sends a lightweight registration transaction to Midl so judges can verify on-chain execution.
            </p>
            {midlTxHash && (
              <div className="text-sm text-orange-800 break-all space-y-1">
                <p>
                  Midl Tx Hash: <span className="font-mono">{midlTxHash}</span>
                </p>
                {getMidlTxLink(midlTxHash) && (
                  <a
                    href={getMidlTxLink(midlTxHash) as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View on Midl explorer →
                  </a>
                )}
              </div>
            )}
            {midlError && <p className="text-sm text-red-600">{midlError}</p>}
            <button
              onClick={handleRegisterMidl}
              disabled={midlLoading}
              className="w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 transition-colors disabled:opacity-60"
            >
              {midlLoading ? 'Registering...' : 'Register Escrow on Midl'}
            </button>
          </div>

          <PollingDetector
            escrowAddress={escrowAddress}
            expectedAmount={escrow.amount}
            onFunded={() => {}}
            enabled
            showDetails
          />

          <div className="flex gap-3">
            <Link
              href={`/escrow/${escrow.id}`}
              className="flex-1 text-center px-5 py-3 rounded-xl bg-bitcoin-500 hover:bg-bitcoin-600 text-white font-semibold transition-colors"
            >
              View Escrow Detail →
            </Link>
            <Link
              href="/"
              className="px-5 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

