export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  let { address } = req.query;
  if (!address) return res.status(400).json({ error: "Address required" });
  
  address = address.trim();
  address = address.startsWith('0x') ? address : '0x' + address;
  if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return res.status(400).json({ error: "Invalid address format" });
  }

  // Working RPC endpoints
  const RPC_ENDPOINTS = [
    'https://base.llamarpc.com',
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org'
  ];

  const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  // Helper function for RPC calls with fallback
  async function tryRpcCall(method, params, id, optional = false) {
    for (const RPC_URL of RPC_ENDPOINTS) {
      try {
        const response = await fetch(RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (!response.ok) {
          if (optional) return null;
          continue;
        }

        const text = await response.text();
        
        // Check if response is JSON
        if (!text.startsWith('{')) {
          if (optional) return null;
          continue;
        }

        const data = JSON.parse(text);
        
        if (data.error) {
          if (optional) return null;
          continue;
        }

        return data.result;
      } catch (error) {
        if (optional) return null;
        continue;
      }
    }
    
    if (optional) return null;
    throw new Error(`All RPC endpoints failed for ${
