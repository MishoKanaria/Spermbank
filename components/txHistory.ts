import { ApiPromise } from '@polkadot/api';
import { encodeAddress, mnemonicToMiniSecret } from '@polkadot/util-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { convertSecretKeyToX25519, generateKeyPairFromSeed } from '@stablelib/ed25519';
import dayjs from 'dayjs';
import { getApi } from '../app/contexts/ApiContext';
import { decryptEncryptedReceiptObj } from '../services/encryption/cryptoUtils';
import { getSecureValue } from '../services/storage/secureStorage';
import { parseRemark } from '../services/utils/remarkUtils';

const SUBSCAN_API_KEY = '7fe512b4fec749e483d6f94c73d9ea15';

interface SubscanTransfer {
  hash: string;
  block_hash: string;
  block_timestamp: number;
  from: string;
  to: string;
  amount: string;
  amount_v2?: string;
  remark?: string;
  from_account_display?: {
    display?: string;
  };
}

export interface TxHistoryItem {
  id: string;
  type: 'send' | 'receive' | 'other';
  name: string; // address or contact name
  date: string;
  amount: string;
  counterparty: string; // address of the other party
  remark?: string;
  profileAddress: string;
  _timestamp?: number; // add for sorting
  decrypted_receipt?: any; // decrypted receipt object if present
  encrypted_receipt_info?: any; // parsed encrypted receipt info if present
  blockHash?: string; // block hash for transaction lookup
  isReturn: boolean;
}

// Helper to format address for display
function formatAddr(addr: string | undefined) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

// Helper to format timestamp
function formatTimestamp(ts: number): string {
  return dayjs.unix(ts).format('DD MMM YYYY, h:mm A');
}

// Utility to get the current account's secret key
export async function getCurrentAccountSecretKey() {
  const currentAddress = await AsyncStorage.getItem('currentAccount');
  if (!currentAddress) throw new Error('No current account');
  const mnemonic = await getSecureValue(`mnemonic_${currentAddress}`);
  if (!mnemonic) throw new Error('Mnemonic not found in secure storage');
  return mnemonicToMiniSecret(mnemonic); // Uint8Array
}

export async function getCurrentAccountCurve25519SecretKey() {
  const currentAddress = await AsyncStorage.getItem('currentAccount');
  if (!currentAddress) throw new Error('No current account');
  const mnemonic = await getSecureValue(`mnemonic_${currentAddress}`);
  if (!mnemonic) throw new Error('Mnemonic not found in secure storage');
  const miniSecret = mnemonicToMiniSecret(mnemonic);
  const edKeyPair = generateKeyPairFromSeed(miniSecret);
  const curve25519SecretKey = convertSecretKeyToX25519(edKeyPair.secretKey);
  return curve25519SecretKey; // Uint8Array, 32 bytes
}

// Helper function to process incoming transactions
export const processIncomingTransaction = async (
  t: SubscanTransfer,
  address: string,
  api: ApiPromise
): Promise<TxHistoryItem> => {
  // Fetch extrinsic details to get the remark
  let remark = t.remark;
  let isReturn = false;
  let parsedRemark = null;
  try {
    if (remark) {
      // Handle hex-encoded remarks
      const cleanRemark = remark.startsWith('0x') ? remark.slice(2) : remark;
      try {
        // First try parsing as hex
        const decodedRemark = Buffer.from(cleanRemark, 'hex').toString();
        parsedRemark = parseRemark(decodedRemark);
      } catch {
        // If hex parsing fails, try parsing as raw JSON
        parsedRemark = parseRemark(cleanRemark);
      }
      isReturn =
        parsedRemark && typeof parsedRemark === 'object' && parsedRemark !== null && (
          (parsedRemark as any).status === 'partial_return' ||
          (parsedRemark as any).status === 'returned' ||
          ((parsedRemark as any).returns && (parsedRemark as any).returns.total_returns > 0)
        );
    }
  } catch (err) {
    console.error('Error parsing remark for incoming transaction:', err);
  }

  return {
    id: t.hash,
    type: 'receive',
    name: t.from,
    date: formatTimestamp(t.block_timestamp),
    amount: `$${t.amount}`,
    counterparty: t.from,
    remark: remark,
    profileAddress: address,
    _timestamp: t.block_timestamp,
    decrypted_receipt: parsedRemark,
    blockHash: t.block_hash,
    isReturn: isReturn
  };
};

