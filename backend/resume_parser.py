"""
AI-powered Resume Parser for healthcare professionals.
Uses OpenAI GPT via emergentintegrations for structured extraction.
Optimized for travel CNAs, LPNs, RNs with many short-term assignments.
"""
import os
import uuid
import json
import re
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

SYSTEM_PROMPT = """You are an expert healthcare resume parser. Extract structured data from resumes of healthcare professionals (CNAs, LPNs, RNs, allied health). 

RULES:
- Extract ALL data you can find. Prefer "good enough" over missing data.
- For travel nurses/CNAs with many short assignments: GROUP them by agency/employer rather than listing individually.
- Normalize job titles: "Nurse Aide" → "CNA", "Registered Nurse" → "RN", etc.
- Normalize specialties: ICU, Med-Surg, Telemetry, ER/ED, LTC, SNF, etc.
- Support partial dates (MM/YYYY, YYYY, "Present"/"Current").
- Extract clinical skills (Epic, Cerner, ADLs, vitals, catheter care, trach care, etc.)
- Ignore generic resume filler.
- For each field, assign confidence: "high" (explicit data), "medium" (inferred), "low" (ambiguous).

Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "full_name": "",
  "first_name": "",
  "last_name": "",
  "credentials_suffix": [],
  "email": "",
  "phone": "",
  "address": {"city": "", "state": "", "zip": ""},
  "professional_summary": "",
  "specialties": [],
  "skills": [],
  "licenses": [{"license_type": "", "state": "", "license_number": "", "expiration_date": "", "compact": false, "confidence": "high|medium|low"}],
  "certifications": [{"name": "", "issuer": "", "expiration_date": "", "confidence": "high|medium|low"}],
  "education": [{"institution": "", "degree": "", "field_of_study": "", "start_date": "", "end_date": "", "confidence": "high|medium|low"}],
  "employment_groups": [
    {
      "group_type": "travel_contract_group|permanent_role|staffing_agency_group",
      "display_title": "",
      "primary_employer": "",
      "role_title": "",
      "start_date": "",
      "end_date": "",
      "currently_working": false,
      "locations": [],
      "specialties": [],
      "assignment_count_estimate": null,
      "description_summary": "",
      "responsibilities": [],
      "source_assignments": [{"facility_name": "", "agency_name": "", "location": "", "unit": "", "role_title": "", "start_date": "", "end_date": "", "description": "", "confidence": "high|medium|low"}],
      "confidence": "high|medium|low"
    }
  ],
  "work_history_mode": "condensed",
  "availability": {"shift_preferences": [], "start_date": "", "travel_interest": null, "preferred_states": []}
}"""


async def parse_resume_text(text: str) -> dict:
    """Parse resume text using GPT and return structured profile data."""
    if not EMERGENT_LLM_KEY:
        return {"error": "LLM key not configured", "raw_text": text}

    session_id = f"resume-parse-{uuid.uuid4()}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=SYSTEM_PROMPT,
    ).with_model("openai", "gpt-4.1")

    message = UserMessage(text=f"Parse this healthcare resume and return structured JSON:\n\n{text[:8000]}")

    try:
        response = await chat.send_message(message)
        # Clean response - strip markdown code blocks if present
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        parsed = json.loads(cleaned)
        parsed["_parse_metadata"] = {
            "parser_version": "1.0",
            "model": "gpt-4.1",
            "parsed_at": datetime.now(timezone.utc).isoformat(),
            "text_length": len(text),
        }
        return parsed
    except json.JSONDecodeError:
        return {
            "error": "Failed to parse GPT response as JSON",
            "raw_response": response[:500] if response else None,
            "raw_text": text[:500],
        }
    except Exception as e:
        return {
            "error": str(e),
            "raw_text": text[:500],
        }


async def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extract text from PDF or DOCX files."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            return text.strip()
        except ImportError:
            return "[PDF parsing requires PyMuPDF. Install with: pip install PyMuPDF]"
        except Exception as e:
            return f"[PDF extraction error: {str(e)}]"

    elif ext in ("doc", "docx"):
        try:
            import docx
            import io
            doc = docx.Document(io.BytesIO(file_bytes))
            text = "\n".join([p.text for p in doc.paragraphs])
            return text.strip()
        except ImportError:
            return "[DOCX parsing requires python-docx. Install with: pip install python-docx]"
        except Exception as e:
            return f"[DOCX extraction error: {str(e)}]"

    elif ext == "txt":
        return file_bytes.decode("utf-8", errors="ignore").strip()

    return f"[Unsupported file type: {ext}]"
