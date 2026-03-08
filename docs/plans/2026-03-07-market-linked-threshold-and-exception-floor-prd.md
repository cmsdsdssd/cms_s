# PRD: Market-Linked Threshold and Manual Exception Floor

- Document version: v1.0
- Date: 2026-03-07
- Status: Implementable
- Scope: sync policy only; no recompute formula rewrite

---

## Goal

Keep the current V2 market-cost-based target as the source of truth, split sync thresholds into two product groups, and allow a narrow manual floor only for exception SKUs.

## Non-Negotiable Rules

1. Sync still compares `current_channel_price_krw` vs `final_target_price_v2_krw` or its sync-layer equivalent.
2. V2 recompute keeps its no-floor rule.
3. Downsync stays pressure-gated and cooldown-controlled.
4. Manual floor is exception-only, not the default policy.
5. Manual floor input is final channel selling price KRW only.
6. `always_sync` is not the default market-linked policy.

## Product Groups

### GENERAL
- Threshold: `max(5000, round(current_price * 0.02))`
- Intent: prioritize price stability

### MARKET_LINKED
- Threshold: `max(500, round(current_price * 0.005))`
- Intent: reduce stale-price loss on market-sensitive goods

## Exception Floor Policy

### Purpose
Use floor only for a small number of SKUs with real commercial risk.

### Allowed use cases
- high-cost inventory risk
- unstable supplier cost
- temporary MAP/commercial protection
- manual short-term exception handling

### Forbidden use cases
- broad channel-wide anti-downtrend rule
- pseudo inventory accounting
- pre-fee / pre-margin basis input
- replacing threshold policy with floor policy

### Precedence
1. active pricing override
2. manual exception floor
3. recomputed market target
4. threshold + pressure policy decide sync

## Trust Policy

- Market-linked prices should generally follow the market.
- Floors must stay narrow and explicit.
- If floor-protected SKUs become common, the business will look like it moves fast up and slow down.

## Cron Policy

- Current 5-minute cron is acceptable at today's scale.
- For 10k+ SKU scale, 5-minute full-channel recompute should not be the permanent default.
- Long-term default should move toward `15 minutes`, with faster cadence only for proven market-linked subsets if later required.
- Main scale risk is recompute snapshot write amplification, not only sync history tables.

## Canonical Scenarios

### General product
- current `100000`
- target `103000`
- threshold `5000`
- result: no sync

### Market-linked product
- current `100000`
- target `103000`
- threshold `500`
- result: sync

### Exception floor
- recomputed target `128000`
- manual floor `132000`
- current `136000`
- effective desired sync price `132000`

## Acceptance Criteria

1. Threshold profiles differ by group without changing V2 target formula.
2. Manual floor is interpreted only as final selling price KRW.
3. Override/floor/target precedence is explicit.
4. Downsync remains pressure-gated.
5. Cron guidance addresses snapshot table growth.

## Out of Scope

- automatic historical inventory-cost floor
- FIFO / average-cost floor engine
- metal-tier or weight-tier matrix
- global hard floor for all market-linked SKUs
