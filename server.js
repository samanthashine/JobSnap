const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const pdf = require('pdf-parse');
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
const { exec, spawn } = require('child_process'); // Add this for calling Python script
const app = express();

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Set up EJS for rendering HTML
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

// Set up session middleware
app.use(session({
  secret: process.env.SESSION_SECRET, // Replace with a strong secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI,
  {
    useNewUelParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('Error connecting to MongoDB Atlas:', err));

// Define User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  accountType: String,
  resume: Object, // Change from String to Object
  predictedJobs: [
    {
      category: { type: String, required: true },
      probability: { type: Number, required: true },
    },
  ],
  extractedText: String,
  jobs: [
    {
      jobTitle: String,
      jobDescription: String,
      applicants: [
        {
          applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Use ObjectId
          summary: String,
        },
      ],
    },
  ],
});

const User = mongoose.model('User', userSchema);

// Middleware to check if user is logged in
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  next();
};

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Append the file extension
  }
});

const upload = multer({ storage: storage });

// Utility function to compute cosine similarity const { spawn } = require('child_process');

async function getCosineSimilarity(resumeText, jobDescriptions) {
  return new Promise((resolve, reject) => {
    console.log('Starting getCosineSimilarity...');

    // Validate input
    if (!resumeText || !jobDescriptions || !Array.isArray(jobDescriptions)) {
      console.error('Invalid input:', { resumeText, jobDescriptions });
      reject(new Error('Invalid input: resumeText and jobDescriptions are required.'));
      return;
    }

    // Prepare input data
    const inputData = JSON.stringify({
      resume_text: resumeText,
      job_descriptions: jobDescriptions,
    });
    console.log('Input data:', inputData);

    // Call the Python script using spawn
    const pythonProcess = spawn('python', ['cosinesimilarity.py']);
    console.log('Python process spawned.');

    let stdoutData = '';
    let stderrData = '';

    // Send input data to the Python script
    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();
    console.log('Input data sent to Python script.');

    // Collect output from the Python script
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
      console.log('Python script stdout:', data.toString());
    });

    // Collect errors from the Python script
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error('Python script stderr:', data.toString());
    });

    // Handle process completion
    pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}.`);
      if (code !== 0) {
        console.error('[❌ ERROR] Python script failed:', stderrData);
        reject(new Error('Failed to execute Python script.'));
        return;
      }

      try {
        // Parse the output from the Python script
        console.log('Python script output:', stdoutData);
        const result = JSON.parse(stdoutData);
        resolve(result);
      } catch (parseError) {
        console.error('[❌ ERROR] Failed to parse Python script output:', parseError);
        reject(new Error('Failed to parse Python script output.'));
      }
    });
  });
}

// Routes
app.get('/', (req, res) => {
  res.render("home");
});

app.get("/register", (req, res) => {
  res.render("register");
});


app.get("/home", (req, res) => {
  res.render("home"); // This will render home.ejs
});


app.post("/register", async (req, res) => {
  const { name, email, password, accountType } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ name, email, password: hashedPassword, accountType });
  await newUser.save();
  res.redirect('/');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.user = user; // Save user in session
    res.redirect('/profile');
  } else {
    res.send('Invalid email or password');
  }
});

app.get('/login', (req, res) => {
  res.render('login'); // Render the login page (assuming you're using a templating engine like EJS, Pug, etc.)
});

// Profile Route (protected by requireLogin middleware)
app.get('/profile', requireLogin, async (req, res) => {
  try {
    const userEmail = req.session.user.email;

    // Fetch the user document from MongoDB
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.error('[❌ ERROR] User not found in MongoDB.');
      return res.status(404).send('User not found');
    }

    // Extract the predicted jobs from the user document
    const predictedJobs = user.predictedJobs || [];

    // Log the predicted jobs for debugging
    console.log('📌 Predicted Jobs from MongoDB:', predictedJobs);

    // Render the profile page with the predicted jobs
    res.render('profile', {
      user: user,
      predictedJobs: predictedJobs, // Pass predictedJobs to the template
    });
  } catch (error) {
    console.error('[❌ ERROR] in /profile:', error.stack);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/predicted-jobs', requireLogin, async (req, res) => {
  try {
    const userEmail = req.session.user.email;

    // Fetch the user's predicted jobs from MongoDB
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return the predicted jobs
    res.status(200).json({ predictedJobs: user.predictedJobs });
  } catch (error) {
    console.error('[❌ ERROR] in /api/predicted-jobs:', error.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Fetch predicted jobs from the backend API


// Route to add a job (for company accounts)
app.post('/post-job', requireLogin, async (req, res) => {
  const userEmail = req.session.user?.email;
  if (!userEmail) {
    return res.status(401).send('Unauthorized');
  }

  // Check if the user is a company
  const user = await User.findOne({ email: userEmail });
  if (!user || user.accountType !== 'company') {
    return res.status(403).send('Only company accounts can add jobs.');
  }

  const { jobTitle, jobDescription } = req.body;
  if (!jobTitle || !jobDescription) {
    return res.status(400).send('Job title and description are required.');
  }

  try {
    // Add the job to the company's profile
    user.jobs.push({ jobTitle, jobDescription });
    await user.save();

    console.log('✅ Job added successfully:', { jobTitle, jobDescription });
    res.redirect('/profile'); // Redirect to the profile page
  } catch (error) {
    console.error('[❌ ERROR] in /add-job:', error.stack);
    res.status(500).send('Internal Server Error');
  }
});


// Route to delete a job (for company accounts)
app.delete('/delete-job/:id', requireLogin, async (req, res) => {
  const userEmail = req.session.user?.email;
  if (!userEmail) {
    return res.status(401).send('Unauthorized');
  }

  // Check if the user is a company
  const user = await User.findOne({ email: userEmail });
  if (!user || user.accountType !== 'company') {
    return res.status(403).send('Only company accounts can delete jobs.');
  }

  const jobId = req.params.id; // Get the job ID from the URL
  if (!jobId) {
    return res.status(400).send('Job ID is required.');
  }

  try {
    // Remove the job from the company's profile
    user.jobs = user.jobs.filter(job => job._id.toString() !== jobId);
    await user.save();

    console.log('✅ Job deleted successfully:', jobId);
    res.status(200).send('Job deleted successfully');
  } catch (error) {
    console.error('[❌ ERROR] in /delete-job:', error.stack);
    res.status(500).send('Internal Server Error');
  }
});


// Resume Submission Route (for applicants)



const router = express.Router();


const { getDocument } = require('pdfjs-dist');

app.post('/submit-resume', requireLogin, upload.single('resume'), async (req, res) => {
  if (!req.file) {
    console.error('[ERROR] No file uploaded.');
    return res.status(400).send('No file uploaded.');
  }

  const filePath = req.file.path;
  const fileName = req.file.filename;
  const userEmail = req.session.user.email;

  console.log(`✅ File uploaded: ${fileName}`);
  console.log(`📂 File path: ${filePath}`);
  console.log(`🔎 User Email: ${userEmail}`);  
  const allowedMimeTypes = ['application/pdf'];
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    console.error('[❌ ERROR] Invalid file type. Only PDF files are allowed.');
    fs.unlinkSync(filePath); // Delete the uploaded file
    return res.status(400).send('Invalid file type. Only PDF files are allowed.');
  }
  

  try {
    // Step 1: Read and extract text from PDF
    console.log('📄 Extracting text from PDF...');
    const startExtractTime = Date.now();
    let extractedText = '';

    try {
      const dataBuffer = fs.readFileSync(filePath);

      // Convert Buffer to Uint8Array
      const uint8Array = new Uint8Array(dataBuffer);

      // Load the PDF document
      const pdfDocument = await getDocument(uint8Array).promise;

      // Extract text from each page
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        extractedText += textContent.items.map(item => item.str).join(' ');
      }

      console.log(`✅ Text extraction completed in ${Date.now() - startExtractTime} ms`);
      console.log(`🔠 Extracted Text Sample: ${extractedText.substring(0, 200)}...`);
      
    } catch (error) {
      console.error('[❌ ERROR] in PDF extraction:', error.stack);
      return res.status(400).send('Failed to extract text from PDF');
    }

    // Step 2: Save extracted text to MongoDB
    console.log('💾 Saving extracted text to MongoDB...');
    const updateResult = await User.findOneAndUpdate(
      { email: userEmail },
      { extractedText: extractedText },
      { new: true }
    );
    console.log('✅ MongoDB Update Successful:', updateResult ? 'Updated User Document' : 'User Not Found');

    // Step 3: Run Python script with the extracted text
    console.log('🐍 Running Python script...');
    const startPythonTime = Date.now();

    const pythonProcess = spawn('python', ['predictjob.py'], {
      stdio: 'pipe',
    });

    let output = '';
    let debugLogs = '';

    // Send the extracted text to the Python script
    pythonProcess.stdin.write(extractedText);
    pythonProcess.stdin.end();

    pythonProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      console.log('Python Script Output:', dataStr); // Log all output

      // Check if the line is JSON (the final output)
      if (dataStr.trim().startsWith('[') && dataStr.trim().endsWith(']')) {
        output += dataStr; // Capture the final JSON output
      } else {
        debugLogs += dataStr; // Capture debug logs
      }
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[❌ ERROR] in Python script: ${data.toString()}`);
    });

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error(`❌ Python script exited with code ${code}`);
        return res.status(500).send('Error running Python script');
      }

      try {
        const jsonMatch = output.match(/\[.*\]/s); // Extract valid JSON
        if (!jsonMatch) {
          console.error('❌ No valid JSON found in Python output:', output);
          return res.status(500).send('No valid JSON output from Python script');
        }

        const finalJson = jsonMatch[0]; // Extract JSON
        console.log('✅ Extracted JSON:', finalJson);

        const predictedJobs = JSON.parse(finalJson);
        console.log('🔮 Predicted Jobs:', predictedJobs);

        // Step 4: Update predicted jobs in MongoDB
        const updateResult = await User.findOneAndUpdate(
          { email: userEmail },
          { $set: { predictedJobs } }, // Use $set to update the field
          { new: true } // Return the updated document
        );

        if (updateResult) {
          console.log('✅ Predicted jobs updated in MongoDB:', updateResult.predictedJobs);
        } else {
          console.error('❌ User not found or update failed');
        }

        // Step 5: Redirect to the profile page
        res.redirect('/profile');
      } catch (err) {
        console.error('❌ Error parsing JSON output:', err);
        res.status(500).send('Error parsing Python script results');
      }
    });
  } catch (error) {
    console.error('[❌ ERROR] in /submit-resume:', error.stack);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = router;






// Job matching route
// Route to match jobs using cosine similarity
app.post('/match-jobs', requireLogin, async (req, res) => {
  console.log('Match Jobs route executed');
  try {
    const userEmail = req.session.user?.email;
    console.log('User Email:', userEmail); // Log user email
    if (!userEmail) {
      console.error('Unauthorized: No user email found in session');
      return res.status(401).send('Unauthorized');
    }

    // Fetch the user's resume data
    console.time('Fetching User'); // Start timer
    const user = await User.findOne({ email: userEmail });
    console.timeEnd('Fetching User'); // End timer
    console.log('User:', user); // Log user data

    if (!user) {
      console.error('User not found for email:', userEmail);
      return res.status(404).send('User not found');
    }

    // Check if the user has uploaded a resume
    if (!user.extractedText) {
      console.error('No resume uploaded for user:', userEmail);
//      return res.status(400).json({ error: 'No resume uploaded. Please upload a resume first.' });
    }

    // Use extracted text from MongoDB
    const resumeText = user.extractedText;
    console.log('🔠 Extracted Text (first 200 chars):', resumeText.substring(0, 200)); // Log first 200 chars

    // Fetch all jobs from all company accounts using aggregation
    console.time('Fetching Jobs'); // Start timer
    const allJobs = await User.aggregate([
      { $match: { accountType: 'company' } },
      { $unwind: '$jobs' },
      { $replaceRoot: { newRoot: '$jobs' } },
    ]);
    console.timeEnd('Fetching Jobs'); // End timer
    console.log('📊 Total Jobs:', allJobs.length);

    if (allJobs.length === 0) {
      console.error('No jobs found in the database');
      return res.status(404).json({ error: 'No jobs found in the database.' });
    }

    // Extract job descriptions
    const jobDescriptions = allJobs.map((job) => job.jobDescription);
    console.log('📄 Job Descriptions:', jobDescriptions);

    // Compute cosine similarity between the resume and job descriptions
    console.time('Cosine Similarity'); // Start timer
    let result;
    try {
      result = await getCosineSimilarity(resumeText, jobDescriptions);
      console.log('Cosine Similarity Result:', result); // Log cosine similarity result
    } catch (error) {
      console.error('[❌ ERROR] in getCosineSimilarity:', error.stack);
      return res.status(500).send('Failed to compute cosine similarity');
    }
    console.timeEnd('Cosine Similarity'); // End timer

    // Ensure result.cosine_similarities is an array
   

    const cosineSimilarities = Array.isArray(result.cosine_similarities)
      ? result.cosine_similarities
      : [result.cosine_similarities]; // Convert to array if not already

    console.log('🔢 Cosine Similarities:', cosineSimilarities);

    // Rank jobs based on similarity scores
    const rankedJobs = allJobs
      .map((job, index) => {
        const similarity = cosineSimilarities[index] || 0; // Default to 0 if missing
        return {
          "Account Name": job.accountName, // Match frontend key
          "Job Title": job.jobTitle, // Match frontend key
          "Job Description": job.jobDescription, // Match frontend key
          "Cosine Similarity": similarity, // Match frontend key
        };
      })
      .sort((a, b) => b["Cosine Similarity"] - a["Cosine Similarity"]); // Sort by similarity

    console.log('🔮 Ranked Jobs:', rankedJobs); // Log ranked jobs

    // Check if rankedJobs is valid
    if (!rankedJobs || !Array.isArray(rankedJobs)) {
      console.error('Invalid rankedJobs:', rankedJobs);
      return res.status(500).send('Invalid rankedJobs data');
    }

    // Prepare the response object
    const response = { rankedJobs };
    console.log('📤 Response Object:', response); // Log the response object

    // Send the ranked jobs to the frontend
    try {
      res.json(response);
      console.log('✅ Response sent successfully');
    } catch (error) {
      console.error('[❌ ERROR] in res.json:', error.stack);
      res.status(500).send('Failed to send response');
    }
  } catch (error) {
    console.error('[❌ ERROR] in /match-jobs:', error.stack);
    res.status(500).send('Internal Server Error');
  }
});

function parseResumeText(text) {
  // Step 1: Extract objective
  const objective = extractSection(text, ['Objective', 'Summary', 'Career Objective'], ['Education', 'Skills', 'Experience']);

  // Step 2: Extract education
  const education = extractSection(text, ['Education', 'Academic Background', 'Qualifications'], ['Skills', 'Experience']);

  // Step 3: Extract skills
  const skills = extractSkills(text, ['Skills','Skill','Abilities']); 

  // Step 4: Extract experience
  const experience = extractExperience(text);

  return {
    Experience: experience,
    Education: standardizeEducation(education),
    Skills: cleanText(skills),
    Objective: cleanText(objective)
  };
}
// Helper function to extract a section from the resume text
function extractSection(text, sectionNames, stopKeywords = []) {
  for (const sectionName of sectionNames) {
    const regex = new RegExp(`${sectionName}[:\\s]*([\\s\\S]*?)(?:\\n\\n|$)`, 'i');
    const match = text.match(regex);
    if (match) {
      let sectionContent = match[1].trim();

      // Stop extraction if a stop keyword is found
      for (const stopKeyword of stopKeywords) {
        const stopRegex = new RegExp(`\\b${stopKeyword}\\b`, 'i');
        const stopMatch = sectionContent.match(stopRegex);
        if (stopMatch) {
          sectionContent = sectionContent.substring(0, stopMatch.index).trim();
        }
      }

      return sectionContent;
    }
  }
  return null;
}

// Function to extract skills
function extractSkills(text) {
  const skillsSection = extractSection(text, ['Skills', 'Technical Skills', 'Key Skills'], ['Languages', 'Awards', 'Experience']);
  if (!skillsSection) return null;

  // Remove "& abilities" and clean the text
  let skillsText = skillsSection.replace(/& abilities/g, '').trim();

  // Handle both bullet points and comma-separated skills
  let skills = skillsText.split('\n')
    .map(line => line.replace('•', '').trim())  // Remove bullet points
    .filter(line => line.length > 0);           // Remove empty lines

  // If the entire section is a single line and contains commas, split it
  if (skills.length === 1 && skills[0].includes(',')) {
    skills = skills[0].split(',').map(skill => skill.trim());
  }

  return skills.length > 0 ? skills.join(', ') : null;
}



// Function to extract experience
function extractExperience(text) {
  const experienceSection = extractSection(text, ['Experience', 'Work Experience', 'Professional Experience']);
  if (!experienceSection) return 0;

  // Extract the first numeric value (e.g., "3 years" → 3)
  const experience = parseInt(experienceSection.match(/\d+/)?.[0] || 0);
  return experience;
}

// Function to clean text (replace newlines with commas and remove extra spaces)
function cleanText(text) {
  if (!text) return null;

  // Step 1: Replace newlines with commas
  let cleanedText = text.replace(/\n/g, ', ');

  // Step 2: Remove extra commas and spaces
  cleanedText = cleanedText.replace(/,{2,}/g, ', '); // Replace multiple commas with one
  cleanedText = cleanedText.replace(/\s{2,}/g, ' '); // Replace multiple spaces with one

  // Step 3: Trim leading/trailing spaces and commas
  cleanedText = cleanedText.trim().replace(/^,|,$/g, '');

  return cleanedText;
}

// Function to standardize education
function standardizeEducation(educationText) {
  if (!educationText) return null;

  // Mapping of degree names and fields to their standardized forms
  const degreeMapping = {
    'bachelor in technology': 'B.Tech',
    'b.tech': 'B.Tech',
    'bachelor of technology': 'B.Tech',
    'master in technology': 'M.Tech',
    'm.tech': 'M.Tech',
    'master of technology': 'M.Tech',
    'phd': 'PhD',
    'doctor of philosophy': 'PhD'
  };

  const fieldMapping = {
    'computer science': 'Computer Science',
    'cs': 'Computer Science',
    'computer science engineering': 'Computer Science',
    'civil engineering': 'Civil Engineering',
    'mechanical engineering': 'Mechanical Engineering',
    'electrical engineering': 'Electrical Engineering'
  };

  // Split education text into individual entries
  const educationEntries = educationText.split('\n').filter(entry => entry.trim() !== '');

  // Find the degree and field of study
  let degree = null;
  let field = null;

  for (const entry of educationEntries) {
    const lowerCaseEntry = entry.toLowerCase();

    // Check for degree
    for (const [key, value] of Object.entries(degreeMapping)) {
      if (lowerCaseEntry.includes(key)) {
        degree = value;
        break;
      }
    }

    // Check for field of study
    for (const [key, value] of Object.entries(fieldMapping)) {
      if (lowerCaseEntry.includes(key)) {
        field = value;
        break;
      }
    }

    // Stop if both degree and field are found
    if (degree && field) break;
  }

  // Format the output as "B.Tech in Computer Science"
  if (degree && field) {
    return `${degree} in ${field}`;

  }

  return null;
}




const { T5Summarizer, PegasusRewriter } = require('./nlp_models'); // Hypothetical NLP model imports


app.use(bodyParser.json());

// Mock database for jobs and applicants
let jobs = [];
let applicants = [];

// POST endpoint to handle job application




//const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini API
//const genAI = new GoogleGenerativeAI("AIzaSyATl1jwNq-_lfWmeu7a7df4uhxvgReRUqA", { apiVersion: "v1" }); // Replace with your Gemini API key
//const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });

app.post('/apply', requireLogin, upload.single('resume'), async (req, res) => {
  console.log('🔔 /apply endpoint called');
  try {
    const { jobTitle, companyName } = req.body;
    const applicantId = req.session.user._id; // Get applicant ID from session
    const resumePath = req.file?.path; // Path to the uploaded resume (optional if extractedText exists)

    console.log('📄 Applicant ID:', applicantId);
    console.log('📂 Resume Path:', resumePath);
    console.log('📝 Job Title:', jobTitle);
    console.log('🏢 Company Name:', companyName);

    // Fetch the user document
    const user = await User.findById(applicantId);
    if (!user) {
      console.error('❌ User not found');
      return res.status(404).json({ error: 'User not found' });
    }

    // Step 1: Use extractedText if available, otherwise extract text from the resume
    let resumeText;
    if (user.extractedText) {
      console.log('🔍 Using pre-extracted text from user document.');
      resumeText = user.extractedText;
    } else if (resumePath) {
      console.log('🔍 Step 1: Extracting text from resume...');
      resumeText = await extractTextFromResume({ path: resumePath });
      console.log('✅ Extracted Resume Text (first 200 chars):', resumeText.substring(0, 200));
    } else {
      console.error('❌ No resume file or extracted text available.');
      return res.status(400).json({ error: 'No resume file or extracted text available.' });
    }

    // Step 2: Summarize the resume using Gemini API via Python script
    console.log('📝 Step 2: Summarizing resume......');
    let resumeSummary;
    try {
      resumeSummary = await summarizeResumeWithPython(resumeText);
      console.log('✅ Resume Summary:', resumeSummary);
    } catch (error) {
      console.error('❌ Error summarizing resume', error);
      console.log('⚠ Falling back to T5 summarization.');
      // Fallback to T5 summarization if Gemini fails
      resumeSummary = await T5Summarizer.summarize(resumeText);
      console.log('✅ Resume Summary (T5):', resumeSummary);
    }

    // Step 3: Get the top 2 recommended jobs (from your CS algorithm)
    console.log('🔮 Step 3: Fetching top recommended jobs...');
    const recommendedJobs = await getTopRecommendedJobs(applicantId); // Replace with your CS algorithm
    console.log('✅ Recommended Jobs:', recommendedJobs);

    const top2Jobs = recommendedJobs.slice(0, 2);
    console.log('🏆 Top 2 Jobs:', top2Jobs);

    // Step 4: Rewrite the summary for the top 2 jobs using Pegasus
    console.log('✍ Step 4: Rewriting summaries for top 2 jobs using Pegasus...');
    const rewrittenSummaries = await Promise.all(
      top2Jobs.map(async (job) => {
        try {
          console.log(`📝 Rewriting summary for Job ID: ${job._id}`);
          const rewrittenSummary = await PegasusRewriter.rewrite(resumeSummary, job.jobDescription);
          console.log(`✅ Rewritten Summary for Job ID: ${job._id}:`, rewrittenSummary);
          return { jobId: job._id, summary: rewrittenSummary };
        } catch (error) {
          console.error(`❌ Error rewriting summary for Job ID: ${job._id}`, error);
          console.log('⚠ Using original summary for this job.');
          return { jobId: job._id, summary: resumeSummary }; // Fallback to original summary
        }
      })
    );

    // Step 5: Submit the rewritten summaries to the top 2 jobs
    console.log('📤 Step 5: Submitting rewritten summaries to top 2 jobs...');
    const applicationResults = await Promise.all(
      rewrittenSummaries.map(async ({ jobId, summary }) => {
        console.log(`📝 Submitting application for Job ID: ${jobId}`);
        const result = await submitApplication(jobId, applicantId, summary);
        console.log(`✅ Application submitted for Job ID: ${jobId}, result:`, result);
        return result;
      })
    );

    // Step 6: Submit the original summary for the rest of the jobs
    console.log('📤 Step 6: Submitting original summary for remaining jobs...');
    const remainingJobs = recommendedJobs.slice(2);
    const remainingApplications = await Promise.all(
      remainingJobs.map(async (job) => {
        console.log(`📝 Submitting application for Job ID: ${job._id}`);
        const result = await submitApplication(job._id, applicantId, resumeSummary);
        console.log(`✅ Application submitted for Job ID: ${job._id}, result:`, result);
        return result;
      })
    );

    // Combine results
    const allApplications = [...applicationResults, ...remainingApplications];
    console.log('📊 All Applications:', allApplications);

    res.status(200).json({
      message: 'Application submitted successfully',
      applications: allApplications,
    });
    console.log('🎉 Application process completed successfully.');
  } catch (error) {
    console.error('❌ Error in /apply endpoint:', error);
    res.status(500).json({ error: 'Failed to process application' });
  }
});


async function summarizeResumeWithPython(resumeText) {
  return new Promise((resolve, reject) => {
    // Path to the Python script
    const pythonScriptPath = path.join(__dirname, "gemini_summarizer.py");

    // Execute the Python script
    const pythonProcess = exec(`python "${pythonScriptPath}" "${resumeText}"`, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Error executing Python script:", stderr);
        reject(new Error("Failed to summarize resume."));
      } else {
        resolve(stdout.trim()); // Return the summary from the Python script
      }
    });

    // Log Python script output for debugging
    pythonProcess.stdout.on("data", (data) => {
      console.log("Python script output:", data);
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error("Python script error:", data);
    });
  });
}



