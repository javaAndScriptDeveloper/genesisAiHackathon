# DeviceRow

An integration row for a watch or health service: name, what syncs, state, action.

**Markup:** `.ds-device` > `__icon` (a generic icon; the service's official logo only as a file from the service), `__body` (`__name`, `__status`), and a Badge or Button on the right.

**Consumer provides:** service name, state (`connected` / `available` / `error`), last sync time or the list of synced data, the action.

- Connected → `--success` Badge “Connected”; available → `secondary` Button “Connect”; error → status in `danger` + `ghost` Button “Reconnect”.
- Order in the list follows integration priority; the component doesn't depend on how many there are.
