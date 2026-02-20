/**
 * Escrow Detail Page
 */

'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useEscrowStore } from '@/lib/store/escrow';
import { useXverseWallet } from '@/lib/hooks/useXverseWallet';
import { mempoolClient } from '@/lib/bitcoin/mempool';
import { Spinner } from '@/components/ui';
import {
  formatSats,
  getMempoolLink,
  getMempoolAddressLink,
} from '@/lib/utils';
import Link from 'next/link';
import { createEscrowAddress } from '@/lib/bitcoin/address';
import { FundEscrowForm } from '@/components/FundEscrowForm';
import { PollingDetector } from '@/components/PollingDetector';

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
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [_redeemTxid, setRedeemTxid] = useState<string | undefined>(escrow?.redeemTxid);
  const [copied, setCopied] = useState(false);

  // Derive the P2SH escrow address from stored script hex — once, at component level
  const escrowAddress = useMemo(() => {
    if (!escrow?.scriptHex) return null;
    try {
      return createEscrowAddress(Buffer.from(escrow.scriptHex, 'hex'));
    } catch {
      return null;
    }
  }, [escrow?.scriptHex]);

  const copyAddress = useCallback(() => {
    if (!escrowAddress) return;
    navigator.clipboard.writeText(escrowAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [escrowAddress]);

  const refreshEscrowStatus = useCallback(async () => {
    // Always read the latest escrow from store to avoid stale closure
    const currentEscrow = getEscrow(escrowId);
    if (!currentEscrow) return;

    try {
      // Fetch current block height
      const height = await mempoolClient.getBlockHeight();
      setBlockHeight(height);

      // Check if funding tx is confirmed
      if (currentEscrow.fundingTxid && currentEscrow.status === 'pending') {
        const confirmed = await mempoolClient.isTransactionConfirmed(currentEscrow.fundingTxid);
        if (confirmed) {
          updateEscrow(escrowId, { status: 'active' });
          setEscrow((prev) => (prev ? { ...prev, status: 'active' } : null));
        }
      }

      // Check if timelock is expired → ready to unlock
      if (currentEscrow.status === 'active') {
        let readyToUnlock = false;

        if (currentEscrow.unlockType === 'timelock' && currentEscrow.unlockTime) {
          readyToUnlock = height >= currentEscrow.unlockTime;
        } else if (currentEscrow.unlockType === 'dual-approval') {
          readyToUnlock = !!(currentEscrow.buyerSigned && currentEscrow.sellerSigned);
        }

        if (readyToUnlock) {
          updateEscrow(escrowId, { status: 'ready-to-unlock' });
          setEscrow((prev) => (prev ? { ...prev, status: 'ready-to-unlock' } : null));
        }
      }
    } catch {
      // Silently fail — status will be refreshed next tick
    }
  }, [escrowId, getEscrow, updateEscrow]);

  useEffect(() => {
    if (!escrow) {
      router.push('/');
      return;
    }

    refreshEscrowStatus();

    const interval = setInterval(refreshEscrowStatus, 30000);
    return () => clearInterval(interval);
  }, [escrowId, refreshEscrowStatus]);

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
      const resolvedEscrowAddress = escrowAddress ?? createEscrowAddress(redeemScriptBuf);

      // ── 2. Fetch UTXOs at the escrow address ──────────────────────────────────
      const utxos = await mempoolClient.getUTXOs(resolvedEscrowAddress);
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

      // Build P2SH scriptSig for CLTV: <sig> <redeemScript>
      // (pubkey is embedded in the redeemScript itself — do NOT push it separately)
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
    } catch (err: any) {
      setError(err?.message || 'Failed to unlock escrow');
    } finally {
      setUnlockLoading(false);
    }
  };

  if (!escrow) {
    return (
      <div className="flex justify-center items-center py-24">
        <Spinner className="w-12 h-12" />
      </div>
    );
  }

  const isTimelock = escrow.unlockType === 'timelock';
  const blocksLeft = isTimelock && escrow.unlockTime && blockHeight
    ? escrow.unlockTime - blockHeight
    : null;

  /* ── Status banner config ── */
  const bannerCfg: Record<string, { bg: string; label: string; icon: string }> = {
    pending:          { bg: 'bg-yellow-50 border-yellow-300 text-yellow-900', label: 'Pending Funding', icon: '🟡' },
    active:           { bg: 'bg-blue-50 border-blue-300 text-blue-900', label: 'Active — Waiting for Conditions', icon: '🔵' },
    'ready-to-unlock':{ bg: 'bg-green-50 border-green-400 text-green-900', label: 'Ready to Unlock!', icon: '🟢' },
    released:         { bg: 'bg-gray-50 border-gray-300 text-gray-700', label: 'Released', icon: '✅' },
    expired:          { bg: 'bg-red-50 border-red-300 text-red-900', label: 'Expired', icon: '🔴' },
  };
  const banner = bannerCfg[escrow.status] ?? bannerCfg.pending;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {isTimelock ? '⏳' : '👥'}
            {isTimelock ? 'Timelock Escrow' : 'Dual-Approval Escrow'}
          </h1>
          <p className="font-mono text-xs text-gray-400 mt-1 break-all">{escrow.id}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize shrink-0 ml-4 mt-1 border ${banner.bg}`}>
          {banner.icon} {banner.label}
        </span>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          ⚠️ {error}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          STATUS-DRIVEN ACTION PANELS
      ════════════════════════════════════════════════════ */}

      {/* PENDING: no funding yet — show address + fund form */}
      {escrow.status === 'pending' && !escrow.fundingTxid && escrowAddress && (
        <div className="space-y-4">
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 space-y-3">
            <h2 className="font-bold text-yellow-900">Step 2 — Fund the Escrow</h2>
            <p className="text-yellow-800 text-sm">
              Send exactly <strong>{formatSats(escrow.amount)}</strong> to the P2SH address below to activate this escrow.
            </p>
            <div className="rounded-lg bg-white border border-yellow-300 p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Escrow Address</p>
              <p className="font-mono text-sm break-all text-gray-800">{escrowAddress}</p>
              <div className="flex gap-3">
                <button
                  onClick={copyAddress}
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
                  View on Mempool →
                </a>
              </div>
            </div>
          </div>
          <FundEscrowForm
            escrowId={escrow.id}
            escrowAddress={escrowAddress}
            expectedAmount={escrow.amount}
            onFunded={(txid) => {
              updateEscrow(escrowId, { fundingTxid: txid });
              setEscrow((prev) => (prev ? { ...prev, fundingTxid: txid } : null));
            }}
          />
        </div>
      )}

      {/* PENDING: funded but awaiting confirmation — show polling */}
      {escrow.status === 'pending' && escrow.fundingTxid && escrowAddress && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-2">
            <h2 className="font-bold text-blue-900">Waiting for On-chain Confirmation</h2>
            <p className="text-blue-800 text-sm">Your transaction has been broadcast. The escrow will activate once it gets confirmed.</p>
            <a
              href={getMempoolLink(escrow.fundingTxid)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-blue-600 hover:underline break-all"
            >
              View transaction on Mempool →
            </a>
          </div>
          <PollingDetector
            escrowAddress={escrowAddress}
            expectedAmount={escrow.amount}
            enabled
            showDetails
            onFunded={() => {
              updateEscrow(escrowId, { status: 'active' });
              setEscrow((prev) => (prev ? { ...prev, status: 'active' } : null));
            }}
          />
        </div>
      )}

      {/* ACTIVE: show conditions + block progress for timelock */}
      {escrow.status === 'active' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3">
          <h2 className="font-bold text-blue-900">Active — Waiting for Unlock Conditions</h2>
          {isTimelock && escrow.unlockTime ? (
            <>
              <p className="text-blue-800 text-sm">
                Funds lock until block <strong>{escrow.unlockTime.toLocaleString()}</strong>.
              </p>
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <p className="text-gray-500">Current block</p>
                  <p className="font-bold text-lg text-gray-800">{blockHeight.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Unlock block</p>
                  <p className="font-bold text-lg text-gray-800">{escrow.unlockTime.toLocaleString()}</p>
                </div>
                {blocksLeft !== null && (
                  <div>
                    <p className="text-gray-500">Blocks remaining</p>
                    <p className={`font-bold text-lg ${blocksLeft <= 0 ? 'text-green-600' : 'text-gray-800'}`}>
                      {blocksLeft <= 0 ? '0 (unlockable)' : blocksLeft.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2 text-sm text-blue-800">
              <p>This is a dual-approval escrow. Both parties must sign to release funds.</p>
              <div className="flex gap-6">
                <span>{escrow.buyerSigned ? '✅' : '⏳'} Buyer signature</span>
                <span>{escrow.sellerSigned ? '✅' : '⏳'} Seller signature</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* READY TO UNLOCK — prominent CTA */}
      {escrow.status === 'ready-to-unlock' && (
        <div className="rounded-xl border-2 border-green-400 bg-green-50 p-6 space-y-4 text-center">
          <div className="text-5xl">🔓</div>
          <h2 className="font-bold text-2xl text-green-900">Ready to Unlock!</h2>
          <p className="text-green-800 text-sm">
            {isTimelock
              ? 'The timelock has expired. You can now unlock and redeem the funds.'
              : 'Both parties have signed. You can now release the funds.'}
          </p>
          <button
            onClick={handleUnlock}
            disabled={unlockLoading || !wallet.isConnected}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-lg shadow-md disabled:opacity-60 transition-colors"
          >
            {unlockLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" />
                </svg>
                Processing…
              </>
            ) : (
              '🔓 Unlock & Redeem Funds'
            )}
          </button>
          {!wallet.isConnected && (
            <p className="text-xs text-red-600">Wallet not connected — reconnect to proceed</p>
          )}
        </div>
      )}

      {/* RELEASED */}
      {escrow.status === 'released' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3 text-center">
          <div className="text-4xl">✅</div>
          <h2 className="font-bold text-xl text-gray-800">Funds Released</h2>
          {escrow.redeemTxid && (
            <a
              href={getMempoolLink(escrow.redeemTxid)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-blue-600 hover:underline break-all"
            >
              View redeem transaction →
            </a>
          )}
          <p className="text-sm text-gray-500">
            Released at {escrow.unlockedAt
              ? new Date(escrow.unlockedAt * 1000).toLocaleString()
              : '—'}
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          DETAILS
      ════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        <Row label="Amount" value={<span className="font-bold text-bitcoin-500">{formatSats(escrow.amount)}</span>} />
        <Row label="Receiver" value={<Mono>{escrow.receiverAddress}</Mono>} />
        <Row label="Locker" value={<Mono>{escrow.locker}</Mono>} />
        <Row label="Type" value={isTimelock ? '⏳ Timelock (OP_CLTV)' : '👥 Dual Approval (2-of-2)'} />
        {isTimelock && escrow.unlockTime && (
          <Row label="Unlock Block" value={escrow.unlockTime.toLocaleString()} />
        )}
        <Row label="Created" value={new Date(escrow.createdAt * 1000).toLocaleString()} />
        {escrow.fundingTxid && (
          <Row
            label="Funding Tx"
            value={
              <a href={getMempoolLink(escrow.fundingTxid)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all text-xs font-mono">
                {escrow.fundingTxid.slice(0, 16)}…{escrow.fundingTxid.slice(-8)}
              </a>
            }
          />
        )}
        {escrow.redeemTxid && (
          <Row
            label="Redeem Tx"
            value={
              <a href={getMempoolLink(escrow.redeemTxid)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all text-xs font-mono">
                {escrow.redeemTxid.slice(0, 16)}…{escrow.redeemTxid.slice(-8)}
              </a>
            }
          />
        )}
      </div>

      {/* Script hex (collapsed) */}
      {escrow.scriptHex && (
        <details className="rounded-xl border border-gray-200 bg-white">
          <summary className="px-4 py-3 font-semibold text-gray-700 cursor-pointer select-none text-sm">
            📝 Bitcoin Script Hex
          </summary>
          <div className="px-4 pb-4">
            <p className="font-mono text-xs break-all bg-gray-50 border border-gray-200 rounded p-3 text-gray-600">
              {escrow.scriptHex}
            </p>
            <p className="text-xs text-gray-400 mt-2">Keep this for your records — it defines the unlock conditions.</p>
          </div>
        </details>
      )}
    </div>
  );
}

/* ── Small helpers ── */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-sm text-gray-500 shrink-0 w-28">{label}</span>
      <span className="text-sm text-gray-900 text-right break-all">{value}</span>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs">{children}</span>;
}

