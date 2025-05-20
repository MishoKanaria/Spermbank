# Spermbank - Substrate Protocol for Encrypted Receipt Management
<p align="center">
  <img src="assets/images/splash-icon-dark.png" alt="Spermbank logo" width="200"/>
</p>

A substrate-based mobile application for managing the issuance, storing and returns of digital receipts. Built with Expo and React Native.

## Features

- **Digital Receipt Management**: Create, store, and manage digital receipts
- **Secure Transactions**: End-to-end encrypted receipt data using Ed25519 encryption
- **Return Processing**: Handle product returns with blockchain-verified receipts
- **Business Integration**: Support for business accounts with merchant profiles
- **Contact Management**: Store and manage recipient addresses
- **QR Code Integration**: Scan and generate QR codes for transactions

## Tech Stack

- **Frontend**: React Native with Expo
- **Blockchain**: Built on Assethub-Paseo but compatible with any Substrate-based blockchain network
- **Cryptography**: 
  - Ed25519 for encryption
  - Sr25519 for blockchain transactions and account signatures
- **Storage**: AsyncStorage for local data
- **Authentication**: Expo Local Authentication

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/MishoKanaria/Spermbank
   cd spermbank
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure image uploads:
   - Add your [imgbb](https://imgbb.com/) API key to @profile.tsx, **or**
   - Change the image hosting logic to use your own solution.

   ```bash
   # For Android
   npx expo run:android

   # For iOS
   npx expo run:ios
   ```

## Project Structure

```
spermbank/
├── app/                    # Main application code and routes
│   ├── (tabs)/             # Tab-based navigation (records, send, receive, etc.)
│   │   ├── recordsrouter/  # Receipt and return flows (return-purchase, confirm-return, etc.)
│   ├── (auth)/             # Authentication screens (create-account, login, etc.)
│   ├── contexts/           # React contexts (e.g., ApiContext)
│   ├── styles/             # Shared style definitions
│   ├── add-contact.tsx     # Individual route screens
│   ├── confirm-transaction.tsx
│   ├── contacts.tsx
│   ├── index.tsx
│   ├── profile.tsx
│   ├── receive.tsx
│   ├── send.tsx
│   ├── sign-message.tsx
│   ├── tx-detail.tsx
│   ├── welcome.tsx
│   └── _layout.tsx         # App layout and navigation stack
├── assets/                 # Static assets (images, fonts, etc.)
├── components/             # Reusable UI components
├── hooks/                  # Custom React hooks
├── services/               # Business logic, API, encryption, storage, etc.
│   ├── encryption/         # Encryption and cryptography utilities
│   ├── storage/            # AsyncStorage, SecureStore, and receipt tracking
│   ├── utils/              # Receipt logic (returnReceiptUtils.ts, etc.)
│   └── blockchain/         # Blockchain-related logic and API
├── types/                  # TypeScript type definitions
└── README.md
```

## Key Features Implementation

### Receipt Management
- Digital receipts are encrypted and stored on the blockchain
- Each receipt contains itemized purchases, merchant information, and signatures
- Support for partial and full returns

### Security

- **End-to-End Encryption:**  
  All receipt data is encrypted client-side before being stored or transmitted. The app uses Ed25519 for encryption and Sr25519 for transaction signing, ensuring that only authorized parties can decrypt and verify receipts.

- **Encrypted Data Structure:**  
  Receipts are stored as encrypted JSON objects, with fields such as items, merchant info, and signatures protected. The encryption uses a symmetric AES-GCM key, which is itself encrypted for each recipient using their public key (hybrid encryption).

- **Key Management:**  
  - Each user's keypair is derived from their mnemonic using industry-standard algorithms.
  - The app supports both Ed25519 (for encryption) and Sr25519 (for blockchain signatures).
  - Public keys are used for sharing and encrypting data, while private keys never leave the device.

- **Secure Key Storage:**  
  - Private keys and mnemonics are stored using Expo SecureStore, which leverages the device's secure enclave or keystore.
  - Keys are only decrypted in memory when needed for signing or decryption.

- **Biometric Authentication:**  
  - Sensitive operations (such as logging in or viewing mnemonics) require an an 8-character long text-based password and username with the option to authenticate (FaceID, TouchID, or device PIN) via Expo Local Authentication.

- **Signature Verification:**  
  - All receipts and return requests are signed using Sr25519, and signatures are verified on-chain and in-app to prevent tampering.

- **Encrypted Type Handling:**  
  - The app uses a custom `encrypted_receipt` type to distinguish between plaintext and encrypted receipt objects, ensuring that only decrypted data is ever shown to the user.

- **Replay and Tampering Protection:**  
  - Each transaction and receipt includes a unique identifier and cryptographic signature, preventing replay attacks and unauthorized modifications.

- **No Sensitive Data in Logs:**  
  - The app avoids logging sensitive information such as mnemonics, private keys, or decrypted receipt contents.

### Business Features
- merchant profile management
- Logo and business information storage
- Transaction history tracking

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

