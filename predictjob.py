import sys
import json
import pickle
import re
import string

# Text preprocessing function
def clear_fun(text):
    text = text.lower()
    text = re.sub('\[.*?\]', ' ', text)
    text = re.sub("\\W", " ", text)
    text = re.sub('https?://\S+|www\.\S+', ' ', text)
    text = re.sub('<.*?>+', ' ', text)
    text = re.sub('[%s]' % re.escape(string.punctuation), ' ', text)
    text = re.sub('\n', ' ', text)
    text = re.sub('\w*\d\w*', ' ', text)
    return text

try:
    # Step 1: Read the extracted text from stdin
    extracted_text = sys.stdin.read()

    # Step 2: Preprocess the extracted text
    cleaned_resume = clear_fun(extracted_text)

    # Step 3: Load the TF-IDF vectorizer and Naive Bayes model
    with open('tfidf.pkl', 'rb') as f:
        tfidf = pickle.load(f)
    with open('clf.pkl', 'rb') as f:
        clf = pickle.load(f)

    # Step 4: Transform the cleaned resume using the TF-IDF vectorizer
    input_features = tfidf.transform([cleaned_resume])

    # Step 5: Predict the job role probabilities
    job_probs = clf.predict_proba(input_features)[0]

    # Step 6: Get the top 5 predictions
    top_5_indices = job_probs.argsort()[-5:][::-1]  # Indices of top 5 probabilities
    top_5_jobs = clf.classes_[top_5_indices]  # Corresponding job categories
    top_5_probabilities = job_probs[top_5_indices]  # Corresponding probabilities

    # Step 7: Map category IDs to category names (if necessary)
    category_mapping = {
        6: 'Data Science',
        12: 'HR',
        0: 'Advocate',
        1: 'Arts',
        24: 'Web Designing',
        16: 'Mechanical Engineer',
        22: 'Sales',
        14: 'Health and fitness',
        5: 'Civil Engineer',
        15: 'Java Developer',
        4: 'Business Analyst',
        21: 'SAP Developer',
        2: 'Automation Testing',
        11: 'Electrical Engineering',
        18: 'Operations Manager',
        20: 'Python Developer',
        8: 'DevOps Engineer',
        17: 'Network Security Engineer',
        19: 'PMO',
        7: 'Database',
        13: 'Hadoop',
        10: 'ETL Developer',
        9: 'DotNet Developer',
        3: 'Blockchain',
        23: 'Testing',
    }

    # Map predicted category IDs to names
    top_5_jobs_mapped = [category_mapping.get(idx, "Unknown") for idx in top_5_jobs]

    # Step 8: Prepare the output as a list of dictionaries
    output = [
        {"category": job, "probability": float(prob)}
        for job, prob in zip(top_5_jobs_mapped, top_5_probabilities)
    ]

    # Step 9: Return top 5 recommended jobs as a JSON string
    print(json.dumps(output))

except Exception as e:
    print(f"❌ Error in Python script: {str(e)}", file=sys.stderr)
    sys.exit(1)