// The hand-picked daily puzzles, in play order: index 0 is puzzle #1 (first played 2026-11-14),
// index 1 is the next day, and so on. Validate changes against real data with
// `node scripts/check-puzzles.ts` (needs the Tiingo cache from scripts/fetch-prices.ts).
//
// The player sees `contextBars` daily bars ending at `lastContextDate`, then makes `calls`
// up/down calls. Each call reveals the next `stepBars` trading days and is scored on the close
// at the end of that stretch versus the close of the last bar visible before it.
//
// `ticker` is the Tiingo symbol we store prices under. Delisted companies keep their
// post-delisting Tiingo symbol (BBBYQ for Bed Bath & Beyond, which traded as BBBY in 2022).

export type Puzzle = {
	/** Stable id, used in URLs and as the database key. Never change it once a puzzle has shipped. */
	slug: string;
	/** Tiingo symbol the prices are stored under. */
	ticker: string;
	/** Display name shown at the reveal. */
	company: string;
	/** Short title of the market moment, shown at the reveal. */
	headline: string;
	/** One or two plain sentences about what happened, shown at the reveal. */
	story: string;
	/** ISO date (YYYY-MM-DD) of the last bar visible before call 1. */
	lastContextDate: string;
	/** Number of bars visible before call 1, ending at lastContextDate. */
	contextBars: number;
	/** Trading days revealed by each call. */
	stepBars: number;
	/** Number of up/down calls. */
	calls: 5;
};

