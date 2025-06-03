import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import LabelEncoder
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import accuracy_score
import pickle
import re
import string

# Load the dataset
df = pd.read_csv('D:\\Downloads\\archive (3)\\UpdatedResumeDataSet.csv')

# Data preprocessing
def clear_fun(text):
    text = text.lower()
    text = re.sub('\[.*?\]', ' ', text)
    text = re.sub("\\W"," ",text)
    text = re.sub('https?://\S+|www\.\S+', ' ', text)
    text = re.sub('<.*?>+', ' ', text)
    text = re.sub('[%s]' % re.escape(string.punctuation), ' ', text)
    text = re.sub('\n', ' ', text)
    text = re.sub('\w*\d\w*', ' ', text)
    return text

df['Resume'] = df['Resume'].apply(clear_fun)

# Encode the categories
le = LabelEncoder()
df['Category'] = le.fit_transform(df['Category'])

# TF-IDF Vectorization
tfidf = TfidfVectorizer(stop_words='english')
requredTaxt = tfidf.fit_transform(df['Resume'])

# Split the data
X_train, X_test, y_train, y_test = train_test_split(requredTaxt, df['Category'], test_size=0.2, random_state=42)

# Train the Multinomial Naive Bayes model with alpha parameter
clf = MultinomialNB(alpha=0.9)  # You can change alpha to any value you find appropriate
clf.fit(X_train, y_train)

# Evaluate the model
ypred = clf.predict(X_test)
print("Accuracy Score:", accuracy_score(y_test, ypred))

# Save the model and TF-IDF vectorizer
pickle.dump(tfidf, open('tfidf.pkl', 'wb'))
pickle.dump(clf, open('clf.pkl', 'wb'))
pickle.dump(le, open('label_encoder.pkl', 'wb'))  # Save the label encoder as well

# Load the model and TF-IDF vectorizer
clf = pickle.load(open('clf.pkl', 'rb'))
tfidf = pickle.load(open('tfidf.pkl', 'rb'))
le = pickle.load(open('label_encoder.pkl', 'rb'))  # Load the label encoder

# Make predictions on new data
myresume = "skills   programming languages  python  pandas  numpy  scipy  scikit learn  matplotlib   sql  java  javascript jquery    machine learning  regression  svm  naã ve bayes  knn  random forest  decision trees  boosting techniques  cluster analysis  word embedding  sentiment analysis  natural language processing  dimensionality reduction  topic modelling  lda  nmf   pca   neural nets    database visualizations  mysql  sqlserver  cassandra  hbase  elasticsearch  js  dc js  plotly  kibana  matplotlib  ggplot  tableau    others  regular expression  html  css  angular   logstash  kafka  python flask  git  docker  computer vision   open cv and understanding of deep learning education details     data science assurance associate     data science assurance associate   ernst   young llp  skill details   javascript  exprience    months  jquery  exprience    months  python  exprience    monthscompany details   company   ernst   young llp  description   fraud investigations and dispute services   assurance  technology assisted review  tar  technology assisted review  assists in accelerating the review process and run analytics and generate reports     core member of a team helped in developing automated review platform tool from scratch for assisting e discovery domain  this tool implements predictive coding and topic modelling by automating reviews  resulting in reduced labor costs and time spent during the lawyers review     understand the end to end flow of the solution  doing research and development for classification models  predictive analysis and mining of the information present in text data  worked on analyzing the outputs and precision monitoring for the entire tool     tar assists in predictive coding  topic modelling from the evidence by following ey standards  developed the classifier models in order to identify  red flags  and fraud related issues     tools   technologies  python  scikit learn  tfidf      cosine similarity  naã ve bayes  lda  nmf for topic modelling  vader and text blob for sentiment analysis  matplot lib  tableau dashboard for reporting     multiple data science and analytic projects  usa clients   text analytics   motor vehicle customer review data   received customer feedback survey data for past one year  performed sentiment  positive  negative   neutral  and time series analysis on customer comments across all  categories     created heat map of terms by survey category based on frequency of words   extracted positive and negative words across all the survey categories and plotted word cloud     created customized tableau dashboards for effective reporting and visualizations   chatbot   developed a user friendly chatbot for one of our products which handle simple questions about hours of operation  reservation options and so on     this chat bot serves entire product related questions  giving overview of tool via qa platform and also give recommendation responses so that user question to build chain of relevant answer     this too has intelligence to build the pipeline of questions as per user requirement and asks the relevant  recommended questions     tools   technologies  python  natural language processing  nltk  spacy  topic modelling  sentiment analysis  word embedding  scikit learn  javascript jquery  sqlserver    information governance  organizations to make informed decisions about all of the information they store  the integrated information governance portfolio synthesizes intelligence across unstructured data sources and facilitates action to ensure organizations are best positioned to counter information risk     scan data from multiple sources of formats and parse different file formats  extract meta data information  push results for indexing elastic search and created customized  interactive dashboards using kibana     preforming rot analysis on the data which give information of data which helps identify content that is either redundant  outdated  or trivial     preforming full text search analysis on elastic search with predefined methods which can tag as  pii  personally identifiable information  social security numbers  addresses  names  etc   which frequently targeted during cyber attacks   tools   technologies  python  flask  elastic search  kibana    fraud analytic platform  fraud analytics and investigative platform to review all red flag cases   â   fap is a fraud analytics and investigative platform with inbuilt case manager and suite of analytics for various erp systems     it can be used by clients to interrogate their accounting systems for identifying the anomalies which can be indicators of fraud by running advanced analytics  tools   technologies  html  javascript  sqlserver  jquery  css  bootstrap  node js   js  dc js'"

cleaned_resume = clear_fun(myresume)
input_features = tfidf.transform([cleaned_resume])
prediction_id = clf.predict(input_features)[0]

# Mapping of category IDs to category names
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

# Get the predicted category name
predicted_category = le.inverse_transform([prediction_id])[0]
print(f"Predicted Category: {predicted_category}")

# Get the predicted probabilities for each class
predicted_probabilities = clf.predict_proba(input_features)[0]

# Map the probabilities to their respective class labels
class_probabilities = list(zip(le.classes_, predicted_probabilities))

# Sort the probabilities in descending order
sorted_class_probabilities = sorted(class_probabilities, key=lambda x: x[1], reverse=True)

# Get the top 5 predictions
top_5_predictions = sorted_class_probabilities[:5]

# Print the top 5 predictions
print("Top 5 Predictions:")
for class_name, probability in top_5_predictions:
    print(f"Category: {class_name}")