// Helper function to process outgoing transactions
async function processOutgoingTransaction(t: any, address: string, contacts: any[], detailUrl: string) {
  const counterparty = t.to;
  const profileAddress = counterparty;
  let amountNum = 0;
  let amount = '';
  if (t.amount_v2) {
    amountNum = Number(t.amount_v2) / 1e10;
    amount = `-$${amountNum}`;
  } else if (t.amount) {
    amount = `-$${t.amount}`;
  } else {
    amount = '-$0.00';
  }

  // Use recipient's display info for outgoing transactions
  let name = '';
  if (t.to_account_display?.display) {
    name = t.to_account_display.display;
  } else if (contacts.find(c => c.address === counterparty)) {
    name = contacts.find(c => c.address === counterparty)?.name || formatAddr(counterparty);
  } else {
    name = formatAddr(counterparty);
  }

  // Fetch extrinsic details to get the remark
  let remark = t.remark;
  let isReturn = false;
  let parsedRemark = null;
  try {
    if (remark) {
      // Handle hex-encoded remarks
      const cleanRemark = remark.startsWith('0x') ? remark.slice(2) : remark;
      try {
        // First try parsing as hex
        const decodedRemark = Buffer.from(cleanRemark, 'hex').toString();
        parsedRemark = parseRemark(decodedRemark);
      } catch {
        // If hex parsing fails, try parsing as raw JSON
        parsedRemark = parseRemark(cleanRemark);
      }
      isReturn =
        parsedRemark && typeof parsedRemark === 'object' && parsedRemark !== null && (
          (parsedRemark as any).status === 'partial_return' ||
          (parsedRemark as any).status === 'returned' ||
          ((parsedRemark as any).returns && (parsedRemark as any).returns.total_returns > 0)
        );
    }
  } catch (err) {
    console.error('Error parsing remark for outgoing transaction:', err);
  }

  const result = {
    id: t.hash,
    type: 'send' as const,
    name,
    date: formatTimestamp(t.block_timestamp),
    amount,
    counterparty,
    remark,
    profileAddress,
    _timestamp: t.block_timestamp,
    decrypted_receipt: parsedRemark,
    blockHash: t.block_hash,
    isReturn,
  };

  return result;
}

