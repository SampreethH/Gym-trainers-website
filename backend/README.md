# Elevate Backend

The server/API boundary for authentication, role authorization, tenants, programs, workout sessions, nutrition, notifications, realtime events, and admin operations.

## Planned structure

```text
backend/
  src/
    auth/
    clients/
    trainers/
    admin/
    workouts/
    nutrition/
    notifications/
    realtime/
    shared/
  tests/
```

The backend owns database access, credentials, authorization, file uploads, validation, and realtime events. Keep these concerns out of `frontend/`.

The implementation baseline is documented in [`docs/fitness-platform-technical-specification.md`](../docs/fitness-platform-technical-specification.md).
