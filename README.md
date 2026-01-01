# FileSoldier 🛡️

**Secure, Anonymous, Zero-Knowledge File Sharing Platform.**

FileSoldier is a modern, open-source file sharing application designed with privacy as the core principle. It uses client-side AES-256 encryption to ensure that the server never sees the contents of your files—not even the filenames. Only you and the person who has the share link (with the decryption key) can access the data.

## 🚀 Features

- **🔒 End-to-End Encryption**: Files are encrypted in your browser using **AES-256-GCM** before they ever reach the server.
- **🙈 Zero-Knowledge Architecture**: The server stores only encrypted blobs. The encryption key is part of the URL fragment (`#key`) and is never sent to the backend.
- **💣 Self-Destructing Links**: Configure files to expire after a certain time (10 mins to 24 hours) or after a specific number of downloads ("Burn after read").
- **🔑 Password Protection**: Optional additional layer of security using mixed key wrapping.
- **🕵️ Anonymous Sharing**: No account required for files up to 10MB.
- **📦 Large File Support**: Sign in to share files up to 50MB.
- **🎭 Mask Filenames**: Option to hide the original filename on the download page for added privacy.
- **🤖 Bot Protection**: Integrated Cloudflare Turnstile to prevent abuse.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) & Radix UI
- **Database**: PostgreSQL (via [Supabase](https://supabase.com/))
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Auth**: [Better Auth](https://better-auth.com/)
- **Storage**: Supabase Storage
- **Security**: Web Crypto API for client-side encryption

## 💡 How It Works

1.  **Key Generation**: When you select a file, the browser generates a random encryption key.
2.  **Encryption**: The file content and metadata (name, type) are encrypted locally using the generated key (AES-256).
3.  **Upload**: The *encrypted* blob is uploaded to Supabase Storage. The server receives only unintelligible data.
4.  **Link Creation**: A unique sharable link is generated resembling `https://www.filesoldier.online/d/[fileId]#[decryptionKey]`.
5.  **Decryption**: When the recipient visits the link, their browser extracts the key from the URL hash (which is not sent to the server), fetches the encrypted blob, and decrypts it locally to reconstruct the file.

---

## 🔐 Security Architecture: Client-Side Encryption Deep Dive

FileSoldier uses the native **Web Crypto API** (`window.crypto.subtle`) available in all modern browsers. This ensures cryptographic operations are performed in a secure, hardware-accelerated environment without relying on third-party JavaScript libraries.

### Encryption Algorithm

- **Algorithm**: `AES-GCM` (Advanced Encryption Standard - Galois/Counter Mode)
- **Key Length**: 256 bits
- **IV (Initialization Vector) Length**: 96 bits (12 bytes), as recommended by NIST for GCM
- **Authentication Tag**: 128 bits (built into GCM, provides integrity verification)

### The Encryption Flow

#### Step 1: Generate a Random Encryption Key

When you select a file, the browser generates a cryptographically secure 256-bit AES key. This key exists **only in your browser's memory**.

```javascript
// src/utils/crypto.ts
const key = await window.crypto.subtle.generateKey(
  {
    name: "AES-GCM",
    length: 256,
  },
  true, // Key is extractable (to encode in URL)
  ["encrypt", "decrypt"]
);
```

#### Step 2: Encrypt the File Data

The file is read into an `ArrayBuffer`, and then encrypted using the generated key and a random 12-byte IV.

```javascript
const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
const fileBuffer = await file.arrayBuffer();

const encryptedBuffer = await window.crypto.subtle.encrypt(
  { name: "AES-GCM", iv: iv },
  key,
  fileBuffer
);
```
The output (`encryptedBuffer`) is ciphertext that is computationally indistinguishable from random noise without the key.

#### Step 3: Encrypt File Metadata Separately

The filename and MIME type are also sensitive. They are encrypted with the **same key but a different, randomly generated IV** (using the same IV for multiple messages is a critical security vulnerability in GCM).

```javascript
const metadataIv = window.crypto.getRandomValues(new Uint8Array(12));
const data = new TextEncoder().encode(JSON.stringify({ name, type }));

const encryptedMetadata = await window.crypto.subtle.encrypt(
  { name: "AES-GCM", iv: metadataIv },
  key,
  data
);

// The IV is prepended to the ciphertext for decryption later
const combined = new Uint8Array(metadataIv.length + encryptedMetadata.byteLength);
combined.set(metadataIv, 0);
combined.set(new Uint8Array(encryptedMetadata), metadataIv.length);
```

#### Step 4: Export Key as URL-Safe String

The key is exported in JWK (JSON Web Key) format, then Base64-encoded for use in the URL fragment.

```javascript
const exportedKey = await window.crypto.subtle.exportKey("jwk", key);
// Convert to URL-safe Base64
const keyString = btoa(JSON.stringify(exportedKey))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');
```

#### Step 5: Build the Share Link

The final link looks like:
```
https://www.filesoldier.online/d/abc123#eyJhbGciOiJBMjU2R0NNIiwiZXh0Ijp0cnVlLC...
```
The part after `#` is the **URL fragment**. Crucially, **browsers do not send the fragment to the server**. This is the foundation of the zero-knowledge architecture.

### The Decryption Flow (Recipient's Browser)

1.  The recipient opens the link.
2.  Their browser fetches the encrypted blob and encrypted metadata from the server.
3.  The JavaScript extracts the key from `window.location.hash`.
4.  The key is re-imported into the Web Crypto API.
5.  The metadata is decrypted to reveal the original filename and type.
6.  The file blob is decrypted and offered for download.

```javascript
// Re-import the key from the URL hash
const jwk = JSON.parse(atob(keyString));
const key = await window.crypto.subtle.importKey(
  "jwk", jwk,
  { name: "AES-GCM", length: 256 },
  true,
  ["decrypt"]
);

// Decrypt the file
const decryptedBuffer = await window.crypto.subtle.decrypt(
  { name: "AES-GCM", iv: iv },
  key,
  encryptedBuffer
);
```

### Optional: Password Protection

For an extra layer of security, users can add a password. This uses **PBKDF2** to derive a key-wrapping key from the password, which then wraps the original AES key using **AES-KW**. The encrypted key is stored on the server. The decryption key is no longer in the URL; instead, the recipient must enter the password to unwrap the key.

### Summary: What the Server Sees vs. What It Doesn't

| Data Point          | Server Sees?        |
| :------------------ | :------------------ |
| Encrypted file blob | ✅ Yes (ciphertext) |
| Original file data  | ❌ No               |
| Filename            | ❌ No (encrypted)   |
| File type           | ❌ No (encrypted)   |
| Decryption Key      | ❌ No (in URL hash) |
| User IP (optional)  | ⚠️ Yes (standard)   |

## ⚡ Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- Cloudflare Turnstile keys (optional for dev, but needed for full functionality)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/speakingcat21/file-soldier.git
    cd file-soldier
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Copy the example environment file:
    ```bash
    cp .env.example .env.local
    ```

    Fill in your `.env.local` with your credentials:
    ```env
    # Supabase
    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

    # Database (Supabase requires connection pooling for serverless)
    DATABASE_URL=postgresql://...

    # Better Auth
    BETTER_AUTH_SECRET=generate-random-string
    BETTER_AUTH_URL=http://localhost:3000

    # Turnstile (Optional for local dev if disabled in code)
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key
    TURNSTILE_SECRET_KEY=your-secret-key
    ```

4.  **Database Migration**
    Push the schema to your Supabase database:
    ```bash
    npm run db:push
    ```

5.  **Run Development Server**
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) to see the app.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
