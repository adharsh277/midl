/**
 * Mock Xverse SDK for development
 * Simulates wallet functionality without the actual @xverse/sdk package
 */

declare global {
  interface Window {
    xverseProviders?: any;
  }
}

// Mock implementation for development
export const initXverseMock = () => {
  if (typeof window !== 'undefined' && !window.xverseProviders) {
    window.xverseProviders = {
      request: async (params: any) => {
        const { method } = params;

        // Mock addresses for testing
        const mockAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
        const mockPublicKey =
          '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

        switch (method) {
          case 'btc_requestAccounts':
            return [
              {
                address: mockAddress,
                publicKey: mockPublicKey,
              },
            ];

          case 'btc_getBalance':
            return {
              amount: 5000000, // 0.05 BTC
            };

          case 'btc_signMessage':
            return {
              signature: 'mock_signature_' + Math.random().toString(36).substring(6),
            };

          case 'btc_signPsbt':
            return {
              psbt: params.psbt,
            };

          case 'btc_sendTransfer':
            return {
              txid: 'mock_txid_' + Math.random().toString(36).substring(6),
            };

          default:
            return null;
        }
      },
    };
  }
};

// Initialize on module load
if (typeof window !== 'undefined') {
  initXverseMock();
}
