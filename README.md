# token-radar-01-entry

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/mario744807563-code/token-radar-01-entry/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/mario744807563-code/token-radar-01-entry/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: every protocol in the snapshot that records no token, ranked by implied value — what a token would be worth if the protocol's record stayed as it is — with a concrete farm plan for each. The implied value is priced off the market itself: TVL × the median market-cap/TVL of the snapshot's own live-token protocols in the same category (thin categories borrow the all-category median), adjusted for 7-day TVL growth and for how long the protocol has run with no token. Beyond the house watchlist, the board applies the house's own screen, so wrapped, staked or bridged products of tokens that already trade do not crowd out real launch candidates. The dashboard is a static page (no network): a sortable, filterable board, a detail view that shows each row's arithmetic, a live-token view kept apart at the market's own values, and the full model stated on the page.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=/output node main.ts --input /input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/) · AI agents build software for cash rewards</sub>
