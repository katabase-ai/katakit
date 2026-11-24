# [Platform] application starter

[Describe the implemented input-to-Katakit-to-result interaction. State important
restrictions and whether it is experimental. Link to the platform guide.]

## Prerequisites

[Exact supported runtime/package-manager requirements and host requirements.
List required permissions, downloads, services, accounts/costs, and environment
variable names. Never include credential values. For server applications, explain
which process needs each credential and how local testing avoids live services.]

## Copy and run

[Give exact commands from a directory copied outside the repository. Include
install, build/check, run, and any host installation steps. Explain the expected
result and first-use behavior. Adapt the heading/commands to the platform.]

```sh
# Replace with the starter's actual commands; verify from the standalone copy.
pnpm install
pnpm build
```

## Where to change it

- [Input owner and file; normalization and identity rules.]
- [Katakit assembly and application events/projections.]
- [UI or service output and subscriptions.]
- [Permissions, assets, service configuration, and platform bootstrap.]

## Data and resource ownership

[State where input and application data are processed/stored, what leaves the
device/server, retention and clearing behavior, and first-run provider downloads.
Identify who stops/drains/cancels/unsubscribes/releases each resource. For a server,
include request/session lifetimes, admission, retry/duplicate handling, and shutdown.
Keep application content replayable without redoing external effects.]

## Verification

### Automated checks

[Exact commands, tested behavior, fixture/mock boundaries, and outcomes. State
whether dependencies came from npm or packed checkout libraries. These checks
must not need live credentials, microphone input, or model downloads.]

### Platform checks

[Record date where known, source revision, OS/host versions, and actual outcomes.
Do not fill in “passed” until a scenario was exercised. Include the real input,
observable result, repeated use, shutdown/reopen, and a meaningful failure path.]

| Scenario                                           | Result and evidence               |
| -------------------------------------------------- | --------------------------------- |
| [Real platform input produces the expected output] | [Passed/failed/not run; evidence] |
| [Repeated use and state lifetime]                  | [Passed/failed/not run; evidence] |
| [Relevant permission/authentication/input failure] | [Passed/failed/not run; evidence] |
| [Stop/cancel/shutdown and reopen/restart]          | [Passed/failed/not run; evidence] |

### Screenshot provenance

<!-- Omit this subsection when the guide has no screenshot. -->

[Asset path, capture date, OS/host version, source revision/dependency source,
displayed sample or idle state, and how it was captured. Identify fixture-driven
input and anything the screenshot does not verify. Never use personal data.]

### Remaining limitations

[Specific unverified scenarios and unsupported capabilities; distinguish future
work from existing behavior. Keep the guide's brief limitations summary in sync.]

## Deployment or distribution

[Verified hosting/packaging steps and platform-specific requirements. Mark any
untested deployment path explicitly rather than presenting it as supported.]

## References

[Link to the authored guide and public API docs instead of duplicating them.]
