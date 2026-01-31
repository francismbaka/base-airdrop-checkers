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

  const RPC_ENDPOINTS = [
    'https://base.llamarpc.com',
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org'
  ];

  async function tryRpcCall(method, params, id) {
    for (const RPC_URL of RPC_ENDPOINTS) {
      try {
        const response = await fetch(RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
        });

        const text = await response.text();
        if (!text.startsWith('{')) continue;
        
        const data = JSON.parse(text);
        if (data.error) continue;
        return data.result;
      } catch (error) {
        continue;
      }
    }
    throw new Error(`All RPC endpoints failed for ${method}`);
  }

  try {
    // Get basic blockchain data
    const [hexTxCount, hexBalance, hexNonce] = await Promise.all([
      tryRpcCall('eth_getTransactionCount', [address, 'latest'], 1),
      tryRpcCall('eth_getBalance', [address, 'latest'], 2),
      tryRpcCall('eth_getTransactionCount', [address, 'latest'], 3)
    ]);

    const txCount = parseInt(hexTxCount || '0x0', 16);
    const ethBalance = parseInt(hexBalance || '0x0', 16) / 1e18;
    const nonce = parseInt(hexNonce || '0x0', 16);

    // ========================================
    // NEW METRICS (All work without eth_call)
    // ========================================

    // 1. ACTIVITY LEVEL (based on transaction frequency)
    const activityLevel = txCount === 0 ? 'Inactive' :
                         txCount < 10 ? 'Beginner' :
                         txCount < 50 ? 'Active' :
                         txCount < 200 ? 'Power User' : 'Whale';

    // 2. ESTIMATED DAYS ACTIVE (more accurate formula)
    const daysActive = txCount > 0 ? Math.min(Math.ceil(txCount / 1.5), 365) : 0;

    // 3. AVERAGE TRANSACTIONS PER DAY
    const avgTxPerDay = daysActive > 0 ? (txCount / daysActive).toFixed(2) : '0.00';

    // 4. ESTIMATED ETH VOLUME (based on tx count and balance)
    // Active wallets typically move 10-50x their current balance
    const volumeMultiplier = txCount < 10 ? 5 : txCount < 50 ? 15 : txCount < 200 ? 30 : 50;
    const estimatedEthVolume = (ethBalance * volumeMultiplier) + (txCount * 0.02);

    // 5. ESTIMATED GAS SPENT (average gas per tx on Base)
    // Base gas is cheap: ~0.00001 ETH per transaction
    const estimatedGasSpent = txCount * 0.00001;

    // 6. WALLET AGE ESTIMATE (based on nonce)
    // Older wallets tend to have higher nonces
    const walletAge = nonce > 500 ? 'Veteran (1+ years)' :
                     nonce > 200 ? 'Experienced (6+ months)' :
                     nonce > 50 ? 'Regular (3+ months)' :
                     nonce > 10 ? 'New (1+ month)' : 'Fresh (< 1 month)';

    // 7. ENGAGEMENT SCORE (0-100)
    const engagementScore = Math.min(100, Math.floor(
      (txCount * 0.5) + 
      (daysActive * 0.3) + 
      (ethBalance * 10) + 
      (nonce * 0.1)
    ));

    // 8. LOYALTY BONUS (for consistent activity)
    const loyaltyBonus = daysActive > 180 ? 500 : 
                        daysActive > 90 ? 300 : 
                        daysActive > 30 ? 100 : 0;

    // 9. VOLUME TIER
    const volumeTier = estimatedEthVolume > 100 ? 'Diamond' :
                      estimatedEthVolume > 50 ? 'Platinum' :
                      estimatedEthVolume > 10 ? 'Gold' :
                      estimatedEthVolume > 1 ? 'Silver' : 'Bronze';

    // ========================================
    // POINTS CALCULATION (Enhanced Formula)
    // ========================================
    const points = 
      (txCount * 2) +                    // 2 points per transaction
      (estimatedEthVolume * 10) +        // 10 points per ETH volume
      (daysActive * 5) +                 // 5 points per day active
      (engagementScore * 2) +            // 2 points per engagement point
      loyaltyBonus +                     // Loyalty bonus
      (ethBalance * 100);                // Current balance bonus

    const allocation = Math.floor((points / 1000) * 25000000);

    // ========================================
    // RETURN ENHANCED DATA
    // ========================================
    return res.status(200).json({
      success: true,
      address,
      
      // Basic Stats
      stats: {
        totalTransactions: txCount,
        daysActive: daysActive,
        currentBalance: ethBalance.toFixed(4),
        estimatedVolume: estimatedEthVolume.toFixed(4),
        gasSpent: estimatedGasSpent.toFixed(5),
        avgTxPerDay: avgTxPerDay
      },

      // New Metrics
      profile: {
        activityLevel: activityLevel,
        walletAge: walletAge,
        engagementScore: engagementScore,
        volumeTier: volumeTier,
        loyaltyBonus: loyaltyBonus
      },

      // Allocation
      allocation: {
        tokens: allocation.toLocaleString('en-US'),
        points: points.toFixed(2)
      },

      // Summary
      summary: `${activityLevel} • ${txCount} txs • ${estimatedEthVolume.toFixed(2)} ETH volume • ${daysActive} days • ${volumeTier} tier`,
      
      // Breakdown for transparency
      breakdown: {
        transactionPoints: (txCount * 2).toFixed(2),
        volumePoints: (estimatedEthVolume * 10).toFixed(2),
        activityPoints: (daysActive * 5).toFixed(2),
        engagementPoints: (engagementScore * 2).toFixed(2),
        loyaltyBonus: loyaltyBonus,
        balanceBonus: (ethBalance * 100).toFixed(2)
      }
    });

  } catch (error) {
    console.error("RPC Error:", error.message);
    return res.status(500).json({
      error: "Unable to fetch blockchain data",
      details: error.message
    });
  }
}
