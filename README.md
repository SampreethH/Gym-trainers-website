# Elevate Training Platform

The project is intentionally separated into independent frontend and backend areas.

## Project structure

- `frontend/`: static browser prototype and UI assets
- `backend/`: API/server boundary and backend tests
- `docs/`: technical specification and implementation roadmap

## Run the frontend prototype

```bash
python3 -m http.server 4174 --directory frontend
```

Then open http://localhost:4174.

The backend directory currently contains the server boundary and planned module layout. Backend implementation can be added independently without placing server code in the frontend.
