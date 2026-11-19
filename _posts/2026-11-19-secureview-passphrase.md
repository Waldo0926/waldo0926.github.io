---
layout: post
date: 2026-11-19 11:30:00 +0800
project: SecureView
description: "In SecureView the server never sees the passphrase that opens your files, so it can't check it either. We measured what Argon2id costs a user and an attacker, found the weak point was the 10 character rule, and moved the checks into the browser."
ref: secureview-passphrase
lang: en
source_repo: SecureView
source_checked: 2026-11-19
title: "The password our server never sees"
tags: [Security, Argon2id, Web Crypto, Threat modelling]
image: /assets/og/secureview-passphrase.png
---

[SecureView](https://secureview.tech), our final-year project, has two secrets per account. The login password is checked by the server like on any site. The encryption passphrase never leaves the browser. It goes through Argon2id to open the account key, and that key opens the file keys. I wrote about the key design [in an earlier post]({% post_url 2026-10-24-secureview-keys %}).

Because the server never gets the passphrase, it can't reject a weak one. For a while the only rule was "at least 10 characters", checked in the browser. That rule let `aaaaaaaaaa` and `password12` through.

## Measuring both sides

Before changing anything we wanted numbers, not a feeling that Argon2id makes it fine.

**What it costs a user.** A public page on the site, `/benchmark/argon2`, runs the same key derivation function the unlock dialog uses, with the same library build and parameters (Argon2id, 64 MiB, 3 passes). On Chrome and Safari on an Apple Silicon Mac and on an iPhone it took 100 to 151 ms. The unlock dialog says it's slow on purpose, but it's a tenth of a second.

**What it costs an attacker.** A script ran the native C implementation with the same parameters, and known-answer test vectors confirmed the browser derives exactly the same key, so the numbers apply to a real stolen key envelope. One 10-core laptop managed about 53 to 58 guesses per second per account. Ten cores only gave 5.3 times one core, because each guess holds 64 MiB and memory bandwidth runs out first.

Rounded up to 60 guesses a second, the threat model's table looks like this for one laptop:

| Passphrase | Time to try them all |
|---|---|
| In the first 10,000 of a guessing list | 2.8 minutes |
| Anywhere in a 10 million entry leaked password list | 1.9 days |
| 10 random lowercase letters | 74,600 years |
| 4 random Diceware words | 1.9 million years |

Even a million laptops would need about 1.9 years for the four random words.

So the conclusion was clear. The key derivation cost was fine. The passphrase rule was the weak link.

## What the browser checks now

Registration, the change passphrase card and the key file reset now refuse a passphrase that:

- is on a common list (the server's login deny list at 10 or more characters, plus common passphrase defaults)
- is repeated or sequential characters
- is mostly your username or email

and they suggest four or more random words instead. A real phrase that happens to contain your name still passes.

The honest limit: this is a browser check, and a modified client can skip it. The threat model marks that finding as mitigated with that sentence attached, not as fixed.

## Two related changes

**Changing the passphrase.** Before, the only way to a new passphrase was the private key file, which should stay locked away somewhere. Settings now has a card that takes the current passphrase, opens the stored key in the browser, seals it again under the new one, and reads it back to check it opens. Neither passphrase leaves the browser, and a stolen session alone can't change it.

**Asking every time.** After the first unlock, the account key used to stay open in the tab for 15 idle minutes. A teammate pointed out that someone with a stolen login could then use a tab the owner had already unlocked. Now every decrypted download and every share asks for the passphrase, and the key is dropped as soon as that one action finishes, whether it worked or not. The key was only ever a non-extractable `CryptoKey` in page memory, never in sessionStorage or IndexedDB, so dropping it really does clear it.

## What we didn't measure

No Android phone, no Firefox and no low-end hardware were tested, and Safari was oddly six times slower at 128 MiB than at 256 MiB. The numbers show there's room to make each guess four times as expensive while staying under 0.6 s per unlock, but we didn't raise it until a cheap Android phone has been measured. All of this is written down in the threat model with the raw results next to it.