async function extractTextFromResume(resume) {
  // Check if extractedText is already available in the resume object
  if (resume.extractedText) {
    console.log('Using pre-extracted text from resume.');
    return resume.extractedText;
  }

  // If not, proceed with extraction
  if (!resume.path) {
    throw new Error('Resume file path is missing.');
  }

  try {
    console.log('Extracting text from resume...');
    const dataBuffer = fs.readFileSync(resume.path); // Read the file from the provided path
    const data = await pdf(dataBuffer); // Extract text using pdf-parse
    console.log('Text extraction completed successfully.');
    return data.text; // Return the extracted text
  } catch (error) {
    console.error('Error extracting text from resume:', error);
    throw new Error('Failed to extract text from resume');
  }
}

// Helper function to get top recommended jobs (replace with your CS algorithm)
async function getTopRecommendedJobs(applicantId) {
  const user = await User.findById(applicantId);
  if (!user || !user.predictedJobs) {
    throw new Error('No predicted jobs found for the applicant');
  }

  // Fetch all jobs from the database
  const jobs = await User.aggregate([
    { $match: { accountType: 'company' } },
    { $unwind: '$jobs' },
    { $replaceRoot: { newRoot: '$jobs' } },
  ]);

  // Sort jobs based on predicted probabilities (example logic)
  const recommendedJobs = jobs.sort((a, b) => {
    const aProbability = user.predictedJobs.find((pj) => pj.category === a.jobTitle)?.probability || 0;
    const bProbability = user.predictedJobs.find((pj) => pj.category === b.jobTitle)?.probability || 0;
    return bProbability - aProbability;
  });

  return recommendedJobs;
}

