import { spawn } from 'child_process';
import path from 'path';

/**
 * AION VISION HUB: R-Analytics Neural Forecasting Service
 * Allows Fastify backend to perform complex ARIMA Time Series 
 * predictions outside of the V8 JavaScript thread by delegating
 * heavy compute to Rscript.
 */
export async function runPredictiveModel(historicalCrimeData: number[]): Promise<any> {
  return new Promise((resolve, reject) => {
    // Locate the R prediction script in the backend scripts folder
    const scriptPath = path.join(__dirname, '../scripts/predictive.R');
    
    // Spawn the R child process, passing stringified telemetry vectors
    const rmProcess = spawn('Rscript', [scriptPath, JSON.stringify(historicalCrimeData)]);
    
    let resultJSON = '';

    rmProcess.stdout.on('data', (data) => {
      resultJSON += data.toString();
    });

    rmProcess.stderr.on('data', (data) => {
      console.error(`[R-Analytics] STDERR: ${data}`);
    });

    rmProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`[R-Analytics] Process exited with failure code ${code}`));
      }
      try {
        const parsedData = JSON.parse(resultJSON);
        resolve(parsedData);
      } catch (parseError) {
        reject(new Error('[R-Analytics] Failed to parse script JSON stdout: ' + parseError));
      }
    });
  });
}
