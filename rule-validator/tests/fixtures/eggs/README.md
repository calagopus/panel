# Egg fixtures

Real-world Pterodactyl-format egg JSON files vendored from upstream egg repos to
test that `rule-validator` parses every rule string they contain. Both panels
write the `rules` field as a single pipe-delimited string (e.g.
`"required|string|max:20"`); the test splits on `|` before calling
`validate_rules`.

Files here are unmodified copies. Upstream `LICENSE` files are reproduced next
to the eggs they cover.

## Sources

Each file is pinned to a specific upstream commit. To refresh, re-pin the SHA
and re-copy.

| Local path                         | Upstream                    | Commit SHA                                 |
|------------------------------------|-----------------------------|--------------------------------------------|
| `pterodactyl/minecraft-paper.json` | pterodactyl/game-eggs       | `fdeead688aac4d5a67a5116a8dc07bef691e7588` |
| `pterodactyl/factorio.json`        | pterodactyl/game-eggs       | `fdeead688aac4d5a67a5116a8dc07bef691e7588` |
| `pterodactyl/ark-survival.json`    | pterodactyl/game-eggs       | `fdeead688aac4d5a67a5116a8dc07bef691e7588` |
| `pelican/minecraft-paper.json`     | pelican-eggs/minecraft      | `75bf05db3c6c305e0fa6eef1d38c7e7176121de9` |
| `pelican/steamcmd-rust.json`       | pelican-eggs/games-steamcmd | `46dc04e7375af97695b3753dc815fba200676596` |
| `pelican/generic-nodejs.json`      | pelican-eggs/generic        | `0080f55043d7849b81ef6abc4085692d98bab451` |

The single `pelican/LICENSE` covers all three `pelican-eggs/*` source repos
(verified identical at the pinned SHAs).

Both upstreams are MIT-licensed.
