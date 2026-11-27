# Event-sourced application design brief

Complete this briefly before implementation. Remove irrelevant prompts; keep decisions concrete.
This is a working artifact for the task, not a requirement for another permanent document.

## Behavior and scope

- New application or migration from mutable state:
- Required user-visible scenarios and external inputs:
- Target feature, platform, package versions, and integration constraints:
- Existing data and its owner:

## Events

| Event | Fact it records | Payload and identity | Producer and admission | Provenance |
| ----- | --------------- | -------------------- | ---------------------- | ---------- |
| ...   | ...             | ...                  | ...                    | ...        |

Explain opening/import events, ordering and duplicate-input rules, and any nondeterministic
values recorded once. State what validates external commands and loaded histories.

## Projections and views

| Projection | Seed and source events | Consumers | Content reconstructed on replay |
| ---------- | ---------------------- | --------- | ------------------------------- |
| ...        | ...                    | ...       | ...                             |

For a migration, map old reads and writes to these projections and methods. Name obsolete
content setters/stores to remove and any intentionally transient state to retain.

## Sessions and resources

- Session boundary and what survives it:
- Meaning of clear/reset, if present:
- Each input/request/timer/subscription owner and lifetime:
- Shutdown/drain/flush order and protection against late results:
- What enables new live work after restoration:

## Existing data and cutover

For migrations: fresh start, baseline import, or durable conversion; rationale and required
user decision. Record unknown history honestly. Specify conversion validation, retry safety,
recovery, and the point at which the old state stops being authoritative.

## Verification evidence to collect

- Live scenarios and expected content:
- Fresh-instance replay comparison, including IDs and derived outputs:
- Spies/guards proving replay performs no external or nondeterministic work:
- Relevant failure, duplicate-input, cancellation, and session-replacement checks:
- Standalone, gallery, and live-platform checks where applicable:

Identify unresolved decisions separately from facts established by code or requirements.
