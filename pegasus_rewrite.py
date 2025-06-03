from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import sys

def rewrite(summary, job_description):
    """
    Rewrite the resume summary to better match the job description using TF-IDF and cosine similarity.
    """
    # Combine the summary and job description into a single corpus
    corpus = [summary, job_description]

    # Convert the corpus into TF-IDF vectors
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(corpus)

    # Compute cosine similarity between the summary and job description
    similarity_score = cosine_similarity(tfidf_matrix[0], tfidf_matrix[1])[0][0]

    # If the similarity score is low, rewrite the summary to include keywords from the job description
    if similarity_score < 0.9:  # Adjust the threshold as needed
        # Extract keywords from the job description
        job_keywords = vectorizer.get_feature_names_out()

        # Rewrite the summary by adding relevant keywords from the job description
        rewritten_summary = summary + " " + " ".join(job_keywords[:5])  # Add top 5 keywords
    else:
        # If the similarity score is high, keep the original summary
        rewritten_summary = summary

    return rewritten_summary

if __name__ == "__main__":
    # Get the summary and job description from command-line arguments
    summary = sys.argv[1]
    job_description = sys.argv[2]

    # Rewrite the summary
    rewritten_summary = rewrite(summary, job_description)

    # Print the rewritten summary
    print(rewritten_summary)