import subprocess
import json
import nltk
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('wordnet')

data = {
    "resume_text": "Experienced software developer skilled in Python, machine learning, and web development.",
    "job_descriptions": [
        "Looking for a Python developer with experience in AI and machine learning.",
        "Seeking a web designer with expertise in HTML, CSS, and UI/UX."
    ]
}


json_data = json.dumps(data)

try:
    result = subprocess.run(
        ["python", "cosinesimilarity.py"], 
        input=json_data,  # Pass JSON through stdin
        text=True, 
        capture_output=True, 
        check=True  # Raise exception if error occurs
    )
    print("Output:", result.stdout)
except subprocess.CalledProcessError as e:
    print("Error:", e.stderr)
