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
      return res.status(400).json({ error: 'No resume uploaded. Please upload a resume first.' });
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