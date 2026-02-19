/**
 * Utility Functions
 */

/**
 * Convert satoshis to BTC
 */
export function satsToBtc(sats: number): number {
  return sats / 100_000_000;
}

/**
 * Convert BTC to satoshis
 */
export function btcToSats(btc: number): number {
  return Math.round(btc * 100_000_000);
}

/**
 * Format satoshis for display
 */
export function formatSats(sats: number): string {
  const btc = satsToBtc(sats);
  return btc.toFixed(8).replace(/\.?0+$/, '');
}

/**
 * Format address for display (shorten)
 */
export function formatAddress(address: string, chars: number = 6): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.substring(0, chars)}...${address.substring(address.length - chars)}`;
}

/**
 * Format transaction ID
 */
export function formatTxid(txid: string): string {
  return formatAddress(txid, 8);
}

/**
 * Generate escrow ID (UUID-like, but simpler)
 */
export function generateEscrowId(): string {
  return `esc_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get status color and label
 */
export function getStatusDisplay(status: string): {
  color: string;
  label: string;
  icon: string;
} {
  const statusMap: Record<
    string,
    {
      color: string;
      label: string;
      icon: string;
    }
  > = {
    pending: {
      color: 'bg-yellow-100 text-yellow-800',
      label: 'Pending',
      icon: '⏳',
    },
    active: {
      color: 'bg-blue-100 text-blue-800',
      label: 'Active',
      icon: '🔒',
    },
    'ready-to-unlock': {
      color: 'bg-green-100 text-green-800',
      label: 'Ready to Unlock',
      icon: '✅',
    },
    released: {
      color: 'bg-purple-100 text-purple-800',
      label: 'Released',
      icon: '🔓',
    },
  };

  return statusMap[status] || { color: 'bg-gray-100 text-gray-800', label: status, icon: '❓' };
}

/**
 * Get mempool link for transaction
 */
export function getMempoolLink(txid: string): string {
  const base = process.env.NEXT_PUBLIC_MEMPOOL_API?.replace('/api', '') ?? 'https://mempool.space/testnet4';
  return `${base}/tx/${txid}`;
}

/**
 * Get mempool link for address
 */
export function getMempoolAddressLink(address: string): string {
  const base = process.env.NEXT_PUBLIC_MEMPOOL_API?.replace('/api', '') ?? 'https://mempool.space/testnet4';
  return `${base}/address/${address}`;
}

/**
 * Convert timestamp to readable date
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

/**
 * Calculate time remaining for timelock
 */
export function getTimeRemaining(currentBlock: number, unlockBlock: number): string {
  const blocksRemaining = Math.max(0, unlockBlock - currentBlock);
  if (blocksRemaining === 0) return 'Ready to unlock';
  return `${blocksRemaining} blocks remaining (~${(blocksRemaining * 10).toLocaleString()} minutes)`;
}

/**
 * Validate Bitcoin address format
 */
export function isValidBitcoinAddress(address: string): boolean {
  // Testnet P2PKH (m, n), P2SH (2), P2WPKH/P2WSH (tb1)
  return /^[mn2]|^tb1/.test(address);
}

/**
 * Validate satoshi amount (positive integer)
 */
export function isValidAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0;
}

/**
 * Create mock escrow data for testing
 */
export function createMockEscrow() {
  return {
    id: generateEscrowId(),
    fundingTxid: '0000000000000000000000000000000000000000000000000000000000000000',
    receiverAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    amount: 1_000_000,
    unlockType: 'timelock' as const,
    status: 'active' as const,
    createdAt: Date.now(),
    locker: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kf3wmux',
    unlockTime: 850000,
  };
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
