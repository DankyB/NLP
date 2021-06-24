import dotenv from 'dotenv';
import Twitter from 'twitter-v2';
import { TWITTER } from '../../helpers/constants.js';

dotenv.config();

async function getTweets({ crypto, limit = 100 }) {
  console.log(`fetching (max ${limit}) tweets talking about "${crypto.name}"...`);
  const query = `${crypto.acronym}`;
  console.log(query)
  const { data: tweets = [], meta, errors } = await this.client.get(
    'tweets/search/recent',
    {
      query,
      max_results: limit,
      tweet: {
        lang: 'en',
        fields: [
          'created_at',
          'entities',
          'in_reply_to_user_id',
          'public_metrics',
          'referenced_tweets',
          'source',
          'author_id',
        ],
      },
    }
  );

  console.log(`fetched ${tweets.length} tweets`);

  if (errors) {
    console.error('Errors:', errors);
    return;
  }

  // console.log("\ntweets:");

  // tweets.forEach((tweet, index) => {
  //   console.log(`${index + 1}) ${tweet.text}`);
  // });
  // console.log("\nmeta:");
  // console.log(meta);

  return {
    batch: {
      source: TWITTER,
      results: tweets,
      meta: { ...meta, query }
    }
  };
};

function TwitterManager() {
  this.client = new Twitter({
    bearer_token: process.env.TWITTER_BEARER_TOKEN
  });
};

TwitterManager.prototype.fetchServiceData = getTweets;

export default TwitterManager;