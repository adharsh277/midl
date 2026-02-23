export const MIDL_ESCROW_ABI = [
  {
    type: 'function',
    name: 'registerEscrow',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'escrowId', type: 'string' },
      { name: 'amountSats', type: 'uint256' },
      { name: 'btcReceiver', type: 'string' },
    ],
    outputs: [],
  },
] as const;

export function getMidlEscrowAddress(): `0x${string}` {
  const address = process.env.NEXT_PUBLIC_MIDL_ESCROW_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error('NEXT_PUBLIC_MIDL_ESCROW_CONTRACT_ADDRESS is not set');
  }
  return address as `0x${string}`;
}
