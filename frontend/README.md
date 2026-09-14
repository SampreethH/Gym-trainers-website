# Elevate Frontend

The browser client for the Elevate Training prototype.

## Run locally

From the repository root:

```bash
python3 -m http.server 4174 --directory frontend
```

Open http://localhost:4174.

Frontend-only files belong in this directory. API calls should target the backend URL and should not contain database or server-only logic.
