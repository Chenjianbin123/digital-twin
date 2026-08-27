# Real SWP Events Integration Plan

**Goal:** Feed active SWP call and alarm events plus call-response metrics into the digital-twin alert workflow without replacing the existing realtime and device-state sources.

## Scope

- Query active call and alarm events for the selected ward.
- Normalize unstable backend records into a stable frontend event contract.
- Match events to rooms and beds only when explicit identifiers are available.
- Merge real events into the existing alert queue with stable-ID deduplication.
- Query and summarize call-response timeliness for nurse-station metrics.
- Preserve the existing configurable alert acknowledgement write-back path.

## Tasks

1. Add raw SWP response and normalized event types.
2. Implement and test event normalization, location matching, stable IDs, and response metrics.
3. Add typed API clients for calls, alarms, and response timeliness.
4. Implement and test a ward-scoped poller with stale-response isolation and a re-entry lock.
5. Extend the twin store to own SWP events, metrics, and synchronization state.
6. Merge SWP events into alert tasks and expose source state in the nurse-station UI.
7. Run unit tests, type checking, production build, and focused code review.

## Constraints

- Poll only `eventStatus: '0'` for active events.
- Do not infer a bed from free-form display names.
- Treat response-timeliness records as historical metrics, not live alerts.
- Clear ward-scoped SWP state when switching wards and ignore late responses.
- Do not invent a SWP acknowledgement endpoint.
