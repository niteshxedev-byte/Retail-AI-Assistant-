# Recursive DNS Resolution Failure (Railway Domain)

## Simple Explanation

**There is a DNS resolution failure happening recursively because the mobile carrier's DNS server cannot resolve the Railway domain and does not continue the lookup chain.**

---

## How Recursive DNS Should Work

```
Your Computer → asks Carrier DNS: "Where is railway.app?"
                    ↓
         Carrier DNS → asks Root DNS: "Who knows .app?"
                    ↓
         Root DNS → says: "Ask the .app TLD server"
                    ↓
         Carrier DNS → asks .app TLD: "Who knows railway.app?"
                    ↓
         .app TLD → says: "Ask Railway's DNS server"
                    ↓
         Carrier DNS → asks Railway DNS: "What's the IP?"
                    ↓
         Railway DNS → returns IP address
                    ↓
         Carrier DNS → caches and returns to you ✅
```

---

## What’s Actually Happening (Failure Case)

```
Your Computer → asks Carrier DNS: "Where is railway.app?"
                    ↓
         Carrier DNS → checks internal rules/blocklist
                    ↓
         Carrier DNS → blocks or fails lookup
                    ↓
         Your Computer → "Server Not Found" ❌
```

**Failure Point:** The recursive chain stops at the carrier DNS resolver.

---

## Technical Explanation (For Developers)

> The issue is a recursive DNS resolution failure. The mobile carrier's DNS resolver does not complete iterative queries for `.up.railway.app` domains. This suggests either resolver-level blocking (e.g., RPZ filtering) or failure to follow delegation chains. The same domains resolve correctly on Wi-Fi because a different DNS resolver completes the recursion successfully.

---

## Simple Explanation (Non-Technical)

> The mobile carrier's DNS system behaves like a phonebook that doesn't know an address and refuses to ask other phonebooks for help. A home ISP works because it continues asking until it finds the correct address.

---

## Bug Report Template

```
Issue: Recursive DNS resolution failure for Railway domains on mobile network

Symptoms:
- `.up.railway.app` domains fail to resolve on mobile data
- Same domains work on Wi-Fi
- Other domains resolve normally

Root Cause:
Mobile carrier DNS resolver does not complete recursive resolution. Possible causes:
- Domain blocked via RPZ (Response Policy Zone)
- Failure to follow CNAME/DNAME or delegation chain

Expected Behavior:
Resolver should query:
Root DNS → .app TLD → Railway authoritative DNS → return IP

Actual Behavior:
Resolution stops at carrier DNS without querying upstream servers

Workarounds:
- Use public DNS (e.g., 8.8.8.8)
- Enable Private DNS on device
- Use VPN
```

---

## One-Liners

* My mobile carrier's DNS resolver refuses to recursively resolve Railway domains.
* The recursive DNS lookup chain breaks at the carrier's nameserver.
* Mobile DNS does not query authoritative servers for `.up.railway.app`.
* Recursive resolution fails due to ISP-level filtering.

---

## Visual Summary

```
NORMAL (Wi-Fi):
[You] → [ISP DNS] → [Root] → [.app TLD] → [Railway DNS] → [IP] ✅

BROKEN (Mobile):
[You] → [Carrier DNS] → ❌
```

---

## Correct Terminology

| Casual Description        | Technical Term                    |
| ------------------------- | --------------------------------- |
| Phonebook missing address | Recursive resolution failure      |
| Carrier blocked it        | RPZ filtering / NXDOMAIN response |
| Doesn't ask for help      | No iterative queries              |
| Works on Wi-Fi only       | ISP-specific DNS filtering        |

---

## Final Statement

> Recursive DNS resolution for `.up.railway.app` fails because the mobile carrier's DNS resolver does not perform iterative queries to root, TLD, or authoritative nameservers, likely due to resolver-level filtering (RPZ).
