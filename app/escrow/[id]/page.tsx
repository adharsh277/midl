/**
 * Escrow Detail Page
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useEscrowStore } from '@/lib/store/escrow';
import { useXverseWallet } from '@/lib/hooks/useXverseWallet';
import { mempoolClient } from '@/lib/bitcoin/mempool';
import { Card, Button, Alert, Badge, Modal, Spinner } from '@/components/ui';
import {
  formatSats,
  getStatusDisplay,
  getMempoolLink,
  getTimeRemaining,
} from '@/lib/utils';
import Link from 'next/link';
import { createEscrowAddress } from '@/lib/bitcoin/address';

export default function EscrowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const escrowId = params?.id as string;

  const { getEscrow, updateEscrow } = useEscrowStore();
  const { wallet, signPsbt } = useXverseWallet();

  const [escrow, setEscrow] = useState(getEscrow(escrowId));
  // loading state is used by refreshEscrowStatus spinner in future; suppressed for now
  const [_loading, _setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockHeight, setBlockHeight] = useState(0);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [_redeemTxid, setRedeemTxid] = useState<string | undefined>(escrow?.redeemTxid);

  useEffect(() => {
    if (!escrow) {
      router.push('/');
      return;
    }

    refreshEscrowStatus();

    const interval = setInterval(refreshEscrowStatus, 30000);
    return () => clearInterval(interval);
  }, [escrowId]);

  const refreshEscrowStatus = async () => {
    try {
      // Fetch current block height
      const height = await mempoolClient.getBlockHeight();
      setBlockHeight(height);

      // Check if transaction is confirmed
      if (escrow?.fundingTxid && escrow.status === 'pending') {
        const confirmed = await mempoolClient.isTransactionConfirmed(escrow.fundingTxid);
        if (confirmed) {
          updateEscrow(escrowId, { status: 'active' });
          setEscrow({ ...escrow, status: 'active' });
        }
      }

      // Check if ready to unlock
      if (escrow?.status === 'active') {
        let readyToUnlock = false;

        if (escrow.unlockType === 'timelock' && escrow.unlockTime) {
          readyToUnlock = height >= escrow.unlockTime;
        } else if (escrow.unlockType === 'dual-approval') {
          readyToUnlock = !!(escrow.buyerSigned && escrow.sellerSigned);
        }

        if (readyToUnlock) {
          updateEscrow(escrowId, { status: 'ready-to-unlock' });
          setEscrow((prev) => (prev ? { ...prev, status: 'ready-to-unlock' } : null));
        }
      }
    } catch {
      // Silently fail
    }
  };

  const handleUnlock = async () => {
    if (!escrow || !wallet.isConnected) return;

    try {
      setUnlockLoading(true);
      setError(null);
if (!escrow.scriptHex) {
        throw new Error('Missing escrow redeem script — cannot build unlock transaction');
      }

      // ── 1. Re-derive escrow P2SH address from the stored script hex ──────────
      const redeemScriptBuf = Buffer.from(escrow.scriptHex, 'hex');
      const escrowAddress = createEscrowAddress(redeemScriptBuf);

      // ── 2. Fetch UTXOs at the escrow address ──────────────────────────────────
      const utxos = await mempoolClient.getUTXOs(escrowAddress);
      if (!utxos.length) {
        throw new Error('No unspent outputs at escrow address — may already be spent or not yet funded');
      }

      // Prefer the UTXO from the known funding txid, otherwise pick the first
      const utxo =
        (escrow.fundingTxid
          ? utxos.find((u) => u.txid === escrow.fundingTxid)
          : undefined) ?? utxos[0];

      // ── 3. Fetch the full raw funding transaction for nonWitnessUtxo ──────────
      const MEMPOOL = process.env.NEXT_PUBLIC_MEMPOOL_API || 'https://mempool.space/testnet4/api';
      const txHexRes = await fetch(`${MEMPOOL}/tx/${utxo.txid}/hex`);
      if (!txHexRes.ok) throw new Error('Failed to fetch funding transaction hex');
      const fundingTxHex = await txHexRes.text();

      // ── 4. Build PSBT ─────────────────────────────────────────────────────────
      const btc = await import('bitcoinjs-lib');
      const TESTNET = btc.networks.testnet;
      const FEE = 1000; // 1000 sats — safe for testnet

      const psbt = new btc.Psbt({ network: TESTNET });

      const isTimelock = escrow.unlockType === 'timelock' && !!escrow.unlockTime;
      if (isTimelock && escrow.unlockTime) {
        psbt.setLocktime(escrow.unlockTime);
      }

      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        sequence: isTimelock ? 0xfffffffe : 0xffffffff,
        nonWitnessUtxo: Buffer.from(fundingTxHex, 'hex'),
        redeemScript: redeemScriptBuf,
      });
      psbt.addOutput({
        address: escrow.receiverAddress,
        value: utxo.value - FEE,
      });

      // ── 5. Ask Xverse to sign the PSBT ────────────────────────────────────────
      const psbtBase64 = psbt.toBase64();
      const { psbtBase64: signedBase64 } = await signPsbt(
        psbtBase64,
        [{ address: wallet.address, signingIndexes: [0] }],
        false, // don't broadcast yet — we want to finalize manually
      );

      // ── 6. Finalize: inject the P2SH scriptSig and extract raw tx ─────────────
      const signedPsbt = btc.Psbt.fromBase64(signedBase64, { network: TESTNET });
      const input = signedPsbt.data.inputs[0];
      const partialSig = input.partialSig?.[0];
      if (!partialSig) throw new Error('Xverse returned no signature');

      // Build P2SH scriptSig: <sig> <redeemScript>
      const scriptSig = btc.script.compile([partialSig.signature, redeemScriptBuf]);

      signedPsbt.finalizeInput(0, () => ({
        finalScriptSig: scriptSig,
        finalScriptWitness: undefined,
      }));

      const rawTxHex = signedPsbt.extractTransaction().toHex();

      // ── 7. Broadcast ──────────────────────────────────────────────────────────
      const broadcastRes = await fetch('/api/escrow/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHex: rawTxHex }),
      });

      const broadcastData = await broadcastRes.json();
      if (!broadcastRes.ok) {
        throw new Error(broadcastData.error || 'Broadcast failed');
      }

      const txid: string = broadcastData.txid;

      // ── 8. Update state ───────────────────────────────────────────────────────
      const now = Math.floor(Date.now() / 1000);
      updateEscrow(escrowId, { status: 'released', unlockedAt: now, redeemTxid: txid });
      setEscrow((prev) =>
        prev ? { ...prev, status: 'released', unlockedAt: now, redeemTxid: txid } : null,
      );
      setRedeemTxid(txid);
      setShowUnlockModal(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to unlock escrow');
    } finally {
      setUnlockLoading(false);
    }
  };

  if (!escrow) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner className="w-12 h-12" />
      </div>
    );
  }

  const statusDisplay = getStatusDisplay(escrow.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">📋 Escrow Details</h1>
          <p className="text-gray-600 font-mono">{escrow.id}</p>
        </div>
        <Link href="/">
          <Button variant="secondary">← Back</Button>
        </Link>
      </div>

      {/* Status Alert */}
      <Alert type={escrow.status === 'released' ? 'success' : 'info'}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>{statusDisplay.icon}</span>
            <strong>{statusDisplay.label}</strong>
          </span>
          {escrow.status === 'ready-to-unlock' && (
            <Button variant="success" size="sm" onClick={() => setShowUnlockModal(true)}>
              🔓 Unlock Now
            </Button>
          )}
        </div>
      </Alert>

      {/* Error */}
      {error && <Alert type="error">{error}</Alert>}

      {/* Main Details */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card title="💰 Amount & Recipient">
          <div className="space-y-4">
            <div>
              <p className="text-gray-600 text-sm">Amount</p>
              <p className="text-3xl font-bold text-blue-600">{formatSats(escrow.amount)}</p>
              <p className="text-xs text-gray-500">{escrow.amount.toLocaleString()} sats</p>
            </div>

            <hr />

            <div>
              <p className="text-gray-600 text-sm">Receiver Address</p>
              <p className="font-mono text-sm break-all">{escrow.receiverAddress}</p>
            </div>

            <div>
              <p className="text-gray-600 text-sm">Locker Address</p>
              <p className="font-mono text-sm break-all">{escrow.locker}</p>
            </div>
          </div>
        </Card>

        <Card title="🔐 Unlock Conditions">
          <div className="space-y-4">
            <div>
              <p className="text-gray-600 text-sm mb-2">Unlock Type</p>
              <Badge color={escrow.unlockType === 'timelock' ? 'blue' : 'purple'}>
                {escrow.unlockType === 'timelock' ? '⏳ Timelock' : '👥 Dual Approval'}
              </Badge>
            </div>

            {escrow.unlockType === 'timelock' && escrow.unlockTime && (
              <>
                <hr />
                <div>
                  <p className="text-gray-600 text-sm">Unlock Block Height</p>
                  <p className="text-xl font-bold">{escrow.unlockTime.toLocaleString()}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Current: {blockHeight.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">{getTimeRemaining(blockHeight, escrow.unlockTime)}</p>
                </div>
              </>
            )}

            {escrow.unlockType === 'dual-approval' && (
              <>
                <hr />
                <div>
                  <p className="text-gray-600 text-sm mb-3">Approvals</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Buyer:</span>
                      <Badge color={escrow.buyerSigned ? 'green' : 'red'}>
                        {escrow.buyerSigned ? '✅ Signed' : '⏳ Pending'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Seller:</span>
                      <Badge color={escrow.sellerSigned ? 'green' : 'red'}>
                        {escrow.sellerSigned ? '✅ Signed' : '⏳ Pending'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <hr />

                <div>
                  <p className="text-gray-600 text-sm">Buyer Address</p>
                  <p className="font-mono text-xs break-all">{escrow.buyerAddress}</p>
                </div>

                <div>
                  <p className="text-gray-600 text-sm">Seller Address</p>
                  <p className="font-mono text-xs break-all">{escrow.sellerAddress}</p>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Transactions */}
      <Card title="🔗 Transactions">
        <div className="space-y-4">
          {escrow.fundingTxid && (
            <div>
              <p className="text-gray-600 text-sm mb-2">Funding Transaction</p>
              <a
                href={getMempoolLink(escrow.fundingTxid)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:underline break-all"
              >
                {escrow.fundingTxid}
              </a>
              <p className="text-xs text-gray-500 mt-1">
                {escrow.status === 'pending' ? '⏳ Awaiting confirmation' : '✅ Confirmed'}
              </p>
            </div>
          )}

          {!escrow.fundingTxid && (
            <Alert type="warning">
              No funding transaction yet. Send BTC to the escrow P2SH address to fund this escrow.
            </Alert>
          )}

          {escrow.redeemTxid && (
            <div className="pt-4 border-t">
              <p className="text-gray-600 text-sm mb-2">Redeem Transaction</p>
              <a
                href={getMempoolLink(escrow.redeemTxid)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:underline break-all"
              >
                {escrow.redeemTxid}
              </a>
            </div>
          )}
        </div>
      </Card>

      {/* Script */}
      {escrow.scriptHex && (
        <Card title="📝 Bitcoin Script">
          <div>
            <p className="text-gray-600 text-sm mb-2">Hex-encoded Script</p>
            <div className="bg-gray-100 p-3 rounded font-mono text-xs break-all overflow-x-auto">
              {escrow.scriptHex}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Keep this script hex for your records. It defines the unlock conditions.
            </p>
          </div>
        </Card>
      )}

      {/* Timeline */}
      <Card title="📅 Timeline">
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white">
                ✓
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Created</p>
              <p className="text-sm text-gray-600">
                {new Date(escrow.createdAt * 1000).toLocaleString()}
              </p>
            </div>
          </div>

          {escrow.unlockedAt && (
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-600 text-white">
                  ✓
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Released</p>
                <p className="text-sm text-gray-600">
                  {new Date(escrow.unlockedAt * 1000).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Unlock Modal */}
      <Modal
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        title="🔓 Unlock Escrow"
      >
        <div className="space-y-4">
          <Alert type="info">
            This will send the funds to the recipient address. Make sure all conditions are met.
          </Alert>

          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600 mb-1">Amount to send:</p>
            <p className="font-bold text-lg">{formatSats(escrow.amount)}</p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="success"
              className="flex-1"
              onClick={handleUnlock}
              isLoading={unlockLoading}
            >
              {unlockLoading ? 'Processing...' : 'Confirm Unlock'}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowUnlockModal(false)}
              disabled={unlockLoading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
