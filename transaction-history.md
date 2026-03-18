# Transaction History List

A scrollable list component that displays a user's recent wallet activity — transfers, card purchases, loyalty points, and more.

## Anatomy

Each row consists of three parts:

| Part | Description |
|---|---|
| **Avatar** | Contact photo, merchant logo, or a fallback action icon (e.g. arrow for transfers) |
| **Label** | Bold title (recipient or merchant name) + muted subtitle (transaction type) |
| **Amount** | Right-aligned amount in ARS; optional secondary line in USD; optional status badge |

## Transaction Types

| Type | Icon | Amount format |
|---|---|---|
| Transfer (outgoing) | Arrow up icon | `-500 ARS / -3,23 USD` |
| Transfer (incoming) | Contact photo | `+500 ARS` |
| Card purchase | Merchant logo | `-500 ARS / -3,23 USD` |
| Loyalty points | Astropoints icon | `+ ✦ 40` |

## Status Badges

Badges appear instead of (or below) the secondary amount line.

| Badge | Color | Meaning |
|---|---|---|
| `Pending` | Gold / amber | Transaction is awaiting processing |
| `Promo` | Teal | Amount was covered or discounted by a promotion |

## States

- **Default** — completed transaction, no badge
- **Pending** — gold badge, amount shown normally
- **Promo** — teal badge indicating promotional credit applied

## Design Notes

- Background: dark (`#0d0d0d` range) with a subtle purple/blue border glow on the container
- Typography: white for titles and amounts, muted gray for subtitles
- Avatars are circular, ~40px, with a dark fill fallback for icon-based entries
- Negative amounts are plain white; positive amounts use the same weight but may use a `+` prefix
- Row dividers are implicit (spacing only, no visible lines)