// Helper function to submit an application to a job
const { ObjectId } = require('mongodb'); // Import ObjectId

async function submitApplication(jobId, applicantId, summary) {
  try {
    console.log(`🔍 Submitting application for Job ID: ${jobId}`);

    // Convert jobId and applicantId to ObjectId using the 'new' keyword
    const jobObjectId = new ObjectId(jobId); // Use 'new' keyword
    const applicantObjectId = new ObjectId(applicantId); // Use 'new' keyword

    // Update the job's applicants array atomically
    const result = await User.findOneAndUpdate(
      { 'jobs._id': jobObjectId }, // Find the job by its ID
      {
        $push: {
          'jobs.$.applicants': { applicantId: applicantObjectId, summary }, // Add applicant to the applicants array
        },
      },
      { new: true } // Return the updated document
    );

    if (!result) {
      console.error('❌ Job not found in user document');
      throw new Error('Job not found');
    }

    console.log('✅ Application submitted successfully');
    return { jobId, status: 'success' };
  } catch (error) {
    console.error('❌ Error submitting application:', error);
    throw error;
  }
}


app.get('/get-applicants/:jobId', requireLogin, async (req, res) => {
  try {
    const jobId = req.params.jobId; // Get the job ID from the URL
    const userEmail = req.session.user.email; // Get the logged-in user's email

    // Find the company user document
    const companyUser = await User.findOne({ email: userEmail });
    if (!companyUser) {
      console.error('❌ Company user not found');
      return res.status(404).json({ error: 'Company user not found' });
    }

    // Find the specific job in the company's jobs array
    const job = companyUser.jobs.id(jobId);
    if (!job) {
      console.error('❌ Job not found');
      return res.status(404).json({ error: 'Job not found' });
    }

    // Fetch the applicants' details (name, email, and summary)
    const applicants = await Promise.all(
      job.applicants.map(async (applicant) => {
        const applicantUser = await User.findById(applicant.applicantId);
        return {
          name: applicantUser.name,
          email: applicantUser.email,
          summary: applicant.summary,
        };
      })
    );

    console.log('✅ Applicants:', applicants);
    res.status(200).json({ applicants });
  } catch (error) {
    console.error('❌ Error fetching applicants:', error);
    res.status(500).json({ error: 'Failed to fetch applicants' });
  }
});


app.get('/applicants/:jobId', requireLogin, async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const userEmail = req.session.user.email;

    // Fetch the company user and job details
    const companyUser = await User.findOne({ email: userEmail });
    if (!companyUser) {
      return res.status(404).send('Company user not found');
    }

    const job = companyUser.jobs.id(jobId);
    if (!job) {
      return res.status(404).send('Job not found');
    }

    // Fetch the applicants' details
    const applicants = await Promise.all(
      job.applicants.map(async (applicant) => {
        const applicantUser = await User.findById(applicant.applicantId);
        return {
          name: applicantUser.name,
          email: applicantUser.email,
          summary: applicant.summary,
        };
      })
    );

    // Render the applicants page
    res.render('applicants', { job, applicants });
  } catch (error) {
    console.error('Error fetching applicants:', error);
    res.status(500).send('Failed to fetch applicants');
  }
});


app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).send('Internal Server Error');
    }
    res.redirect('/');
  });
});


// Start the server
app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});