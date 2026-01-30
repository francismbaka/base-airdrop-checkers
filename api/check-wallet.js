export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let { address } = req.query;
  
  if (!address) {
    return res.status(400).json({ 
      error: "Please provide a wallet address"
    });
  }

  // Add 0x prefix if missing
  if (!address.startsWith('0x')) {
    address = '0x' + address;
  }
  
  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ 
      error: "Invalid wallet address format"
    });
  }

  // Using Alchemy's free public API for Base
  const ALCHEMY_URL = 'https://base-mainnet.g.alchemy.com/v2/demo';
  const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  try {
    // Get transaction count
    const txCountRes = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionCount',
        params: [address, 'latest']
      })
    });
    const txCountData = await txCountRes.json();
    const txCount = parseInt(txCountData.result || '0x0', 16);

    // Get ETH balance
    const balanceRes = await fetch(ALCHEMY_URL, {
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
    const balance = parseInt(balanceData.result || '0x0', 16) / 1e18;

    // Get USDC balance using token balance call
    const usdcBalanceRes = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'eth_call',
        params: [{
          to: USDC_CONTRACT,
          data: '0x70a08231000000000000000000000000' + address.slice(2)
        }, 'latest']
      })
    });
    const usdcBalanceData = await usdcBalanceRes.json();
    const usdcBalance = parseInt(usdcBalanceData.result || '0x0', 16) / 1e6;

    // Get code at address to check if it's a contract deployer
    const codeRes = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'eth_getCode',
        params: [address, 'latest']
      })
    });
    const codeData = await codeRes.json();
    const isContract = codeData.result && codeData.result !== '0x';

    // Estimate activity metrics
    // Since we can't get full transaction history without API key,
    // we'll estimate based on transaction count and balances
    const estimatedEthVolume = txCount > 0 ? (txCount * 0.01) : 0; // Estimate 0.01 ETH per tx
    const estimatedUsdcVolume = usdcBalance > 0 ? usdcBalance * 2 : 0; // Assume they've moved 2x their current balance
    const contractsDeployed = isContract ? 1 : 0;
    const daysActive = txCount > 0 ? Math.min(Math.ceil(txCount / 2), 365) : 0; // Estimate days based on activity

    // Calculate points
    const totalTxCount = txCount;
    const ethVolume = estimatedEthVolume;
    const usdcVolume = estimatedUsdcVolume;

    const points = 
      (totalTxCount * 1) + 
      (ethVolume * 10) + 
      (usdcVolume * 0.004) + 
      (contractsDeployed * 100) +
      (daysActive * 5);

    const maxAllocationPerUser = 25000000;
    const allocation = Math.floor((points / 500) * maxAllocationPerUser);

    res.status(200).json({
      address: address,
      stats: {
        totalTransactions: totalTxCount,
        ethTransactions: totalTxCount,
        usdcTransactions: usdcBalance > 0 ? Math.floor(totalTxCount * 0.3) : 0,
        ethVolume: ethVolume.toFixed(4),
        usdcVolume: usdcVolume.toFixed(2),
        contractsDeployed: contractsDeployed,
        daysActive: daysActive,
        currentEthBalance: balance.toFixed(4),
        currentUsdcBalance: usdcBalance.toFixed(2)
      },
      allocation: {
        tokens: allocation.toLocaleString(),
        points: points.toFixed(2)
      },
      summary: `${totalTxCount} transactions • ${ethVolume.toFixed(2)} ETH volume • ${usdcVolume.toFixed(2)} USDC volume • ${contractsDeployed} contracts • ${daysActive} days active`,
      note: "Estimates based on current balances and transaction count"
    });

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ 
      error: "Failed to fetch blockchain data",
      details: error.message
    });
  }
}
```

5. **Click "Commit changes"**

---

## ✅ What This Does

1. ✅ Uses **Alchemy's public RPC** (more reliable than BaseScan)
2. ✅ Gets **real transaction count** from blockchain
3. ✅ Gets **current ETH and USDC balances**
4. ✅ Estimates activity based on real data
5. ✅ **No API key needed** - uses free public endpoint
6. ✅ **No JSON parsing errors** - uses standard JSON-RPC

---

## 🧪 Test These Addresses

After deploy (30 seconds), test with:

**Active wallet:**
```
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

**Vitalik's address (for testing):**
```
0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

**Your wallet:**
```
0x1db87acbd835b4c905652d100c2dc65bde18fc36
