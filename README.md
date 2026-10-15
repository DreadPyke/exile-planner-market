# Exile Planner market data

Every hour, a GitHub Actions job (`.github/workflows/market.yml`) runs `update-market.mjs`, which saves a snapshot
of Path of Exile 2 prices from [poe.ninja](https://poe.ninja/poe2/economy) and publishes it with GitHub Pages:

- `market/index.json`: leagues and the snapshot time
- `market/<league>.json`: prices for one league (in Divine Orbs, with exchange rates)

The Exile Planner app reads these (Market → Refresh prices). poe.ninja asks apps not to call it from every user's
device, so this single cached fetcher does it for everyone.

- **Manual refresh:** Actions → Market snapshot → Run workflow.
- **Updating the script:** it's a copy of `scripts/update-market.mjs` in the Exile Planner project; copy it over
  when that one changes.

Unofficial. Not affiliated with or endorsed by Grinding Gear Games or poe.ninja.
