import { Chain } from 'viem';

const DEFAULT_CHAIN_NAME = 'midl';
const DEFAULT_CURRENCY_NAME = 'BTC';
const DEFAULT_CURRENCY_SYMBOL = 'BTC';

export function getMidlRpcUrl(): string {
  const url = process.env.NEXT_PUBLIC_MIDL_RPC_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_MIDL_RPC_URL is not set');
  }
  return url;
}

export function getMidlChain(): Chain {
  const chainId = Number(process.env.NEXT_PUBLIC_MIDL_CHAIN_ID);
  if (!Number.isFinite(chainId)) {
    throw new Error('NEXT_PUBLIC_MIDL_CHAIN_ID is not set');
  }

  return {
    id: chainId,
    name: process.env.NEXT_PUBLIC_MIDL_CHAIN_NAME || DEFAULT_CHAIN_NAME,
    nativeCurrency: {
      name: process.env.NEXT_PUBLIC_MIDL_NATIVE_CURRENCY_NAME || DEFAULT_CURRENCY_NAME,
      symbol: process.env.NEXT_PUBLIC_MIDL_NATIVE_CURRENCY_SYMBOL || DEFAULT_CURRENCY_SYMBOL,
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [getMidlRpcUrl()],
      },
    },
  };
}
