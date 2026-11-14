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
			"Traders on Reddit's WallStreetBets piled into heavily shorted GameStop and forced a historic short squeeze: the stock rose about eighteenfold in January 2021. After Robinhood and other brokers restricted buying on January 28, the price collapsed almost as fast.",
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
			'As COVID-19 spread beyond China, the S&P 500 lost about a third of its value in just over a month, its fastest bear market on record. Emergency rate cuts and a $2 trillion relief bill set off a sharp rebound from March 23.',
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
			'On January 9, 2007, Steve Jobs introduced the iPhone at Macworld in San Francisco. Apple shares jumped 8% that day and kept climbing the next, before cooling off.',
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
			'On October 19, 1987, the Dow fell 22.6%, still its worst day ever, and blue chip IBM lost almost a quarter of its value. Stocks bounced back hard over the next two days.',
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
			'In May 2023 Nvidia forecast quarterly sales of about $11 billion, roughly 50% above what analysts expected, thanks to demand for AI chips. The stock jumped 24% the next day and Nvidia soon became a trillion-dollar company.',
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
			'The week Lehman Brothers went bankrupt, insurer AIG was crushed by losses on the credit default swaps it had sold, and the Fed lent it $85 billion in exchange for most of the company. The stock lost most of its value in three days, then rebounded as Washington moved to stop the panic.',
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
			'In July 2020 the US government announced a $765 million loan for Kodak to make drug ingredients, and the old film company rose about fifteenfold in three days. It gave much of that back within days as questions mounted about the deal, and the loan was later put on hold.',
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
			'Internet mania carried the Nasdaq to its peak in March 2000. Then the bubble burst: by late 2002 the Nasdaq-100 had lost more than 80% of its value.',
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
			'Heavy metaverse spending and an advertising slump took Meta down about 75% from its peak by November 2022. Mark Zuckerberg then cut costs and thousands of jobs in his "year of efficiency," and the stock more than doubled in five months.',
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
			'On June 23, 2016, the UK unexpectedly voted to leave the European Union. US stocks fell more than 5% over the next two sessions, then won almost all of it back within a week.',
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
			'In August 2022 meme-stock traders drove Bed Bath & Beyond (then BBBY) up more than fourfold in three weeks. Then investor Ryan Cohen disclosed he had sold his whole stake, the stock crashed 40% in a day, and the company went bankrupt the next year.',
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
			'Record deliveries, a surprise profit and a new Shanghai factory roughly doubled Tesla shares in the first seven weeks of 2020. Then the COVID crash wiped out all of the gains within a month.',
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
			'With the world in lockdown and storage full, the May contract for US crude oil settled at minus $37 a barrel on April 20, 2020, the first negative price ever. USO, the biggest oil fund, plunged as it scrambled to change the futures it held.',
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
			"Bank of America sank to about $3 on March 6, 2009, amid fears big banks would be nationalized. A memo from Citigroup's CEO saying his bank was profitable again set off a rally that nearly doubled BAC in four days and marked the bottom of the financial crisis.",
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
			'In July 2011 Netflix raised prices on its DVD-plus-streaming plan by up to 60%, then announced it would split DVDs off into a separate service called Qwikster. Subscribers left, Qwikster was scrapped within weeks, and the stock lost nearly two thirds of its value in under three months.',
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
			'On November 9, 2020, Pfizer and BioNTech announced their COVID vaccine was over 90% effective. Investors dumped stay-at-home winners, and Zoom fell 17% that day.',
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
			'Qualcomm was the best performer in the S&P 500 in 1999, rising about 26-fold as investors bet on its wireless patents. In January 2000 the stock fell by a third.',
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
			'A bank run brought down Silicon Valley Bank on March 10, 2023, and Signature Bank was closed two days later. Regional bank stocks crashed as depositors wondered which bank was next, until regulators and big banks stepped in.',
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
			'On May 23, 2022, Snap warned that the economy was worsening faster than expected and it would miss its own forecasts. The stock lost 43% the next day and dragged other ad-driven tech stocks down with it.',
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
			'XIV was a popular exchange-traded note that bet on calm markets. When the VIX volatility index more than doubled on February 5, 2018, XIV lost over 90% of its value overnight, and Credit Suisse announced the next day that it would shut the note down.',
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
			'Meme-stock traders nearly doubled AMC on June 2, 2021, as the cinema chain courted its retail shareholders with perks like free popcorn. AMC sold millions of new shares into the frenzy and the stock kept swinging wildly.',
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
			'Silver raced toward $50 an ounce in April 2011, its highest since 1980. Exchanges raised margin requirements again and again, and in the first week of May the price crashed by about a quarter.',
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
			'On July 19, 2024, a faulty CrowdStrike security update crashed about 8.5 million Windows computers, grounding flights and taking hospitals and banks offline. The stock lost about a third of its value in two weeks before starting to recover.',
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
			"A week after Lehman's collapse, Warren Buffett's Berkshire Hathaway invested $5 billion in Goldman Sachs, a vote of confidence that lifted the stock. Then on September 29, 2008, the House rejected the $700 billion bank bailout and markets plunged.",
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
			'On April 2, 2025, President Trump announced sweeping tariffs on nearly every US trading partner, and the S&P 500 fell about 10% in two days. When he paused most of them on April 9, the index jumped 9.5%, its best day since 2008.',
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
			'On May 18, 2020, Moderna reported that its experimental COVID vaccine produced antibodies in its first volunteers, and the stock jumped 20%. It swung back and forth all week as the company sold new shares and experts asked for more data.',
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
			'Super Micro, which builds the servers that hold AI chips, more than tripled in two months in early 2024 and joined the S&P 500 in March. Then the momentum ran out.',
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
			'After the dot-com crash, Amazon was down more than 90% from its 1999 peak when it bottomed in the fall of 2001. It rallied hard into year-end, and in January 2002 it reported its first-ever profit.',
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
			'In April 2022 Elon Musk revealed a 9% stake in Twitter, then offered to buy the whole company, and the board agreed to a $44 billion deal. In May he said the deal was on hold, and the stock slid as he tried to back out.',
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
			'After its worst week since the Great Depression, the S&P 500 jumped 11.6% on October 13, 2008, as governments moved to rescue their banks. Two days later it fell 9% again on fears of a deep recession.',
		lastContextDate: '2008-10-09',
		contextBars: 60,
		stepBars: 1,
		calls: 5
	}
];
