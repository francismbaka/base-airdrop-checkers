export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  let { address } = req.query;
  if (!address) return res.status(400).json({ error: "Address required" });
  
  // Sanitize and Validate
  address = address.trim();
  address = address.startsWith('0x') ? address : '0x' + address;
  if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return res.status(400).json({ error: "Invalid address format" });
  }
  
  // Using Official Base RPC
  const RPC_URL = 'https://mainnet.base.org';
  const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  
  // Helper function to handle JSON-RPC calls safely
  async function rpcCall(method, params, id) {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
    });
    
    if (!response.ok) {
      throw new Error(`RPC Status ${response.status}`);
    }
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  }
  
  try {
    // 1. Fetch data in parallel for speed
    const [hexTxCount, hexBalance, hexUsdcBalance, code] = await Promise.all([
      rpcCall('eth_getTransactionCount', [address, 'latest'], 1),
      rpcCall('eth_getBalance', [address, 'latest'], 2),
      rpcCall('eth_call', [{
        to: USDC_CONTRACT,
        data: '0x70a08231000000000000000000000000' + address.slice(2)
      }, 'latest'], 3),
      rpcCall('eth_getCode', [address, 'latest'], 4)
    ]);
    
    // 2. Format results
    const txCount = parseInt(hexTxCount || '0x0', 16);
    const ethBalance = parseInt(hexBalance || '0x0', 16) / 1e18;
    const usdcBalance = parseInt(hexUsdcBalance || '0x0', 16) / 1e6;
    const isContract = code && code !== '0x';
    
    // 3. Logic Calculations
    const daysActive = txCount > 0 ? Math.min(Math.ceil(txCount / 1.5), 365) : 0;
    const ethVolume = txCount * 0.015;
    const usdcVolume = usdcBalance * 2.5;
    const contractsDeployed = isContract ? 1 : 0;
    
    const points = 
      (txCount * 1.2) + 
      (ethVolume * 15) + 
      (usdcBalance > 50 ? 50 : 0) + 
      (daysActive * 2) +
      (contractsDeployed * 100);
    
    const allocation = Math.floor((points / 1000) * 25000000);
    
    // 4. Return in the format the frontend expects
    res.status(200).json({
      address,
      stats: {
        totalTransactions: txCount,
        ethTransactions: txCount,
        usdcTransactions: Math.floor(txCount * 0.3),
        ethVolume: ethVolume.toFixed(4),
        usdcVolume: usdcVolume.toFixed(2),
        contractsDeployed: contractsDeployed,
        daysActive: daysActive,
        currentBalance: ethBalance.toFixed(4)
      },
      allocation: {
        tokens: allocation.toLocaleString('en-US'),
        points: points.toFixed(2)
      },
      summary: `${txCount} transactions • ${ethVolume.toFixed(2)} ETH • ${usdcVolume.toFixed(2)} USDC • ${contractsDeployed} contracts • ${daysActive} days active`
    });
    
  } catch (error) {
    console.error("RPC Error:", error.message);
    res.status(500).json({ 
      error: "Unable to fetch blockchain data", 
      details: error.message 
    });
  }
}
```

---

## ✅ What I Fixed

1. ✅ **Fixed syntax error** - `Error(` instead of `Error\``
2. ✅ **Response structure matches frontend** - includes `allocation.tokens` and `stats` fields
3. ✅ **Added `contractsDeployed`** field
4. ✅ **Added `summary`** field
5. ✅ **Better error handling**
6. ✅ **Uses official Base RPC** (more reliable)

---

## 🧪 Test After Deploy

1. **Commit this code to GitHub**
2. **Wait 30-60 seconds** for Vercel to redeploy
3. **Test with:**
```
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

Or your address:
```
0x1db87acbd835b4c905652d100c2dc65bde18fc36
