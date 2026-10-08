# Research Opportunity Portal

A web app where faculty can post, view, update, close and delete research opportunities in one place.

**GitHub Repository:** https://github.com/YOUR_USERNAME/research-opportunity-portal   <!-- TODO -->

**Author:** YOUR NAME — Roll No: P24-0000 — Class: YOUR CLASS

## Tech Stack
- Backend: Python + Flask
- Database: MySQL (via PyMySQL)
- Frontend: HTML, CSS, JavaScript, Bootstrap 5 (CDN)
- Testing: Postman

## Folder Structure
```
research-opportunity-portal/
├── backend/        app.py, requirements.txt, .env.example, schema.sql
├── frontend/       index.html, style.css, app.js
├── postman/        postman_collection.json
├── README.md
└── .gitignore
```

## Prerequisites
- Python 3.9+ (check with `python --version` or `python3 --version`)
- MySQL Server running locally

## Setup & Run

1. Create the database:
   ```bash
   mysql -u root -p < backend/schema.sql
   ```
2. (Recommended) create a virtual environment:
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate        # Windows
   source venv/bin/activate     # macOS/Linux
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   If `pip` is restricted on a shared/university PC, try:
   ```bash
   pip install --user -r requirements.txt
   ```
4. Configure environment variables:
   ```bash
   copy .env.example .env     # Windows
   cp .env.example .env       # macOS/Linux
   ```
   Edit `.env` and set your real MySQL password.
5. Start the server:
   ```bash
   python app.py
   ```
6. Open the app: http://localhost:3000

## REST API

| Method | Endpoint                 | Description            | Success | Errors |
|--------|---------------------------|------------------------|---------|--------|
| POST   | /api/opportunities        | Create an opportunity  | 201     | 400, 500 |
| GET    | /api/opportunities        | Get all opportunities  | 200     | 500 |
| GET    | /api/opportunities/:id    | Get one opportunity    | 200     | 400, 404, 500 |
| PUT    | /api/opportunities/:id    | Update an opportunity  | 200     | 400, 404, 500 |
| DELETE | /api/opportunities/:id    | Delete an opportunity  | 200     | 400, 404, 500 |

### Opportunity fields
```json
{
  "title": "Machine Learning for Medical Imaging",
  "description": "Develop deep learning models...",
  "research_area": "Artificial Intelligence",
  "faculty_name": "Dr. Ayesha Khan",
  "department": "Computer Science",
  "required_skills": "Python, PyTorch",
  "available_positions": 2,
  "application_deadline": "2026-12-31",
  "status": "Open"
}
```
`status` is `Open` or `Closed` (defaults to `Open`). `PUT` accepts any subset of fields, e.g. `{ "status": "Closed" }` to close an opportunity.

## Testing with Postman
Import `postman/postman_collection.json`, start the server, then run the requests in order (1–10). They cover: creating 3 opportunities, get all, get one, update, closing an opportunity, delete, a 404 after deletion, and a 400 validation error.

## Frontend Features
List all opportunities, view full details, create (with form validation), edit, close (Open → Closed), delete (with confirmation), success/error messages, search and status filter. All data comes from the API — nothing is hard-coded.

## Security
`.env` is git-ignored and never committed. Use `backend/.env.example` as a template.
