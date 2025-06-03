// nlp_models.js
const { spawn } = require('child_process');

class T5Summarizer {
  static async summarize(text) {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', ['t5_summarize.py', text]);

      let output = '';
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        console.error(`[❌ ERROR] in T5Summarizer: ${data.toString()}`);
        reject(data.toString());
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(`T5Summarizer process exited with code ${code}`);
        } else {
          resolve(output.trim());
        }
      });
    });
  }
}

class PegasusRewriter {
  static async rewrite(summary, jobDescription) {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', ['pegasus_rewrite.py', summary, jobDescription]);

      let output = '';
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        console.error(`[❌ ERROR] in PegasusRewriter: ${data.toString()}`);
        reject(data.toString());
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(`PegasusRewriter process exited with code ${code}`);
        } else {
          resolve(output.trim());
        }
      });
    });
  }
}

module.exports = { T5Summarizer, PegasusRewriter };