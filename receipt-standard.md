# Receipt Standard Specification

This document describes the standard structure for digital receipts used in the Spermbank protocol.

---

## Receipt Object Schema

| Field                | Type      | Required | Description                                                                 |
|----------------------|-----------|----------|-----------------------------------------------------------------------------|
| receipt_id           | string    | Yes      | Unique identifier (UUID) for the receipt                                    |
| original_receipt_id  | string    | No       | ID of the original receipt for returns                                      |
| status               | string    | Yes      | Status of the receipt (e.g., 'issued', 'partial_return', 'returned'.)       |
| signatures           | object    | Yes      | Signatures for issuer and returner                                          |
| └─ issuer            | string    | Yes      | Signature of the issuer (hex-encoded)                                       |
| └─ returner          | string    | No       | Signature of the returner (hex-encoded)                                     |
| merchant                | object    | Yes      | merchant information                                                           |
| └─ name              | string    | Yes      | merchant name                                                                  |
| └─ logoUrl           | string    | Yes      | URL to merchant logo                                                           |
| └─ businessId        | string    | Yes      | merchant business ID                                                           |
| └─ address           | string    | Yes      | merchant location                                                              |
| sender               | object    | Yes      | Sender information                                                          |
| └─ address           | string    | Yes      | Address of the sender (SS58 format)                                         |
| items                | array     | Yes      | List of items                                                               |
| └─ id                | string    | Yes      | Item ID                                                                     |
| └─ name              | string    | Yes      | Item name                                                                   |
| └─ qty               | number    | Yes      | Quantity purchased                                                          |
| └─ price             | number    | Yes      | Price per item                                                              |
| └─ returnable        | boolean   | Yes      | Whether the item is returnable                                              |
| └─ returned_qty      | number    | No       | Quantity returned                                                           |
| currency             | string    | Yes      | Currency code (e.g., 'USD')                                                 |
| subtotal             | number    | Yes      | Subtotal before tax and discounts                                           |
| tax                  | number    | Yes      | Tax amount                                                                  |
| total                | number    | Yes      | Total amount after tax and discounts                                        |
| returns              | object    | Yes      | Return summary                                                              |
| └─ total_returns     | number    | Yes      | Total number of items returned                                              |
| └─ returned_amount   | number    | Yes      | Total amount refunded                                                       |
| metadata             | object    | Yes      | Additional metadata                                                         |
| └─ chain             | string    | Yes      | Blockchain chain name                                                       |
| └─ version           | string    | Yes      | Receipt standard version                                                    |
| └─ network           | string    | Yes      | Network name                                                                |

---

## Example Receipts

```json
[
  {
    "receipt_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "issued",
    "signatures": {
      "issuer": "0xSIGNATURE_OF_ISSUER_RECEIPT_HASH"
    },
    "merchant": {
      "name": "Green Valley Grocery",
      "logoUrl": "https://example.com/logo.png",
      "businessId": "GVG-2024-001",
      "address": "456 Market St, Springfield, USA"
    },
    "sender": {
      "address": "15AwNJ18RbEtK67WLo2KjKFmkn4RBSKBwvr1n7VWEH6ceuRx"
    },
    "items": [
      { "id": "item-apple-001", "name": "Apple (Fuji)", "qty": 4, "price": 0.99, "returnable": true, "returned_qty": 0 },
      { "id": "item-bread-002", "name": "Whole Wheat Bread", "qty": 1, "price": 2.49, "returnable": true, "returned_qty": 0 },
      { "id": "item-milk-003", "name": "Organic Milk 1L", "qty": 2, "price": 3.29, "returnable": true, "returned_qty": 0 }
    ],
    "currency": "USD",
    "subtotal": 11.74,
    "tax": 0.94,
    "total": 12.68,
    "returns": { "total_returns": 0, "returned_amount": 0.0 },
    "metadata": {
      "chain": "AH-paseo",
      "version": "1.0",
      "network": "testnet"
    }
  },
  {
    "receipt_id": "b2c3d4e5-f6a1-7890-abcd-ef1234567890",
    "original_receipt_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "partial_return",
    "signatures": {
      "issuer": "0xSIGNATURE_OF_ISSUER_RETURN_HASH_1",
      "returner": "0xSIGNATURE_OF_RETURNER_RECEIPT_HASH_1"
    },
    "merchant": {
      "name": "Green Valley Grocery",
      "logoUrl": "https://example.com/logo.png",
      "businessId": "GVG-2024-001",
      "address": "456 Market St, Springfield, USA"
    },
    "sender": {
      "address": "15AwNJ18RbEtK67WLo2KjKFmkn4RBSKBwvr1n7VWEH6ceuRx"
    },
    "items": [
      { "id": "item-apple-001", "name": "Apple (Fuji)", "qty": 4, "price": 0.99, "returnable": true, "returned_qty": 2 },
      { "id": "item-bread-002", "name": "Whole Wheat Bread", "qty": 1, "price": 2.49, "returnable": true, "returned_qty": 0 },
      { "id": "item-milk-003", "name": "Organic Milk 1L", "qty": 2, "price": 3.29, "returnable": true, "returned_qty": 1 }
    ],
    "currency": "USD",
    "subtotal": 5.88,
    "tax": 0.47,
    "total": 6.35,
    "returns": {
      "total_returns": 3,
      "returned_amount": 6.33
    },
    "metadata": {
      "chain": "AH-paseo",
      "version": "1.0",
      "network": "testnet"
    }
  },
  {
    "receipt_id": "c3d4e5f6-a1b2-7890-abcd-ef1234567890",
    "original_receipt_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "returned",
    "signatures": {
      "issuer": "0xSIGNATURE_OF_ISSUER_RETURN_HASH_2",
      "returner": "0xSIGNATURE_OF_RETURNER_RECEIPT_HASH_2"
    },
    "merchant": {
      "name": "Green Valley Grocery",
      "logoUrl": "https://example.com/logo.png",
      "businessId": "GVG-2024-001",
      "address": "456 Market St, Springfield, USA"
    },
    "sender": {
      "address": "15AwNJ18RbEtK67WLo2KjKFmkn4RBSKBwvr1n7VWEH6ceuRx"
    },
    "items": [
      { "id": "item-apple-001", "name": "Apple (Fuji)", "qty": 4, "price": 0.99, "returnable": true, "returned_qty": 4 },
      { "id": "item-bread-002", "name": "Whole Wheat Bread", "qty": 1, "price": 2.49, "returnable": true, "returned_qty": 1 },
      { "id": "item-milk-003", "name": "Organic Milk 1L", "qty": 2, "price": 3.29, "returnable": true, "returned_qty": 2 }
    ],
    "currency": "USD",
    "subtotal": 0.00,
    "tax": 0.00,
    "total": 0.00,
    "returns": {
      "total_returns": 7,
      "returned_amount": 6.35
    },
    "metadata": {
      "chain": "AH-paseo",
      "version": "1.0",
      "network": "testnet"
    }
  }
]
``` 