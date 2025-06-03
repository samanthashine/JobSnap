import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
import re
import string
from pymongo import MongoClient
import logging
from collections import defaultdict

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Function to preprocess text
def preprocess_text(text):
    """Preprocess text by converting to lowercase, removing special characters, and extra spaces."""
    if not text:
        return ""
    # Convert to lowercase
    text = text.lower()
    # Remove special characters, numbers, and extra spaces
    text = re.sub('\[.*?\]', ' ', text)
    text = re.sub("\\W", " ", text)
    text = re.sub('https?://\S+|www\.\S+', ' ', text)
    text = re.sub('<.*?>+', ' ', text)
    text = re.sub('[%s]' % re.escape(string.punctuation), ' ', text)
    text = re.sub('\n', ' ', text)
    text = re.sub('\w*\d\w*', ' ', text)
    text = re.sub('\s+', ' ', text)  # Remove extra spaces
    return text.strip()

# Function to load GloVe embeddings
def load_glove_embeddings(glove_file):
    """Load GloVe embeddings from a file."""
    embeddings = defaultdict(lambda: np.zeros(100))  # Default to zero vector for unknown words
    with open(glove_file, 'r', encoding='utf-8') as f:
        for line in f:
            values = line.split()
            word = values[0]
            vector = np.array(values[1:], dtype='float32')
            embeddings[word] = vector
    logging.info(f"Loaded {len(embeddings)} GloVe embeddings.")
    return embeddings

# Function to compute sentence embeddings
def compute_sentence_embedding(text, embeddings):
    """Compute the average GloVe embedding for a sentence."""
    words = text.split()
    word_vectors = [embeddings[word] for word in words if word in embeddings]
    if len(word_vectors) == 0:
        return np.zeros(100)  # Return zero vector if no words are found in GloVe
    return np.mean(word_vectors, axis=0)

# Function to fetch job details from MongoDB
def fetch_job_details_from_mongodb(connection_string, database_name, collection_name):
    """Fetch job details (account name, job title, and job description) from MongoDB."""
    try:
        client = MongoClient(connection_string)
        db = client[database_name]
        collection = db[collection_name]
        job_details = []
        for doc in collection.find():
            # Fetch the account name (company name) from the document
            account_name = doc.get("name", "Unknown Account")  # Ensure the field name is correct
            logging.info(f"Processing document with account name: {account_name}")

            if "jobs" in doc and isinstance(doc["jobs"], list):  # Check if 'jobs' field exists and is a list
                for job in doc["jobs"]:  # Iterate through the jobs array
                    if "jobDescription" in job and "jobTitle" in job:  # Check if required fields exist
                        job_details.append({
                            "accountName": account_name,  # Include account name
                            "jobTitle": job["jobTitle"],  # Include job title
                            "jobDescription": job["jobDescription"]  # Include job description
                        })
                    else:
                        logging.warning(f"Job in document {doc.get('_id')} is missing required fields.")
            else:
                logging.warning(f"Document {doc.get('_id')} is missing 'jobs' field or it is not a list.")
        logging.info(f"Fetched {len(job_details)} job details from MongoDB.")
        return job_details
    except Exception as e:
        logging.error(f"Error fetching job details from MongoDB: {e}")
        return []

# Function to compute cosine similarity using GloVe embeddings
def compute_cosine_similarity_glove(resume_text, job_descriptions, embeddings):
    """Compute cosine similarity between resume and job descriptions using GloVe embeddings."""
    if not resume_text or not job_descriptions:
        logging.error("Resume text or job descriptions are empty.")
        return None

    # Preprocess the resume and job descriptions
    resume_cleaned = preprocess_text(resume_text)
    job_descriptions_cleaned = [preprocess_text(job["jobDescription"]) for job in job_descriptions]

    # Compute sentence embeddings
    resume_embedding = compute_sentence_embedding(resume_cleaned, embeddings)
    job_embeddings = [compute_sentence_embedding(job, embeddings) for job in job_descriptions_cleaned]

    # Compute cosine similarity between the resume and each job description
    cosine_similarities = cosine_similarity([resume_embedding], job_embeddings).flatten()

    return cosine_similarities

def fetch_user_skills_from_mongodb(connection_string, database_name, collection_name, user_id):
    """Fetch user skills from MongoDB."""
    try:
        client = MongoClient(connection_string)
        db = client[database_name]
        collection = db[collection_name]
        user = collection.find_one({"_id": user_id})
        if user and "resume" in user and "Skills" in user["resume"]:
            # Split skills into a list
            skills = user["resume"]["Skills"].split(", ")
            return skills
        return []
    except Exception as e:
        logging.error(f"Error fetching user skills from MongoDB: {e}")
        return []

