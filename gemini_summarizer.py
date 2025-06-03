import requests
import json
import sys

from dotenv import load_dotenv
import os

load_dotenv()  # loads variables from .env

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_ENDPOINT = os.getenv("GEMINI_API_ENDPOINT") + "?key=" + GEMINI_API_KEY
MODEL = os.getenv("MODEL")


def summarize_resume(resume_text):
    # Construct the prompt with clear instructions for summarizing the resume.
    prompt = (
        "You are a helpful assistant that summarizes resumes in a professional tone. "
        "Summarize the following resume text, highlighting key skills, experiences, and achievements:\n\n"
        + resume_text
    )
    
    headers = {
        "Content-Type": "application/json"
    }
    
    # The API expects a JSON payload with "contents" containing parts of text.
    data = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }

    try:
        response = requests.post(GEMINI_API_ENDPOINT, headers=headers, json=data)
        response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)

        result = response.json()
        # Extract the generated summary from the nested structure.
        summary = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
        return summary

    except requests.exceptions.RequestException as e:
        raise Exception(f"Gemini API request error: {e}")
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        raise Exception(f"Gemini API response parsing error: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python gemini_summarizer.py <resume_text>", file=sys.stderr)
        sys.exit(1)
        
    resume_text = sys.argv[1]
    try:
        summary = summarize_resume(resume_text)
        print(summary)
    except Exception as e:
        print(f"Error summarizing resume with Gemini API: {e}", file=sys.stderr)
        sys.exit(1)
