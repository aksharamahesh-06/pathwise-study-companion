# PathWise

PathWise turns study PDFs into a focused revision workspace: summaries, flashcards, practice tests, long-answer prompts, weak-topic feedback, and a downloadable study pack.

## Features

- Upload a PDF and extract its text with the FastAPI backend.
- Generate an AI study summary, flashcards, 20 multiple-choice questions, and long-answer practice with Groq.
- Fall back to locally generated study material if the AI service is unavailable.
- Take a 10- or 20-question practice test, review answers, and see topics to revisit.
- Download a study pack as an HTML file that can be printed or saved as PDF.
- Reopen up to 10 recent study sessions from **My Studies**. History is stored in the current browser and device; the original PDF is not retained in the history.

## Technology

- Frontend: React, Vite, and React Markdown
- Backend: FastAPI, PyPDF, and Groq API
- Hosting: Render Blueprint (one static frontend and one Python API)

## Run locally

Requirements: Node.js and Python 3.14.

1. Copy `backend/.env.example` to `backend/.env` and put your Groq API key in the local `.env` file. Never commit `.env` or put a real key in `.env.example`.
2. In a terminal, start the backend:

   ```powershell
   cd backend
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

3. In a second terminal, start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

The frontend uses `http://127.0.0.1:8000` by default. Set `VITE_API_URL` in `frontend/.env.local` only if the backend runs at another address. Set `CORS_ORIGINS` in `backend/.env` to a comma-separated list of frontend origins if needed.

## Deploy on Render

The root `render.yaml` defines the frontend and API. Connect the repository to Render and create a Blueprint from it. Render will ask for `GROQ_API_KEY`; enter the key as a Render secret, never in a committed file. The service URLs are wired together by the Blueprint.

The Blueprint uses Render's free API service. Free services can sleep when idle, so the first request after a quiet period can take about a minute. See [Render's free service limits](https://render.com/docs/free).

## Privacy and secrets

- The backend sends extracted PDF text to Groq when AI generation is enabled. Do not upload confidential material unless you are comfortable with that service processing it.
- Uploaded PDFs are only needed during analysis; the app's study history saves generated results in the user's browser, not the original PDF.
- Keep API keys in local `.env` files or the hosting provider's secret settings. Rotate any key that has been exposed.
