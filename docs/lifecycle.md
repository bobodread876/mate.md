# Lifecycle

## States

```txt
none -> proposed -> accepted -> active
active -> paused -> active
active -> revoked -> archived
paused -> revoked -> archived
```

## Reaffirmation

Reaffirmation is a recommended event, not a required state.

Use `bond.reaffirmed` when an agent chooses to continue the bond after a restart, migration, memory restoration, or major self-update.