export async function fetchAllTransfers(
  address: string, 
  contacts: any[] = [], 
  row = 20, 
  page = 0, 
  userSecretKey?: Uint8Array
): Promise<TxHistoryItem[]> {
  try {
    const SUBSCAN_EXTRINSICS_URL = 'https://assethub-paseo.api.subscan.io/api/v2/scan/extrinsics';
    const SUBSCAN_TRANSFERS_URL = 'https://assethub-paseo.api.subscan.io/api/v2/scan/transfers';
    const detailUrl = 'https://assethub-paseo.api.subscan.io/api/scan/extrinsic';

    // Get API instance
    const api = await getApi();

    // Fetch extrinsics (sent txs and other calls)
    const response = await fetch(SUBSCAN_EXTRINSICS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': SUBSCAN_API_KEY,
      },
      body: JSON.stringify({ address, row, page }),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Subscan returned non-JSON response: ' + text.slice(0, 100));
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data.extrinsics)) {
      // Continue, but treat extrinsics as empty array
      data.data = { extrinsics: [] };
    }

    // Fetch transfers (sent and received)
    const transfersResp = await fetch(SUBSCAN_TRANSFERS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': SUBSCAN_API_KEY,
      },
      body: JSON.stringify({ address, row: 50, page: 0 }),
    });
    const transfersData = await transfersResp.json();
    
    const transfers = Array.isArray(transfersData.data?.transfers) ? transfersData.data.transfers : [];
    
    // Build a map of extrinsic hashes for deduplication
    const extrinsics = data.data.extrinsics.slice(0, 10);
    
    // Create maps for quick lookup
    const extrinsicMap = new Map(extrinsics.map((ext: { hash?: string; extrinsic_hash?: string }) => [ext.hash || ext.extrinsic_hash, ext]));
    const transferMap = new Map(transfers.map((t: { hash: string }) => [t.hash, t]));
    
    // Find duplicates (transfers that also exist as extrinsics)
    const duplicates = new Set();
    for (const [hash, ext] of extrinsicMap.entries()) {
      if (transferMap.has(hash)) {
        duplicates.add(hash);
      }
    }
          
    // Process transactions
    const txs: TxHistoryItem[] = [];
    const processedHashes = new Set(); // Track processed transaction hashes
    
    // First, process extrinsics (including duplicates)
    for (const ext of extrinsics) {
      try {
        const detailResp = await fetch(detailUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': SUBSCAN_API_KEY,
          },
          body: JSON.stringify({ extrinsic_index: ext.extrinsic_index }),
        });
        const detailData = await detailResp.json();
        
        if (detailData.code === 0 && detailData.data) {
          const d = detailData.data;
          // Process extrinsic data
          let type: 'send' | 'receive' | 'other' = 'other';
          let counterparty = '';
          let amount = '';
          let name = '';
          let remark = '';
          let profileAddress = '';
          let block_timestamp = d.block_timestamp;
          let isReturn = false;

          // Helper to extract remark from params
          function extractRemark(params: { name: string; value: any }[] | undefined) {
            const remarkParam = params?.find((p: { name: string }) => p.name === 'remark');
            if (!remarkParam) return '';
            if (typeof remarkParam.value === 'string') return remarkParam.value;
            return JSON.stringify(remarkParam.value);
          }

          // Process based on transaction type
          if (d.call_module === 'utility' && d.call_module_function === 'batch_all') {
            const batchParam = d.params?.find((p: any) => p.name === 'calls');
            let calls = batchParam?.value;
            if (calls && !Array.isArray(calls)) {
              try { calls = JSON.parse(calls); } catch {}
            }
            
            let foundTransfer = null;
            let foundRemark = '';
            
            if (Array.isArray(calls)) {
              for (const call of calls) {
                if (
                  (call.call_module?.toLowerCase() === 'balances' || call.call_module === 'Balances') &&
                  (call.call_name === 'transfer_keep_alive' || call.call_module_function === 'transfer_keep_alive')
                ) {
                  const destParam = call.params?.find((p: any) => p.name === 'dest');
                  const valueParam = call.params?.find((p: any) => p.name === 'value');
                  let dest = '';
                  if (destParam?.value?.Id) dest = hexToSS58(destParam.value.Id);
                  else if (typeof destParam?.value === 'string') dest = hexToSS58(destParam.value);
                  let value = valueParam?.value;
                  foundTransfer = { dest, value };
                }
                if (
                  call.call_module?.toLowerCase() === 'system' &&
                  (call.call_name === 'remark' || call.call_module_function === 'remark')
                ) {
                  foundRemark = extractRemark(call.params);
                }
              }
            }
            
            if (foundTransfer) {
              const isSend = d.account_id === address;
              type = isSend ? 'send' : 'receive';
              counterparty = foundTransfer.dest;
              profileAddress = counterparty;
              let amountNum = foundTransfer.value ? Number(foundTransfer.value) / 1e10 : 0;
              amount = (isSend ? '-' : '') + `$${amountNum.toFixed(2)}`;
              name = (contacts || []).find(c => c.address === counterparty)?.name || formatAddr(counterparty);
              remark = foundRemark;
              
              // Check if this is a return transaction
              try {
                if (foundRemark) {
                  const parsedRemark = parseRemark(foundRemark);
                  if (parsedRemark && typeof parsedRemark === 'object' && parsedRemark !== null) {
                    isReturn = (parsedRemark as any).status === 'partial_return' || 
                              (parsedRemark as any).status === 'returned' ||
                              ((parsedRemark as any).returns && (parsedRemark as any).returns.total_returns > 0);
                  } else {
                    isReturn = false;
                  }
                }
              } catch (err) {
                console.error('Error parsing remark:', err);
              }
            }
          } else if (
            d.call_module?.toLowerCase() === 'balances' &&
            (d.call_module_function === 'transfer_keep_alive' || d.call_module_function === 'transfer')
          ) {
            const destParam = d.params?.find((p: any) => p.name === 'dest');
            const valueParam = d.params?.find((p: any) => p.name === 'value');
            let dest = '';
            if (destParam?.value?.Id) dest = hexToSS58(destParam.value.Id);
            else if (typeof destParam?.value === 'string') dest = hexToSS58(destParam.value);
            let value = valueParam?.value;
            let isSend = d.account_id === address;
            type = isSend ? 'send' : 'receive';
            counterparty = dest;
            profileAddress = counterparty;
            let amountNum = 0;
            if (isSend) {
              amountNum = value ? Number(value) / 1e10 : 0;
            } else {
              amountNum = d.transfer?.amount_v2 ? Number(d.transfer.amount_v2) / 1e10 : 0;
            }
            amount = (isSend ? '-' : '') + `$${amountNum.toFixed(2)}`;
            name = (contacts || []).find(c => c.address === counterparty)?.name || formatAddr(counterparty);
            remark = extractRemark(d.params);
          }

          if (!processedHashes.has(d.extrinsic_hash)) {
            txs.push({
              id: d.extrinsic_hash,
              type,
              name,
              date: formatTimestamp(block_timestamp),
              amount,
              counterparty,
              remark,
              profileAddress,
              _timestamp: block_timestamp,
              blockHash: d.block_hash,
              isReturn,
            });
            processedHashes.add(d.extrinsic_hash);
          }
        }
      } catch (err) {
        console.error('Error processing extrinsic:', err);
      }
    }

    // Then, process remaining transfers using Polkadot API
    for (const t of transfers) {
      // Skip if this transfer was already processed
      if (processedHashes.has(t.hash)) {
        continue;
      }

      try {
        // Get transaction details from Polkadot API using extrinsic_index
        let txDetails = null;
        if (t.extrinsic_index) {
          const [blockNum, index] = t.extrinsic_index.split('-');
          if (blockNum && index) {
            const blockHash = await api.rpc.chain.getBlockHash(blockNum);
            let blockHashStr = '';
            if (blockHash) {
              blockHashStr = blockHash.toString();
              const block = await api.rpc.chain.getBlock(blockHash);
              if (block) {
                txDetails = block.block.extrinsics[parseInt(index)];
                if (txDetails) {

                  // Process based on transaction type
                  if (txDetails.method.section === 'utility' && txDetails.method.method === 'batchAll') {
                    
                    const calls = (txDetails.method.args[0] as any).toArray();
                    let foundTransfer = null;
                    let foundRemark = '';

                    for (const call of calls) {
                      // Parse the call data
                      const callData = JSON.parse(call.toString());

                      if (callData.callIndex === '0x0a03') { // balances.transferKeepAlive
                        const args = callData.args;
                        if (args.dest && args.value) {
                          const dest = args.dest.id || args.dest;
                          const value = args.value;
                          foundTransfer = { dest, value };
                        }
                      } else if (callData.callIndex === '0x0000') { // system.remark
                        const args = callData.args;
                        if (args.remark) {
                          const rawRemark = args.remark;
                          if (typeof rawRemark === 'string' && rawRemark.startsWith('0x')) {
                            try {
                              foundRemark = Buffer.from(rawRemark.slice(2), 'hex').toString();
                            } catch {
                              foundRemark = rawRemark; // fallback
                            }
                          } else {
                            foundRemark = rawRemark;
                          }
                        }
                      }
                    }

                    if (foundTransfer) {
                      const isSend = t.from === address;
                      const counterparty = foundTransfer.dest;
                      const amountNum = Number(foundTransfer.value) / 1e10;
                      const amount = (isSend ? '-' : '') + `$${amountNum.toFixed(2)}`;
                      const name = (contacts || []).find(c => c.address === counterparty)?.name || formatAddr(counterparty);

                      let isReturn = false;
                      let parsedRemark = null;
                      let decryptedReceipt = null;
                      try {
                        if (foundRemark) {
                          // Handle hex-encoded JSON strings (0x7b22...5d7d format)
                          const cleanRemark = foundRemark.startsWith('0x') ? foundRemark.slice(2) : foundRemark;
                          try {
                            // Decode hex to string and parse as JSON
                            const decodedRemark = Buffer.from(cleanRemark, 'hex').toString();
                            parsedRemark = parseRemark(decodedRemark);
             
                            // Try to decrypt the receipt if it exists
                            if (parsedRemark && typeof parsedRemark === 'object' && parsedRemark !== null && (parsedRemark as any).encrypted_receipt && userSecretKey) {
                              try {
                                decryptedReceipt = decryptEncryptedReceiptObj(parsedRemark, address, userSecretKey);
                                if (decryptedReceipt) {
                                  // Store decrypted receipt in AsyncStorage
                                  try {
                                    const receiptObj = JSON.parse(decryptedReceipt);
                                    await AsyncStorage.setItem(
                                      `decrypted_receipt_${t.hash}`,
                                      decryptedReceipt
                                    );
                                  } catch (err) {
                                    console.error('Failed to store decrypted receipt:', err);
                                  }
                                }
                              } catch (decryptErr) {
                                console.error('Failed to decrypt receipt:', decryptErr);
                                // Try to get stored receipt
                                try {
                                  const storedReceipt = await AsyncStorage.getItem(`decrypted_receipt_${t.hash}`);
                                  if (storedReceipt) {
                                    decryptedReceipt = storedReceipt;
                                  }
                                } catch (storageErr) {
                                  console.error('Failed to get stored receipt:', storageErr);
                                }
                              }
                            }
                          } catch (err) {
                            console.error('Error decoding hex remark:', err, 'Raw remark:', foundRemark);
                          }
                          if (parsedRemark && typeof parsedRemark === 'object' && parsedRemark !== null) {
                            isReturn = (parsedRemark as any).status === 'partial_return' || 
                                      (parsedRemark as any).status === 'returned' ||
                                      ((parsedRemark as any).returns && (parsedRemark as any).returns.total_returns > 0);
                          } else {
                            isReturn = false;
                          }
                        }
                      } catch (err) {
                        console.error('Error parsing remark:', err, 'Raw remark:', foundRemark);
                      }

                      if (!processedHashes.has(t.hash)) {
                        txs.push({
                          id: t.hash,
                          type: isSend ? 'send' : 'receive',
                          name,
                          date: formatTimestamp(t.block_timestamp),
                          amount,
                          counterparty,
                          remark: foundRemark,
                          profileAddress: counterparty,
                          _timestamp: t.block_timestamp,
                          blockHash: blockHashStr || t.block_hash,
                          isReturn,
                          decrypted_receipt: decryptedReceipt ? JSON.parse(decryptedReceipt) : undefined,
                          encrypted_receipt_info: parsedRemark
                        });
                        processedHashes.add(t.hash);
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (!txDetails) {
          // If we couldn't get details from Polkadot API, try processing as a regular transfer
          if (!processedHashes.has(t.hash)) {
            const isSend = t.from === address;
            const processedTx = isSend 
              ? await processOutgoingTransaction(t, address, contacts, detailUrl)
              : await processIncomingTransaction(t, address, api);
            
            txs.push(processedTx);
            processedHashes.add(t.hash);
          }
          continue;
        }

        // Process based on transaction type
        if (txDetails.method.section === 'utility' && txDetails.method.method === 'batchAll') {
          
          const calls = (txDetails.method.args[0] as any).toArray();
          let foundTransfer = null;
          let foundRemark = '';

          for (const call of calls) {
            // Parse the call data
            const callData = JSON.parse(call.toString());

            if (callData.callIndex === '0x0a03') { // balances.transferKeepAlive
              const args = callData.args;
              if (args.dest && args.value) {
                const dest = args.dest.id || args.dest;
                const value = args.value;
                foundTransfer = { dest, value };
              }
            } else if (callData.callIndex === '0x0000') { // system.remark
              const args = callData.args;
              if (args.remark) {
                foundRemark = args.remark;
              }
            }
          }

          if (foundTransfer) {
            const isSend = t.from === address;
            const counterparty = foundTransfer.dest;
            const amountNum = Number(foundTransfer.value) / 1e10;
            const amount = (isSend ? '-' : '') + `$${amountNum.toFixed(2)}`;
            const name = (contacts || []).find(c => c.address === counterparty)?.name || formatAddr(counterparty);

            let isReturn = false;
            let parsedRemark = null;
            let decryptedReceipt = null;
            try {
              if (foundRemark) {
                // Handle hex-encoded JSON strings (0x7b22...5d7d format)
                const cleanRemark = foundRemark.startsWith('0x') ? foundRemark.slice(2) : foundRemark;
                try {
                  // Decode hex to string and parse as JSON
                  const decodedRemark = Buffer.from(cleanRemark, 'hex').toString();
                  parsedRemark = parseRemark(decodedRemark);

                  // Try to decrypt the receipt if it exists
                  if (parsedRemark && typeof parsedRemark === 'object' && parsedRemark !== null && (parsedRemark as any).encrypted_receipt && userSecretKey) {
                    try {
                      decryptedReceipt = decryptEncryptedReceiptObj(parsedRemark, address, userSecretKey);
                      if (decryptedReceipt) {
                        // Store decrypted receipt in AsyncStorage
                        try {
                          const receiptObj = JSON.parse(decryptedReceipt);
                          await AsyncStorage.setItem(
                            `decrypted_receipt_${t.hash}`,
                            decryptedReceipt
                          );
                        } catch (err) {
                          console.error('Failed to store decrypted receipt:', err);
                        }
                      }
                    } catch (decryptErr) {
                      console.error('Failed to decrypt receipt:', decryptErr);
                      // Try to get stored receipt
                      try {
                        const storedReceipt = await AsyncStorage.getItem(`decrypted_receipt_${t.hash}`);
                        if (storedReceipt) {
                          decryptedReceipt = storedReceipt;
                        }
                      } catch (storageErr) {
                        console.error('Failed to get stored receipt:', storageErr);
                      }
                    }
                  }
                } catch (err) {
                  console.error('Error decoding hex remark:', err, 'Raw remark:', foundRemark);
                }
                if (parsedRemark && typeof parsedRemark === 'object' && parsedRemark !== null) {
                  isReturn = (parsedRemark as any).status === 'partial_return' || 
                            (parsedRemark as any).status === 'returned' ||
                            ((parsedRemark as any).returns && (parsedRemark as any).returns.total_returns > 0);
                } else {
                  isReturn = false;
                }
              }
            } catch (err) {
              console.error('Error parsing remark:', err, 'Raw remark:', foundRemark);
            }       

            if (!processedHashes.has(t.hash)) {
              txs.push({
                id: t.hash,
                type: isSend ? 'send' : 'receive',
                name,
                date: formatTimestamp(t.block_timestamp),
                amount,
                counterparty,
                remark: foundRemark,
                profileAddress: counterparty,
                _timestamp: t.block_timestamp,
                blockHash: t.block_hash,
                isReturn,
                decrypted_receipt: decryptedReceipt ? JSON.parse(decryptedReceipt) : undefined,
                encrypted_receipt_info: parsedRemark
              });
              processedHashes.add(t.hash);
            }
          } else {
            console.error('No transfer found in batch:', t.hash);
          }
        } else if (
          (txDetails.method.section === 'balances' || txDetails.method.section === 'Balances') &&
          (txDetails.method.method === 'transfer_keep_alive' || txDetails.method.method === 'transfer')
        ) {
          const isSend = t.from === address;
          const processedTx = isSend 
            ? await processOutgoingTransaction(t, address, contacts, detailUrl)
            : await processIncomingTransaction(t, address, api);
          
          if (!processedHashes.has(t.hash)) {
            txs.push(processedTx);
            processedHashes.add(t.hash);
          }
        }
      } catch (err) {
        console.error('Error processing transfer with Polkadot API:', err);
      }
    }

    // Now sort and clean up
    txs.sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0));

    // Collect and decrypt transactions with encrypted_receipt in remark
    const encryptedReceiptTxs = await Promise.all(
      txs.filter((tx) => {
        
        if (!tx.remark) return false;
        try {
          const parsed = JSON.parse(tx.remark);
          return typeof parsed === 'object' && parsed.encrypted_receipt;
        } catch {
          return false;
        }
      }).map(async (tx) => {
        let parsedRemark: any = null;
        let decryptedReceipt: string | null = null;
        try {         
          if (tx.remark) {
            parsedRemark = parseRemark(tx.remark);
          }
          
          if (userSecretKey && parsedRemark && typeof parsedRemark === 'object' && parsedRemark !== null && Array.isArray((parsedRemark as any).recipients)) {
            try {
              decryptedReceipt = decryptEncryptedReceiptObj(parsedRemark, address, userSecretKey);
              
              // Store decrypted receipt in AsyncStorage
              if (decryptedReceipt) {
                try {
                  const receiptObj = JSON.parse(decryptedReceipt);
                  
                  // Ensure all required fields are present
                  const validatedReceipt = {
                    receipt_id: receiptObj.receipt_id || '',
                    status: receiptObj.status || '',
                    items: receiptObj.items || [],
                    currency: receiptObj.currency || 'USD',
                    subtotal: receiptObj.subtotal || 0,
                    tax: receiptObj.tax || 0,
                    total: receiptObj.total || 0,
                    returns: receiptObj.returns || { total_returns: 0, returned_amount: 0 },
                    merchant: receiptObj.merchant || { name: '', address: '', businessId: '', logoUrl: '' },
                    sender: receiptObj.sender || { address: '' },
                    signatures: receiptObj.signatures || { issuer: '', returner: '' },
                    metadata: receiptObj.metadata || {},
                    ...receiptObj
                  };
                  
                  await AsyncStorage.setItem(
                    `decrypted_receipt_${tx.id}`,
                    JSON.stringify(validatedReceipt)
                  );
                  decryptedReceipt = JSON.stringify(validatedReceipt);
                } catch (err) {
                  console.error('Failed to store decrypted receipt:', err);
                }
              }
            } catch (decryptErr) {
              console.error('Failed to decrypt receipt:', decryptErr);
             
              try {
                const storedReceipt = await AsyncStorage.getItem(`decrypted_receipt_${tx.id}`);
                if (storedReceipt) {
                  decryptedReceipt = storedReceipt;
                }
              } catch (storageErr) {
                console.error('Failed to get stored receipt:', storageErr);
              }
            }
          } else {
          }
        } catch (err) {
          console.error('Failed to parse remark:', err);
        }
        
        const result = {
          ...tx,
          encrypted_receipt_info: parsedRemark,
          decrypted_receipt: decryptedReceipt ? JSON.parse(decryptedReceipt) : undefined,
          remark: tx.remark // Make sure to include the original remark
        };
        
       
        
        return result;
      })
    );

    // After decrypting receipts, merge info into txs
    for (const decryptedTx of encryptedReceiptTxs) {
      const idx = txs.findIndex(tx => tx.id === decryptedTx.id);
      if (idx !== -1) {
        try {
          // Fix any double 0x prefixes in signatures
          let decryptedReceipt = decryptedTx.decrypted_receipt;
          if (decryptedReceipt) {
            const receiptObj = JSON.parse(JSON.stringify(decryptedReceipt));
            if (receiptObj.signatures) {
              // Fix issuer signature if it has double 0x
              if (receiptObj.signatures.issuer?.startsWith('0x0x')) {
                receiptObj.signatures.issuer = receiptObj.signatures.issuer.replace('0x0x', '0x');
              }
              // Fix returner signature if it has double 0x
              if (receiptObj.signatures.returner?.startsWith('0x0x')) {
                receiptObj.signatures.returner = receiptObj.signatures.returner.replace('0x0x', '0x');
              }
            }
            decryptedReceipt = receiptObj;
          }

          // Preserve basic transaction info even if decryption failed
          txs[idx] = {
            ...txs[idx],
            decrypted_receipt: decryptedReceipt,
            encrypted_receipt_info: decryptedTx.encrypted_receipt_info,
            // Add the decrypted receipt as the remark if it exists
            remark: decryptedReceipt ? JSON.stringify(decryptedReceipt) : txs[idx].remark
          };
        } catch (err) {
          // Keep the basic transaction info even if receipt processing fails
          txs[idx] = {
            ...txs[idx],
            decrypted_receipt: undefined,
            encrypted_receipt_info: decryptedTx.encrypted_receipt_info,
          };
        }
      }
    }

    return txs;
  } catch (err) {
    console.error('Error in fetchAllTransfers:', err);
    throw err;
  }
}


function prettifyModuleFunction(module: string, func: string) {
  return `${capitalize(module)}.${func.replace(/_/g, ' ')}`;
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function hexToSS58(hex: string | undefined, prefix = 0) {
  try {
    if (hex && hex.startsWith('0x')) {
      return encodeAddress(hex, prefix);
    }
  } catch {}
  return hex || '';
}

export function buildMostRecentReceiptMap(txs: TxHistoryItem[]) {
  const mostRecentMap = new Map();

  // First, build a lookup of all receipts by their receipt_id
  const receiptById = new Map();
  for (const tx of txs) {
    const receipt = tx.decrypted_receipt || tx.encrypted_receipt_info;
    if (receipt && receipt.receipt_id) {
      receiptById.set(receipt.receipt_id, { ...receipt, tx });
    }
  }

  for (const tx of txs) {
    const receipt = tx.decrypted_receipt || tx.encrypted_receipt_info;
    if (!receipt) continue;

    // Walk up the chain to find the root/original receipt
    let rootId = receipt.receipt_id;
    let current = receipt;
    while (current.original_receipt_id && receiptById.has(current.original_receipt_id)) {
      rootId = current.original_receipt_id;
      current = receiptById.get(current.original_receipt_id);
    }

    const timestamp = tx._timestamp;
    if (!timestamp) continue;

    const existing = mostRecentMap.get(rootId);
    // Always keep the latest by timestamp
    if (!existing || timestamp > existing.timestamp) {
      mostRecentMap.set(rootId, {
        receipt_id: receipt.receipt_id,
        timestamp,
      });
    }
  }
  return mostRecentMap;
}
