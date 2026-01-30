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

  // Try without API key first (public endpoint)
  const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  try {
    // Use the basic API endpoint without API key
    const ethUrl = `https://api.basescan.org/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc`;
    
    console.log('Fetching:', ethUrl);
    
    const ethRes = await fetch(ethUrl);
    const ethText = await ethRes.text(); // Get as text first to debug
    
    console.log('Response status:', ethRes.status);
    console.log('Response preview:', ethText.substring(0, 200));
    
    let ethData;
    try {
      ethData = JSON.parse(ethText);
    } catch (parseError) {
      return res.status(500).json({ 
        error: "BaseScan returned invalid response",
        details: "API might be down or rate limited",
        preview: ethText.substring(0, 100)
      });
    }

    // Check for API errors
    if (ethData.status === "0") {
      // No transactions found is OK
      if (ethData.message === "No transactions found" || ethData.result === "No transactions found") {
        return res.status(200).json({
          address: address,
          stats: {
            totalTransactions: 0,
            ethTransactions: 0,
            usdcTransactions: 0,
            ethVolume: "0.0000",
            usdcVolume: "0.00",
            contractsDeployed: 0,
            daysActive: 0
          },
          allocation: {
            tokens: "0",
            points: "0.00"
          },
          summary: "No activity found on Base network"
        });
      }
      
      return res.status(400).json({ 
        error: ethData.message || "Could not fetch data",
        result: ethData.result
      });
    }

    // Fetch USDC transactions
    const usdcUrl = `https://api.basescan.org/api?module=account&action=tokentx&contractaddress=${USDC_CONTRACT}&address=${address}&startblock=0&endblock=99999999&sort=asc`;
    
    const usdcRes = await fetch(usdcUrl);
    const usdcText = await usdcRes.text();
    
    let usdcData;
    try {
      usdcData = JSON.parse(usdcText);
    } catch (e) {
      // If USDC fetch fails, just continue with 0 USDC
      usdcData = { status: "0", result: [] };
    }

    const ethTxs = (ethData.status === "1" && Array.isArray(ethData.result)) ? ethData.result : [];
    const usdcTxs = (usdcData.status === "1" && Array.isArray(usdcData.result)) ? usdcData.result : [];
    const totalTxCount = ethTxs.length + usdcTxs.length;
    
    const ethVolume = ethTxs.reduce((sum, tx) => sum + (Number(tx.value) / 1e18), 0);
    const usdcVolume = usdcTxs.reduce((sum, tx) => sum + (Number(tx.value) / 1e6), 0);
    const contractsDeployed = ethTxs.filter(tx => !tx.to || tx.to === "").length;
    
    let daysActive = 0;
    if (ethTxs.length > 0) {
      const firstTx = ethTxs[0];
      const lastTx = ethTxs[ethTxs.length - 1];
      const firstDate = new Date(Number(firstTx.timeStamp) * 1000);
      const lastDate = new Date(Number(lastTx.timeStamp) * 1000);
      const diffTime = Math.abs(lastDate - firstDate);
      daysActive = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const points = (totalTxCount * 1) + (ethVolume * 10) + (usdcVolume * 0.004) + (contractsDeployed * 100) + (daysActive * 5);
    const maxAllocationPerUser = 25000000;
    const allocation = Math.floor((points / 500) * maxAllocationPerUser);

    res.status(200).json({
      address: address,
      stats: {
        totalTransactions: totalTxCount,
        ethTransactions: ethTxs.length,
        usdcTransactions: usdcTxs.length,
        ethVolume: ethVolume.toFixed(4),
        usdcVolume: usdcVolume.toFixed(2),
        contractsDeployed: contractsDeployed,
        daysActive: daysActive
      },
      allocation: {
        tokens: allocation.toLocaleString(),
        points: points.toFixed(2)
      },
      summary: `${totalTxCount} transactions • ${ethVolume.toFixed(2)} ETH • ${usdcVolume.toFixed(2)} USDC • ${contractsDeployed} contracts • ${daysActive} days active`
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

## ✅ What This Does Differently

1. ✅ Uses the **standard API endpoint** (more reliable)
2. ✅ Reads response as **text first** to catch errors
3. ✅ **Better error messages** showing what went wrong
4. ✅ Works **without API key** (uses public endpoint)
5. ✅ Continues even if USDC data fails

---

## 🧪 Test After Deploy

Wait 30 seconds, then test with:
```
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
