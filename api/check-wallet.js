export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { address } = req.query;
  
  if (!address) {
    return res.status(400).json({ 
      error: "Please provide a wallet address",
      example: "?address=0x123..."
    });
  }
  
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ 
      error: "Invalid wallet address format",
      hint: "Address must start with 0x and be 42 characters long"
    });
  }

  const API_KEY = process.env.BASESCAN_API_KEY || 'JHPSPADURZKEPAUJMAPSS2P2VV38ITP9Z2';
  const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  try {
    const [ethRes, usdcRes] = await Promise.all([
      fetch(`https://api.basescan.org/api?module=account&action=txlist&address=${address}&sort=asc&apikey=${API_KEY}`),
      fetch(`https://api.basescan.org/api?module=account&action=tokentx&contractaddress=${USDC_CONTRACT}&address=${address}&sort=asc&apikey=${API_KEY}`)
    ]);

    const ethData = await ethRes.json();
    const usdcData = await usdcRes.json();

    if (ethData.status !== "1") {
      return res.status(400).json({ 
        error: ethData.message || "Could not fetch data from BaseScan" 
      });
    }

    const ethTxs = ethData.result || [];
    const usdcTxs = usdcData.result || [];

    const totalTxCount = ethTxs.length + usdcTxs.length;
    
    const ethVolume = ethTxs.reduce((sum, tx) => {
      return sum + (Number(tx.value) / 1e18);
    }, 0);
    
    const usdcVolume = usdcTxs.reduce((sum, tx) => {
      return sum + (Number(tx.value) / 1e6);
    }, 0);
    
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