def main():
    # Sample resume text
    resume_text = """
    skills   programming languages  python  pandas  numpy  scipy  scikit learn  matplotlib   sql  java  javascript jquery    machine learning  regression  svm  naã ve bayes  knn  random forest  decision trees  boosting techniques  cluster analysis  word embedding  sentiment analysis  natural language processing  dimensionality reduction  topic modelling  lda  nmf   pca   neural nets    database visualizations  mysql  sqlserver  cassandra  hbase  elasticsearch  js  dc js  plotly  kibana  matplotlib  ggplot  tableau    others  regular expression  html  css  angular   logstash  kafka  python flask  git  docker  computer vision   open cv and understanding of deep learning education details     data science assurance associate     data science assurance associate   ernst   young llp  skill details   javascript  exprience    months  jquery  exprience    months  python  exprience    monthscompany details   company   ernst   young llp  description   fraud investigations and dispute services   assurance  technology assisted review  tar  technology assisted review  assists in accelerating the review process and run analytics and generate reports     core member of a team helped in developing automated review platform tool from scratch for assisting e discovery domain  this tool implements predictive coding and topic modelling by automating reviews  resulting in reduced labor costs and time spent during the lawyers review     understand the end to end flow of the solution  doing research and development for classification models  predictive analysis and mining of the information present in text data  worked on analyzing the outputs and precision monitoring for the entire tool     tar assists in predictive coding  topic modelling from the evidence by following ey standards  developed the classifier models in order to identify  red flags  and fraud related issues     tools   technologies  python  scikit learn  tfidf      cosine similarity  naã ve bayes  lda  nmf for topic modelling  vader and text blob for sentiment analysis  matplot lib  tableau dashboard for reporting     multiple data science and analytic projects  usa clients   text analytics   motor vehicle customer review data   received customer feedback survey data for past one year  performed sentiment  positive  negative   neutral  and time series analysis on customer comments across all  categories     created heat map of terms by survey category based on frequency of words   extracted positive and negative words across all the survey categories and plotted word cloud     created customized tableau dashboards for effective reporting and visualizations   chatbot   developed a user friendly chatbot for one of our products which handle simple questions about hours of operation  reservation options and so on     this chat bot serves entire product related questions  giving overview of tool via qa platform and also give recommendation responses so that user question to build chain of relevant answer     this too has intelligence to build the pipeline of questions as per user requirement and asks the relevant  recommended questions     tools   technologies  python  natural language processing  nltk  spacy  topic modelling  sentiment analysis  word embedding  scikit learn  javascript jquery  sqlserver    information governance  organizations to make informed decisions about all of the information they store  the integrated information governance portfolio synthesizes intelligence across unstructured data sources and facilitates action to ensure organizations are best positioned to counter information risk     scan data from multiple sources of formats and parse different file formats  extract meta data information  push results for indexing elastic search and created customized  interactive dashboards using kibana     preforming rot analysis on the data which give information of data which helps identify content that is either redundant  outdated  or trivial     preforming full text search analysis on elastic search with predefined methods which can tag as  pii  personally identifiable information  social security numbers  addresses  names  etc   which frequently targeted during cyber attacks   tools   technologies  python  flask  elastic search  kibana    fraud analytic platform  fraud analytics and investigative platform to review all red flag cases   â   fap is a fraud analytics and investigative platform with inbuilt case manager and suite of analytics for various erp systems     it can be used by clients to interrogate their accounting systems for identifying the anomalies which can be indicators of fraud by running advanced analytics  tools   technologies  html  javascript  sqlserver  jquery  css  bootstrap  node js   js  dc js
    """

    # Load GloVe embeddings
    glove_file = "glove.6B.100d.txt"  # Path to your GloVe file
    embeddings = load_glove_embeddings(glove_file)

    # Fetch job details from MongoDB
    connection_string = "mongodb+srv://samanthashine6:ZN5fzq3H-Xa_dpY@group9.yhhkx.mongodb.net/?retryWrites=true&w=majority&appName=group9"
    database_name = "test"
    collection_name = "users"
    job_details = fetch_job_details_from_mongodb(connection_string, database_name, collection_name)

    if not job_details:
        logging.error("No job details found in MongoDB.")
        return

    # Compute cosine similarity using GloVe embeddings
    cosine_similarities = compute_cosine_similarity_glove(resume_text, job_details, embeddings)
    if cosine_similarities is None:
        return

    # Create a DataFrame to store the results
    results = pd.DataFrame({
        'Account Name': [job["accountName"] for job in job_details],
        'Job Title': [job["jobTitle"] for job in job_details],
        'Job Description': [job["jobDescription"] for job in job_details],
        'Cosine Similarity': cosine_similarities
    })

    # Filter jobs with more than 80% similarity
    filtered_results = results[results['Cosine Similarity'] > 0.9]

    if filtered_results.empty:
        logging.info("No jobs found with more than 80% similarity.")
        return

    # Sort the filtered results by cosine similarity in descending order
    filtered_results = filtered_results.sort_values(by='Cosine Similarity', ascending=False)

    # Convert the filtered results to a JSON string
    output = filtered_results.to_json(orient='records', indent=2)

    # Print the output (this will be captured by Node.js)
    print(output)

# Run the main function
if __name__ == "__main__":
    main()