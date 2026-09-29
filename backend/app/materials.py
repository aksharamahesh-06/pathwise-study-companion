from fastapi import APIRouter, UploadFile, File, HTTPException
from starlette.concurrency import run_in_threadpool
from pathlib import Path
import tempfile

from app.pdf_utils import extract_text_from_pdf
from app.ai_service import generate_analysis
from app.summarizer import (
    generate_summary as generate_local_summary,
    generate_flashcards as generate_local_flashcards,
    generate_long_answer_questions as generate_local_long_answers,
)
from app.mcq_generator import generate_mcqs as generate_local_mcqs

router = APIRouter()

UPLOAD_FOLDER = Path(__file__).resolve().parents[1] / "uploads"
MAX_PDF_SIZE = 20 * 1024 * 1024


@router.post("/upload")
async def upload_material(file: UploadFile = File(...)):

    UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
    filename = Path(file.filename or "").name

    # Allow only PDFs
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported."
        )

    file_path = None
    try:
        UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
        size = 0
        with tempfile.NamedTemporaryFile(
            prefix="pathwise-", suffix=".pdf", dir=UPLOAD_FOLDER, delete=False
        ) as buffer:
            file_path = Path(buffer.name)
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_PDF_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="PDF is too large. Please upload a file smaller than 20 MB.",
                    )
                buffer.write(chunk)

        if size == 0:
            raise HTTPException(status_code=400, detail="The uploaded PDF is empty.")

        # Keep the uploaded document only long enough to extract its text.
        extracted_text = await run_in_threadpool(extract_text_from_pdf, str(file_path))
    finally:
        await file.close()
        if file_path is not None:
            file_path.unlink(missing_ok=True)

    if not extracted_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from PDF."
        )

    # Generate summary and MCQs in one request to reduce latency and token use.
    summary = ""
    flashcards = []
    mcqs = []
    long_answer_questions = []
    summary_error = None
    summary_fallback = False
    flashcards_fallback = False
    long_answers_fallback = False
    mcq_fallback = False
    try:
        summary, flashcards, mcqs, long_answer_questions = await run_in_threadpool(
            generate_analysis, extracted_text
        )
    except Exception as e:
        print("AI analysis generation failed:", str(e))
        try:
            summary = await run_in_threadpool(generate_local_summary, extracted_text)
            summary_fallback = True
        except Exception as fallback_error:
            summary_error = f"Offline summary generation failed: {fallback_error}"

    if not flashcards:
        try:
            flashcards = await run_in_threadpool(generate_local_flashcards, extracted_text)
            flashcards_fallback = bool(flashcards)
        except Exception as fallback_error:
            print("Offline flashcard generation failed:", str(fallback_error))

    if not long_answer_questions:
        try:
            long_answer_questions = await run_in_threadpool(
                generate_local_long_answers, extracted_text
            )
            long_answers_fallback = bool(long_answer_questions)
        except Exception as fallback_error:
            print("Offline long-answer generation failed:", str(fallback_error))

    mcq_error = None
    if not mcqs:
        try:
            mcqs = await run_in_threadpool(generate_local_mcqs, extracted_text)
            mcq_fallback = True
        except Exception as fallback_error:
            mcq_error = f"Offline question generation failed: {fallback_error}"

    fallback_used = (
        summary_fallback or flashcards_fallback or long_answers_fallback or mcq_fallback
    )

    return {
        "message": "File uploaded successfully",
        "filename": file.filename,
        "summary": summary,
        "flashcards": flashcards,
        "long_answer_questions": long_answer_questions,
        "mcqs": mcqs,
        "summary_error": summary_error,
        "mcq_error": mcq_error,
        "analysis_notice": (
            "AI access is unavailable. These basic results were "
            "generated locally from the PDF and are not AI-generated."
            if fallback_used else None
        ),
    }
