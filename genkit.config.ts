console.log('LOG: Loading genkit.config.ts');
import 'dotenv/config';
import { configureGenkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// This line is the key: it imports our flow file, allowing Genkit to discover it.
import './src/flows/quoteFlow';

export default configureGenkit({
  plugins: [
    googleAI(),
  ],
  logLevel: 'debug',
  flowStateStore: 'file',
});
