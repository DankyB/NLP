import dotenv from 'dotenv';
import Yargs from 'yargs';
import { HOSTED_URLS, TWITTER, REDDIT, BING, GNEWS } from './helpers/constants.js';
import { readFile } from 'fs/promises';
import { ScrapingApi, DbApi } from './services/index.js';
import SentimentPredictor from './services/sentiment/sentiment.js';
import { DateTime } from 'luxon';
import { getCryptoPrice } from './services/market/cryptoCompare.js';

dotenv.config();

const { twitterManager, redditManager, bingManager, gnewsManager } = new ScrapingApi();
const { mongodbManager: dbManager } = new DbApi();

// arguments
const args = Yargs(process.argv.slice(2))
  .alias('c', 'coin-index')
  .demandOption('c')
  .default('c', 0)
  .describe('c', 'coin # 0-19')
  .number('coin-index')
  .argv;

/**
 * Loads the pretrained model and metadata, and registers the predict
 * function with the UI.
 */
const setupSentiment = async () => {
  console.log('Model available: ' + HOSTED_URLS.model);
  return new SentimentPredictor().init(HOSTED_URLS);
};

const fetchServiceData = async (crypto, serviceManager) => {
  const { batch } = await serviceManager.fetchServiceData({ crypto });

  const analyzedBatch = await performSentimentAnalysis(batch);
  // console.log(JSON.stringify(analyzedBatch, null, 2));
  try {
    const { insertedCount } = await dbManager.insertNewBatch(analyzedBatch);
    console.log(`inserted ${insertedCount} documents`);
  } catch (error) {
    console.error('failed inserting batch', error);
  }
};

const getPrediction = score => {
  if (score < 0.25) return 'NEGATIVE';
  if (score < 0.75) return 'NEUTRAL';
  return 'POSITIVE';
};

const performSentimentAnalysis = async ({ results, ...batch }) => {
  try {
    const predictor = await setupSentiment();
    const analyzedResults = await results.map(
      result => ({
        ...batch,
        rawSource: result.text,
        analysis: predictor.predict(result.text),
      }));

    const averageScore = analyzedResults.reduce((acc, r) => acc + r.analysis.score, 0)/results.length;
    const prediction = getPrediction(averageScore);
    const batchTimePrice = await getCryptoPrice(batch.coin);
    const analyzedBatch = {
      summary: {
        source: batch.source,
        coin: batch.coin,
        averageScore,
        prediction,
        batchTimePrice,
        timestamp: DateTime.now().toISO()
      },
      ...batch,
      state: 'VIRGIN',
      results
    };
    return analyzedBatch;
  } catch (error) {
    console.error('failed predicting', error);
  }
};

const getServiceManager = {
  [TWITTER]: twitterManager,
  [REDDIT]: redditManager,
  [BING]: bingManager,
  [GNEWS]: gnewsManager
};

(async () => {
  try {
    const keywords = JSON.parse(await readFile(new URL('./keywords.json', import.meta.url)));

    const serviceManager = getServiceManager[args.service];
    if (!serviceManager) throw new Error('no service specified');

    fetchServiceData(keywords[args['coin-index']], serviceManager);
  } catch (err) {
    console.error(err);
  }
})();

