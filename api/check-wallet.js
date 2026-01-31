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

  // Test multiple RPC endpoints
  const RPC_ENDPOINTS = [
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base-rpc.publicnode.com'
  ];

  for (const RPC_URL of RPC_ENDPOINTS) {
    try {
      const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getTransactionCount',
          params: [address, 'latest']
        })
      });

      const text = await response.text();
      
      // Log what we got
      console.log(`Testing ${RPC_URL}:`, {
        status: response.status,
        contentType: response.headers.get('content-type'),
        preview: text.substring(0, 100)
      });

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.log(`${RPC_URL} returned non-JSON:`, text.substring(0, 200));
        continue; // Try next endpoint
      }

      if (data.error) {
        console.log(`${RPC_URL} returned error:`, data.error);
        continue;
      }

      // Success! This endpoint works
      const txCount = parseInt(data.result || '0x0', 16);

      // Now get balance with working endpoint
      const balanceRes = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'eth_getBalance',
          params: [address, 'latest']
        })
      });

      const balanceData = await balanceRes.json();
      const ethBalance = parseInt(balanceData.result || '0x0', 16) / 1e18;

      // Calculate simple stats
      const daysActive = txCount > 0 ? Math.min(Math.ceil(txCount / 1.5), 365) : 0;
      const ethVolume = txCount * 0.015;
      const points = (txCount * 1.2) + (ethVolume * 15) + (daysActive * 2);
      const allocation = Math.floor((points / 1000) * 25000000);

      return res.status(200).json({
        success: true,
        rpcUsed: RPC_URL,
        address,
        stats: {
          totalTransactions: txCount,
          ethTransactions: txCount,
          usdcTransactions: Math.floor(txCount * 0.2),
          ethVolume: ethVolume.toFixed(4),
          usdcVolume: "0.00",
          contractsDeployed: 0,
          daysActive: daysActive,
          currentBalance: ethBalance.toFixed(4)
        },
        allocation: {
          tokens: allocation.toLocaleString('en-US'),
          points: points.toFixed(2)
        },
        summary: `${txCount} transactions • ${ethVolume.toFixed(2)} ETH • ${daysActive} days active`
      });

    } catch (error) {
      console.error(`${RPC_URL} failed:`, error.message);
      continue; // Try next endpoint
    }
  }

  // If all endpoints failed
  return res.status(500).json({
    error: "All RPC endpoints failed",
    details: "Unable to connect to Base network. Please try again later.",
    testedEndpoints: RPC_ENDPOINTS
  });
}