export const puzzles: Puzzle[] = [
	{
		slug: 'gamestop-short-squeeze-2021',
		ticker: 'GME',
		company: 'GameStop',
		headline: 'The GameStop short squeeze',
		story:
			'Reddit traders drove GameStop up eightfold in four days to sink the funds betting against it. A week later it was nearly all gone.',
		lastContextDate: '2021-01-21',
		contextBars: 60,
		stepBars: 2,
		calls: 5
	},
	{
		slug: 'covid-crash-2020',
		ticker: 'SPY',
		company: 'S&P 500 (SPDR S&P 500 ETF)',
		headline: 'The COVID crash',
		story:
			'As COVID-19 spread, the S&P 500 lost a third of its value in a month, its fastest fall on record. Then emergency aid set off a rebound.',
		lastContextDate: '2020-02-20',
		contextBars: 60,
		stepBars: 5,
		calls: 5
	},
	{
		slug: 'iphone-unveiled-2007',
		ticker: 'AAPL',
		company: 'Apple',
		headline: 'Steve Jobs unveils the iPhone',
		story:
			'Steve Jobs unveiled the iPhone on January 9, 2007, and Apple stock jumped 8% that day. In hindsight, that was underreacting.',
		lastContextDate: '2007-01-08',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'black-monday-1987',
		ticker: 'IBM',
		company: 'IBM',
		headline: 'Black Monday',
		story:
			'On October 19, 1987, the Dow lost 22.6%, its worst day ever. IBM fell almost a quarter, then won over half of it back in two days.',
		lastContextDate: '1987-10-15',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'nvidia-ai-guidance-2023',
		ticker: 'NVDA',
		company: 'Nvidia',
		headline: "Nvidia's AI blowout forecast",
		story:
			'Nvidia said AI chips would lift sales 50% past forecasts. The stock jumped 24%, and days later Nvidia was briefly worth $1 trillion.',
		lastContextDate: '2023-05-24',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'aig-bailout-2008',
		ticker: 'AIG',
		company: 'American International Group',
		headline: 'The AIG bailout',
		story:
			'The week Lehman failed, insurer AIG lost 83% in three days, and the Fed lent it $85 billion in return for most of the company.',
		lastContextDate: '2008-09-12',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'kodak-loan-spike-2020',
		ticker: 'KODK',
		company: 'Eastman Kodak',
		headline: "Kodak's pharma pivot",
		story:
			'The government offered Kodak, the old film company, a $765 million loan to make drug ingredients. The stock rose fifteenfold in three days.',
		lastContextDate: '2020-07-24',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'dot-com-peak-2000',
		ticker: 'QQQ',
		company: 'Nasdaq-100 (Invesco QQQ)',
		headline: 'The dot-com peak',
		story:
			'Internet mania pushed tech stocks to a peak in March 2000. By late May the Nasdaq-100 was down over a third, and the slide had years to go.',
		lastContextDate: '1999-12-29',
		contextBars: 60,
		stepBars: 21,
		calls: 5
	},
	{
		slug: 'meta-year-of-efficiency-2023',
		ticker: 'META',
		company: 'Meta Platforms (Facebook)',
		headline: "Meta's comeback",
		story:
			'Meta cut 11,000 jobs and declared a "year of efficiency." Investors forgave the metaverse, and the stock more than doubled in five months.',
		lastContextDate: '2022-11-03',
		contextBars: 60,
		stepBars: 21,
		calls: 5
	},
	{
		slug: 'brexit-vote-2016',
		ticker: 'SPY',
		company: 'S&P 500 (SPDR S&P 500 ETF)',
		headline: 'The Brexit vote',
		story:
			'The UK voted to leave the EU, and US stocks lost over 5% in two days. Within a week they had made nearly all of it back.',
		lastContextDate: '2016-06-23',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'bed-bath-beyond-meme-2022',
		ticker: 'BBBYQ',
		company: 'Bed Bath & Beyond',
		headline: 'Bed Bath & Beyond goes meme',
		story:
			'Meme traders lifted Bed Bath & Beyond 78% in three days. Then their hero Ryan Cohen revealed he had sold out, and it fell 40% in a day.',
		lastContextDate: '2022-08-12',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'tesla-early-2020-run',
		ticker: 'TSLA',
		company: 'Tesla',
		headline: "Tesla's 2020 takeoff",
		story:
			'Record sales and a new China factory more than doubled Tesla in seven weeks. Then the COVID sell-off took most of it back in under a month.',
		lastContextDate: '2019-12-31',
		contextBars: 60,
		stepBars: 10,
		calls: 5
	},
	{
		slug: 'negative-oil-2020',
		ticker: 'USO',
		company: 'United States Oil Fund',
		headline: 'Oil goes negative',
		story:
			'With nowhere left to store it, US oil briefly cost minus $37 a barrel on April 20, 2020. The biggest oil fund lost 40% in three days.',
		lastContextDate: '2020-04-17',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'bank-bottom-2009',
		ticker: 'BAC',
		company: 'Bank of America',
		headline: 'The banks bottom out',
		story:
			'Bank of America fell to $3 on fears of a government takeover. Then Citigroup said it was profitable, and BofA nearly doubled in four days.',
		lastContextDate: '2009-03-06',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'netflix-qwikster-2011',
		ticker: 'NFLX',
		company: 'Netflix',
		headline: 'Netflix and Qwikster',
		story:
			'Netflix raised prices up to 60%, then spun DVDs off into a service called Qwikster. Customers left, and so did over half the stock price.',
		lastContextDate: '2011-06-15',
		contextBars: 60,
		stepBars: 15,
		calls: 5
	},
	{
		slug: 'vaccine-monday-zoom-2020',
		ticker: 'ZM',
		company: 'Zoom Video Communications',
		headline: 'Vaccine Monday',
		story:
			'Pfizer said its COVID vaccine was over 90% effective, and investors dumped stay-at-home stocks. Zoom lost nearly a quarter in two days.',
		lastContextDate: '2020-11-05',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'qualcomm-1999',
		ticker: 'QCOM',
		company: 'Qualcomm',
		headline: "Qualcomm's 1999 rocket",
		story:
			'Qualcomm rose 26-fold in 1999, tops in the S&P 500, on bets its patents would power every mobile phone. Then January took a third.',
		lastContextDate: '1999-08-30',
		contextBars: 60,
		stepBars: 21,
		calls: 5
	},
	{
		slug: 'svb-collapse-2023',
		ticker: 'KRE',
		company: 'SPDR S&P Regional Banking ETF',
		headline: 'The SVB collapse',
		story:
			'Silicon Valley Bank failed on March 10, 2023, and Signature Bank two days later. Regional bank stocks fell 16% in two days.',
		lastContextDate: '2023-03-09',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'snap-profit-warning-2022',
		ticker: 'SNAP',
		company: 'Snap',
		headline: "Snap's profit warning",
		story:
			'Snap warned that a worsening economy meant it would miss the forecast it gave just a month earlier. The stock lost 43% the next day.',
		lastContextDate: '2022-05-23',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'volmageddon-2018',
		ticker: 'XIV',
		company: 'VelocityShares Daily Inverse VIX ETN',
		headline: 'Volmageddon',
		story:
			"XIV was a popular bet that markets would stay calm. On February 5, 2018, they didn't, and it lost over 90% overnight. Soon it was shut down.",
		lastContextDate: '2018-02-02',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'amc-meme-rally-2021',
		ticker: 'AMC',
		company: 'AMC Entertainment',
		headline: 'AMC to the moon',
		story:
			'AMC nearly doubled on June 2, 2021, as the cinema chain wooed meme-stock fans with free popcorn. It also sold them millions of new shares.',
		lastContextDate: '2021-05-28',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'silver-spike-2011',
		ticker: 'SLV',
		company: 'iShares Silver Trust',
		headline: 'Silver nears $50',
		story:
			'Silver neared $50, a 31-year high. Then the exchange made it costlier to bet with borrowed money, and it fell over a quarter in a week.',
		lastContextDate: '2011-04-14',
		contextBars: 60,
		stepBars: 4,
		calls: 5
	},
	{
		slug: 'crowdstrike-outage-2024',
		ticker: 'CRWD',
		company: 'CrowdStrike',
		headline: 'The CrowdStrike outage',
		story:
			'A faulty CrowdStrike update crashed 8.5 million Windows PCs on July 19, 2024, grounding flights. The stock lost over a third in two weeks.',
		lastContextDate: '2024-07-18',
		contextBars: 60,
		stepBars: 5,
		calls: 5
	},
	{
		slug: 'buffett-backs-goldman-2008',
		ticker: 'GS',
		company: 'Goldman Sachs',
		headline: 'Buffett backs Goldman',
		story:
			'Warren Buffett put $5 billion into Goldman Sachs, and the stock rose 14% in four days. Then the House rejected the bailout: gone in a day.',
		lastContextDate: '2008-09-22',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'liberation-day-tariffs-2025',
		ticker: 'SPY',
		company: 'S&P 500 (SPDR S&P 500 ETF)',
		headline: 'Liberation Day tariffs',
		story:
			'Trump put tariffs on almost every country, and the S&P 500 fell 10% in two days. A week later he paused most of them: best day since 2008.',
		lastContextDate: '2025-04-01',
		contextBars: 60,
		stepBars: 2,
		calls: 5
	},
	{
		slug: 'moderna-vaccine-data-2020',
		ticker: 'MRNA',
		company: 'Moderna',
		headline: "Moderna's first vaccine data",
		story:
			'Moderna said its COVID vaccine made antibodies in its first eight volunteers, and the stock jumped 20%. By Friday the gain was nearly gone.',
		lastContextDate: '2020-05-15',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	},
	{
		slug: 'super-micro-ai-boom-2024',
		ticker: 'SMCI',
		company: 'Super Micro Computer',
		headline: 'Super Micro rides the AI boom',
		story:
			'Super Micro builds servers for AI chips, which in early 2024 was enough to nearly quadruple its stock in two months.',
		lastContextDate: '2024-01-17',
		contextBars: 60,
		stepBars: 10,
		calls: 5
	},
	{
		slug: 'amazon-dot-com-bottom-2001',
		ticker: 'AMZN',
		company: 'Amazon',
		headline: 'Amazon after the bust',
		story:
			'Amazon bottomed in September 2001, down over 90% from its peak, then doubled by January. Weeks later came its first-ever profit.',
		lastContextDate: '2001-08-01',
		contextBars: 60,
		stepBars: 21,
		calls: 5
	},
	{
		slug: 'musk-buys-twitter-2022',
		ticker: 'TWTR',
		company: 'Twitter',
		headline: 'Elon Musk bids for Twitter',
		story:
			'Elon Musk agreed to buy Twitter for $44 billion. Weeks later he put the deal "on hold," and the stock slid as he tried to back out.',
		lastContextDate: '2022-04-01',
		contextBars: 60,
		stepBars: 10,
		calls: 5
	},
	{
		slug: 'october-2008-whipsaw',
		ticker: 'SPY',
		company: 'S&P 500 (SPDR S&P 500 ETF)',
		headline: 'The October 2008 whipsaw',
		story:
			'The S&P 500 had its best day since 1933 as governments rushed to save their banks. Two days later it gave almost all of it back.',
		lastContextDate: '2008-10-09',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	}
];
