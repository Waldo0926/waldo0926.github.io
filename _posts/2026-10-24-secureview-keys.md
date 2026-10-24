---
layout: post
date: 2026-10-24 18:00:00 +0800
project: SecureView
description: "In SecureView the browser encrypts every file and the server never holds a key that opens one. How sharing works under that rule, and what happens when someone forgets their passphrase."
ref: secureview-keys
lang: en
preview: secureview-keys
title: "Sharing files the server cannot read"
---

[SecureView](https://github.com/Waldo0926/SecureView) is the file sharing platform our team built for our final year project at Monash. It is live, and I wrote 182 of the 203 merged pull requests. The rule behind it is simple to say: files are encrypted in the browser, and the server never receives anything that can decrypt them. Not the file, not the file key, not the user's private key, not the passphrase.

The rule is easy to say and hard to keep once you add sharing, forgotten passphrases and stolen sessions. This post walks through how SecureView handles each one.

## Two secrets, not one

Every account has two separate secrets:

- **The login password** proves who you are to the server. The server stores an Argon2id hash of it, like any login.
- **The encryption passphrase** never leaves the browser. It unlocks the account's private key, and the private key unlocks your files.

Keeping them apart is what lets a forgotten login password be reset by email. Taking over someone's mailbox gets you their session, but not their files.

## The key chain

At registration the browser makes everything and sends the server only sealed copies:

```
passphrase  --Argon2id-->       KEK  (key-encryption key)
KEK         --AES-256-GCM-->    opens the AMK  (account master key, random 256-bit)
AMK         --HKDF-SHA256-->    opens the RSA private key (3072-bit by default)
private key --RSA-OAEP-->       opens each file's DEK  (data-encryption key)
DEK         --AES-256-GCM-->    decrypts the file
```

The server stores the wrapped AMK, the encrypted private key, the public key and the Argon2id salt and parameters. With all of that and no passphrase, it still cannot open anything. The browser also runs a self-test before registering: it unlocks what it just sealed and checks the private key matches the public key. The server cannot check that, because it cannot decrypt the bundle.

Each upload gets a fresh random DEK. The browser encrypts the file with it (AES-256-GCM by default, or one of five other AEAD suites the user picks), then wraps the DEK with RSA-OAEP-SHA256 twice: once to the owner's public key, and once to a recovery key whose private half is kept offline. The server receives the ciphertext and the two wrapped DEKs. On download it streams the ciphertext back and the browser decrypts it.

## Sharing is a rewrap

To share a file with Bob, the server cannot help with the cryptography, because it does not have the DEK. So the sender's browser does it:

1. Fetch Bob's public key, and compute its fingerprint from the key itself.
2. Show Bob's name and fingerprint, and warn if it changed since the last share to Bob.
3. Unlock the sender's private key and unwrap the file's DEK.
4. Wrap the same DEK to Bob's public key and send only that.

The server checks permissions: the sender needs SHARE on the file, and Bob cannot get a capability the sender does not have. Then it stores Bob's grant and wrapped DEK, plus an audit event, in one transaction. The file itself is never re-encrypted.

Step 2 is there because the server hands out public keys. A server that swapped Bob's key for its own could read everything shared to "Bob". The fingerprint warning only catches that after the first share, and only if people compare it with what Bob sees in Settings. It is a real limit, and the docs say so.

## Someone forgets their passphrase

This is where "the server holds no keys" stops being free. Forget the passphrase and the AMK is gone, and nothing on the server can bring it back.

The way out is the private key file the browser shows once at registration. That file opens every file the account can reach, so letting its holder set a new passphrase gives them nothing they did not already have. The reset:

- reads the key file in the browser and checks it matches the account's public key
- makes a **new** AMK, wraps it under the new passphrase, and re-encrypts the same private key under it
- reopens both new envelopes locally before sending anything

The key pair does not change, so every file, share and wrapped DEK keeps working and nothing is re-encrypted. Lose both the passphrase and the key file and the files are gone for good. Registration says this in plain words.

## A stolen session must not replace the keys

The server cannot check that the new envelopes open, because it never sees the passphrase or the AMK. Without another check, someone with a stolen session could upload garbage envelopes and lock the owner out of every file.

So replacing the envelopes needs proof of the private key. The server returns a digest that binds the account, the key, both expected revisions and every field of both new envelopes. The browser signs it with the private key (RSA-PSS-SHA256), and the server verifies the signature before writing anything:

```
POST /keys/me/reset-protection/signing-payload  ->  32-byte digest
browser signs the digest with the account private key
POST /keys/me/reset-protection  (envelopes + signature)
  signature from another key  ->  422, nothing changed
  stale revision              ->  409
```

Each signed operation (reset, rewrap, adding a key) has its own domain label in the digest, so a signature for one cannot be replayed as another. Since the reset shipped, the same path also handles changing a passphrase you still know.

## What the server can still see

Key custody is not the same as hiding everything. The server still sees:

- filenames, MIME types and exact file sizes
- who shared what with whom, and when
- the Argon2id envelope, which allows offline guessing of a weak passphrase if the database is stolen

For that last point, the browser refuses passphrases that are common, patterned or mostly the username, and requires at least 10 characters. A modified client could skip those checks. They protect users from their own weak choices, not the server from an attacker.

A server that is actively malicious can also serve old ciphertext or a swapped key bundle. The design gives zero-knowledge key custody at the API, not protection from a hostile operator.

## Takeaways

- Write down what the server must never receive, and check every endpoint against it.
- If the server cannot validate something, ask the client to prove it, like the signed envelope replacement.
- Recovery has to be designed with the encryption, not added later. Here it is a file the user keeps, and the docs say what losing it costs.
- Write the limits down. A security claim reads better when it says what it does not cover.

More detail: [`docs/SECURITY_FLOWS.md`](https://github.com/Waldo0926/SecureView/blob/main/docs/SECURITY_FLOWS.md), and the browser code in [`frontend/src/crypto/`](https://github.com/Waldo0926/SecureView/tree/main/frontend/src/crypto) (`share.ts`, `passphrase-reset.ts`).
