# LMCrooms

LMCrooms is a full-stack application for managing room reservations. The project is split into a Django REST API backend and a React/Vite frontend.

## Project structure

- `backend/` – Django + Django REST Framework API
- `frontend/` – React + Vite client application

## Tech stack

### Backend
- Python 3.11+
- Django 5.x
- Django REST Framework
- PostgreSQL
- python-dotenv

### Frontend
- React 19
- Vite 8
- React Router
- Axios

## Getting started

### Backend

1. Go to the `backend/` directory.
2. Create and activate a virtual environment:
   - Windows: `py -m venv venv` then `.\venv\Scripts\Activate.ps1`
   - macOS/Linux: `python3 -m venv venv` then `source venv/bin/activate`
3. Install dependencies:
   - `pip install -r requirements.txt`
4. Copy `backend/.env.example` to `backend/.env` and update the variables.
5. Run the development server:
   - `python manage.py migrate`
   - `python manage.py runserver`

### Frontend

1. Go to the `frontend/` directory.
2. Install dependencies:
   - `npm install`
3. Start the development server:
   - `npm run dev`

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
