import { ApiPromise } from '@polkadot/api';
import { u8aToHex } from '@polkadot/util';
import { decodeAddress } from '@polkadot/util-crypto';

/**
 * Generates a utility.batchAll call hex with balances.transferKeepAlive and system.remark.
 * @param api - The ApiPromise instance to use
 * @param recipient - The recipient address (Bob)
 * @param amount - The amount to send (in plancks, e.g. 1 DOT = 10^10)
 * @param encryptedReceiptHex - The encrypted receipt as a JSON string
 * @returns The hex-encoded batchAll call
 */
export function generateBatchCallHex({
  api,
  recipient,
  amount,
  encryptedReceiptHex,
}: {
  api: ApiPromise;
  recipient: string;
  amount: string | number;
  encryptedReceiptHex: string;
}): string {
  const transfer = api.tx.balances.transferKeepAlive(recipient, amount);
  // Convert the JSON string to hex when creating the remark
  const remark = api.tx.system.remark(u8aToHex(new TextEncoder().encode(encryptedReceiptHex)));
  const batchall = api.tx.utility.batchAll([transfer, remark]);
  return batchall.method.toHex();
}

export const waitForPayment = (
  api: ApiPromise,
  recipient: string,
  amount: string,
  onFound: () => void
) => {
  let unsub: (() => void) | undefined;
  api.query.system.events((events: any) => {
    // Group events by extrinsic index
    const eventsByExtrinsic: { [index: number]: any[] } = {};
    (events as any[]).forEach((record: any) => {
      const { phase, event } = record;
      if (phase.isApplyExtrinsic) {
        const idx = phase.asApplyExtrinsic.toNumber();
        if (!eventsByExtrinsic[idx]) eventsByExtrinsic[idx] = [];
        eventsByExtrinsic[idx].push(event);
      }
    });

    // Check each extrinsic's events for transfer only
    for (const idx in eventsByExtrinsic) {
      const events = eventsByExtrinsic[idx];
      const hasTransfer = events.some(
        (event: any) =>
          event.section === 'balances' &&
          event.method === 'Transfer' &&
          event.data[2].toString() === amount &&
          isSameRecipient(recipient, event.data[1].toString())
      );
      if (hasTransfer) {
        onFound();
        if (typeof unsub === 'function') unsub();
      }
    }
  }).then((u: any) => { unsub = u; });
  return () => { if (typeof unsub === 'function') unsub(); };
}

function isSameRecipient(recipient1: string, recipient2: string): boolean {
  const recipient1PubKey = decodeAddress(recipient1);
  const recipient2PubKey = decodeAddress(recipient2);
  return recipient1PubKey.every((byte, i) => byte === recipient2PubKey[i]);
}
