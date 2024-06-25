const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 80;

const pg = require('pg');
const { JSDOM } = require('jsdom');

const fs = require('fs');
const axios = require('axios');
const {
	GoogleGenerativeAI,
	HarmCategory,
	HarmBlockThreshold,
} = require("@google/generative-ai");

const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');
const { createGzip } = require('zlib')

let sitemap;

/* Express */
app.use('/assets', express.static(__dirname + '/src/assets'));
app.use('/css', express.static(__dirname + '/src/css'));
app.use('/js', express.static(__dirname + '/src/js'));
app.use('/', express.static(__dirname + '/src/favicon'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
	origin: ['https://genznews.onrender.com', 'http://127.0.0.1', 'https://genznews.org'],
	optionsSuccessStatus: 200
}));

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/src/index.html');
});

app.get('/sitemap.xml', async (req, res) => {
	res.header('Content-Type', 'application/xml');
	res.header('Content-Encoding', 'gzip');

	if (sitemap) {
		res.send(sitemap);
		return;
	}
	else {
		res.status(404).send("Sitemap not generated yet");
	}
});

app.get('/article/:id', (req, res) => {
	fs.readFile(__dirname + '/src/article.html', 'utf8', async (err, data) => {
		if (err) {
			res.status(500).send("Internal Server Error");
			return;
		}

		let id = req.params.id;
		let article = await getArticle(id);
		
		if (article == null) {
			res.status(404).send("Not Found");
			return;
		}

		data = data.replaceAll("${title}", article.title);
		data = data.replaceAll("${url}", "https://genznews.org/article/" + id);
		data = data.replaceAll("${image}", article.image);
		data = data.replaceAll("${time}", article.time);

		let content = article.content;

		content = content.replaceAll("<", "&lt;");
		content = content.replaceAll(">", "&gt;");
		content = content.replaceAll("  ", " ");
		content = content.replaceAll("*", "");
		content = content.replaceAll("#", "");
		
		content = content.split("\n");

		let buffer = "";
		content.forEach((line, index) => {
			line = line.trim();

			if (line.length != 0) {
				buffer += `<p>${line}</p>`;
			}
		});

		data = data.replaceAll("${content}", buffer);
		data = data.replaceAll("${description}", content.join(" ").replaceAll("\"", '').substring(0, 200) + "...");

		res.send(data);

		let query = "UPDATE genznews.articles SET view = view + 1 WHERE id = $1";
		await queryDB(query, [id]);
	});
});

app.listen(port, async () => {
	process.env.TZ = "America/New_York";

	createSitemap();

	if (process.argv.length > 2 && process.argv[2] == "dev") {
		console.log(`Server is running on port ${port} (dev)`);
	}
	else {
		console.log(`Server is running on port ${port}`);
		startAutomation();
	}
});

/* Automation */
async function startAutomation() {
	console.log("Starting automation...");

	// Get news every 1 minute
	setIntervalAndExecute(updateNews, 1000 * 60 * 1);

	//Generate article every 2 minutes
	setIntervalAndExecute(generate, 1000 * 60 * 2);
}

async function generate() {
	console.log("Queue size: " + news.length);
	if (news.length == 0) {
		return;
	}

	let article = news.shift();
	console.log(`Target: ${article.title}`);

	let content = await getArticleContent(article.url, article.query);
	if (content == null) {
		return;
	}

	console.log("Generating article...");
	let [title, generatedContent] = await generateArticleContent(content);
	if (title == null || generatedContent == null) {
		return;
	}

	console.log("Generating image...");
	let [image, keyword] = await generateImage(generatedContent);

	console.log("Creating article...");
	await createArticle(title, image, generatedContent, article.url, keyword);

	console.log("Done!");
	createSitemap();
}

async function generateArticleContent(content) {
	const prompt = [
		{text: "You are a gen-z news reporter. Write in Gen-Z style.\n\n### Mostly use those gen z words in your article. Use them as much as possible.\n> lowkey - little\n> cap - lie\n> no cap - not a lie\n> lmao\n> W - win\n> L - lose\n> flex - to show off> fam - calling close friends\n> , fr fr - for real (comes only back)\n\n### Shorten most words.\n### Use TikTok words\n### Always use Abbreviations (cuz, u...)\n### Never write in formal tone - write informally.### Never use millennium slangs (YOLO, dude, bro, O RLY, 'Sup, Hella)\n### Never use emojis.\n\n### Rules\n> First line is a title. Title must be able to explain the article and it should be long. Do not include gen-z slangs for the title.\n> Never mention news agencies' names\n> Write each paragraph long.\n> CALL viewers as \"chat\"> Never use hashtags.> Use Gen-Z slangs in every sentence.\n\nWrite a long news article based on the given article."},
		{text: "input: " + content},
		{text: "output: "},
	];

	content = await gemini(prompt);
	if (content == null) {
		return [null, null];
	}

	// Remove markdown formatting
	content = content.replaceAll("*", "");
	content = content.replaceAll("#", "");

	// Trim result
	content = content.split("\n");
	content.forEach((line, index) => {
		content[index] = line.trim();
		if (content[index].length == 0) {
			content.splice(index, 1);
		}
	});

	let title = content.shift();
	content = content.join("\n");

	return [title, content];
}

async function generateImage(content) {
	const prompt = [
		{text: "Give me one broad keyword from this news article. Only give me the keyword."},
		{text: "input: " + content},
		{text: "output: "},
	];

	let response = await gemini(prompt);

	if (response == null) {
		return [await getUnsplashImage("cat", 100), response];
	}

	let image = await getUnsplashImage(response, 5);

	if (image == null) {
		image = await getFlickrImage(response);

		if (image == null) {
			return [await getUnsplashImage("cat", 100), response];
		}
	}
	
	return [image, response];
}

function setIntervalAndExecute(fn, t) {
    fn();
    return(setInterval(fn, t));
}

/* DB */
const pool = new pg.Pool({
	user: "avnadmin",
	password: process.env.DB_PASS,
	host: process.env.DB_HOST,
	port: 17890,
	database: "defaultdb",
	keepAlive: true,
	connectionTimeoutMillis: 300000,
	idleTimeoutMillis: 600000 * 60,
	max: 5,

	ssl: {
		require: true,
		rejectUnauthorized: false
    }
});

pool.connect(err => {
	if (err) {
		console.error('connection error', err.stack);
	} else {
		console.log('connected');
	}
});

async function queryDB(query, params) {
	try {
		// let start = Date.now();
		let response = await pool.query(query, params);
		// console.log("Query took " + ((Date.now() - start) / 1000) + "s");
		
		return response;
	} catch (e) {
		console.log("Error in queryDB()");
		console.log(e);
	}
}

/* API */
app.get('/api/articles', async (req, res) => {
	let start = req.query.start;
	let size = req.query.size;

	if (!(start && size) || isNaN(start) || isNaN(size)) {
		res.status(400).send("Bad Request");
		return;
	}

	let query = "SELECT id, title, time, image FROM genznews.articles ORDER BY time DESC LIMIT $1 OFFSET $2";
	let response = await queryDB(query, [size, start]);

	res.json(response.rows);
});

app.get('/api/popular', async (req, res) => {
	let mindate = Date.now() - 1000 * 60 * 60 * 24;

	let query = "SELECT id, title, time, image FROM genznews.articles WHERE time > $1 ORDER BY view DESC LIMIT 5";
	let response = await queryDB(query, [mindate]);

	res.json(response.rows);
});

async function getArticle(id) {
	if (!id || id.length != 8) {
		return null;
	}

	let query = "SELECT * FROM genznews.articles WHERE id = $1";
	let response = await queryDB(query, [id]);

	if (response.rows.length == 0) {
		return null;
	}

	return response.rows[0];
}

async function createArticle(title, image, content, original = "", keyword = "") {
	let date = Date.now();

	let id = Math.floor(date / 1000).toString(16);
	id = id.substring(6, 8) + id.substring(0, 6);

	let query = "INSERT INTO genznews.articles (id, title, content, image, time, original, keyword) VALUES ($1, $2, $3, $4, $5, $6, $7)";
	await queryDB(query, [id, title, content, image, date, original, keyword]);

	return id;
}

/* News */
let news = [];

async function updateNews() {
	console.log("Updating news...");
	updateFoxNews();
	updateCbsUSNews();
	updateCbsWorldNews();
	updateNbcNews();
	console.log(news.length);
}

async function checkURLUsed(url) {
	let query = "SELECT exists (SELECT 1 FROM genznews.articles WHERE original = $1)";
	let response = await queryDB(query, [url]);

	return response.rows[0].exists;
}

async function getArticleContent(url, query) {
	try {
		let response = await axios.get(url);
		response = response.data;

		const dom = new JSDOM(response);
		let content = dom.window.document.querySelectorAll(query);

		let text = "";
		for (let i = 0; i < content.length; i++) {
			content[i].textContent = content[i].textContent.trim();
			if (content[i].textContent.length == 0) {
				continue;
			}

			text += content[i].textContent + "\n";
		}

		return text;
	} catch (e) {
		console.log("Error in getArticleContent()");
		console.log(e);
		return null;
	}
}

async function updateCbsWorldNews() {
	try {
		let response = await axios.get('https://www.cbsnews.com/world/');
		response = response.data;

		const dom = new JSDOM(response);
		let articles = dom.window.document.querySelector("#component-topic-world");
		articles = articles.querySelectorAll(".item--type-article");

		for (let i = 0; i < articles.length; i++) {
			const article = articles[i];

			let title = article.querySelector(".item__hed").textContent.trim();
			let link = article.querySelector("a").href;

			if (await checkURLUsed(link)) {
				continue;
			}

			news.push({
				title: title,
				url: link,
				query: ".content__body > p"
			});
		}
	} catch (e) {
		console.log("Error in updateCbsWorldNews()");
		console.log(e);
	}
}

async function updateCbsUSNews() {
	try {
		let response = await axios.get('https://www.cbsnews.com/us/');
		response = response.data;
	
		const dom = new JSDOM(response);
		let articles = dom.window.document.querySelector("#component-topic-us");
		articles = articles.querySelectorAll(".item--type-article");
		
		for (let i = 0; i < articles.length; i++) {
			const article = articles[i];
	
			let title = article.querySelector(".item__hed").textContent.trim();
			let link = article.querySelector("a").href;
	
			if (await checkURLUsed(link)) {
				continue;
			}

			news.push({
				title: title,
				url: link,
				query: ".content__body > p"
			});
		}
	} catch (e) {
		console.log("Error in updateCbsUSNews()");
		console.log(e);
	}
}

async function updateNbcNews(time) {
	try {
		let response = await axios.get('https://www.nbcnews.com/latest-stories');
		response = response.data;
	
		const dom = new JSDOM(response);
		let articles = dom.window.document.querySelectorAll(".wide-tease-item__info-wrapper");
	
		for (let i = 0; i < articles.length; i++) {
			const article = articles[i];
	
			let title = article.querySelector(".wide-tease-item__headline").textContent.trim();
			let link = article.querySelectorAll("a")[1].href;

			if (link.includes("/select/")) {
				continue;
			}
	
			if (await checkURLUsed(link)) {
				continue;
			}

			news.push({
				title: title,
				url: link,
				query: ".article-body__content > p"
			});
		}
	} catch (e) {
		console.log("Error in updateNbcNews()");
		console.log(e);
	}
}

async function updateFoxNews() {
	try {
		let config = {
			method: 'get',
			url: 'https://www.foxnews.com/api/article-search?searchBy=tags&values=fox-news&excludeBy=tags&excludeValues=&from=0&size=10'
		}
	
		let response = await axios(config);
		let articles = response.data;
	
		for (let i = 0; i < articles.length; i++) {
			const article = articles[i];
	
			if (article.isLive == true || article.url.includes('/video/')) {
				continue;
			}

			let url = new URL(article.url, "https://www.foxnews.com").href;

			if (await checkURLUsed(url)) {
				continue;
			}
			
			news.push({
				title: article.title,
				url: url,
				query: ".article-body p:not(p:has(strong, span))" // Removes ads and captions
			});
		}
	} catch (e) {
		console.log("Error in updateFoxNews()");
		console.log(e);
	}
}

/* Gemini */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-1.5-flash-latest";

async function gemini(prompt) {
	try {
		const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
		const model = genAI.getGenerativeModel({ model: MODEL_NAME });

		const generationConfig = {
			temperature: 1,
			topP: 0.95,
			topK: 64,
			maxOutputTokens: 8192,
			responseMimeType: "text/plain",
		};

		const safetySettings = [
			{
				category: HarmCategory.HARM_CATEGORY_HARASSMENT,
				threshold: HarmBlockThreshold.BLOCK_NONE,
			},
			{
				category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
				threshold: HarmBlockThreshold.BLOCK_NONE,
			},
			{
				category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
				threshold: HarmBlockThreshold.BLOCK_NONE,
			},
			{
				category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
				threshold: HarmBlockThreshold.BLOCK_NONE,
			}
		];

		const parts = prompt;

		const result = await model.generateContent({
			contents: [{ role: "user", parts }],
			generationConfig,
			safetySettings,
		});

		const response = result.response;
		return response.text();
	} catch (e) {
		console.log("Error in gemini()");
		console.log(e);
		return null;
	}
}

/* Flickr */
const FLICKR_API_KEY = process.env.FLICKR_API_KEY;

async function getUnsplashImage(query, size = 10) {
	let config = {
		method: 'get',
		url: `https://unsplash.com/napi/search/photos?query=${query}&per_page=100`,
	};

	let response = await axios(config);
	response = response.data.results;
	response = response.filter(x => x.premium == false);

	response = response.slice(0, size);

	if (response.length == 0) {
		return null;
	}

	let index = Math.floor(Math.random() * response.length);
	
	let url = response[index].urls.regular;
	url = url.split('&');
	url = url.filter(x => x.indexOf('ixid=') == -1);
	url = url.filter(x => x.indexOf('ixlib=') == -1);
	url = url.join('&');

	return url;
}

async function getFlickrImage(query, size = 10) {
	try {
		let config = {
			method: 'get',
			maxBodyLength: Infinity,
			url: 'https://api.flickr.com/services/rest?' + new URLSearchParams({
				method: 'flickr.photos.search',
				api_key: FLICKR_API_KEY,
				text: query,
				sort: 'relevance',
				extras: 'url_l',
				per_page: size,
				page: 1,
				license: '4,5,6,9,10',
				format: 'json',
				nojsoncallback: 1,
				content_type: 1
			}),
			headers: {
				'Cookie': 'ccc=%7B%22needsConsent%22%3Afalse%2C%22managed%22%3A0%2C%22changed%22%3A0%2C%22info%22%3A%7B%22cookieBlock%22%3A%7B%22level%22%3A0%2C%22blockRan%22%3A0%7D%7D%7D',
				'User-Agent': 'GenZNews/1.0',
			}
		};
	
		let response = await axios.request(config);
		response = response.data.photos.photo;
		if (response.length == 0) {
			return null;
		}

		let image = response[Math.floor(Math.random() * response.length)];

		return image.url_l;
	} catch (e) {
		console.log("Error in getFlickrImage()");
		console.log(e);
		return null;
	}
}

/* AI */
const AI_API_URL = process.env.AI_API_URL;

async function ai(prompt) {
	let config = {
		method: 'post',
		url: AI_API_URL,
		headers: {
			'Content-Type': 'application/json'
		},
		data: JSON.stringify({
			model: "gpt-3.5-turbo",
			stream: false,
			messages: prompt
		})
	};

	let response = await axios(config);
	return response.data.choices[0].message.content;
}

/* Sitemap */
async function createSitemap() {
	try {
		const smStream = new SitemapStream({ hostname: 'https://genznews.org/' })
		const pipeline = smStream.pipe(createGzip())

		// pipe your entries or directly write them.
		smStream.write({ url: '/', changefreq: 'always', priority: 1.0 })

		let query = "SELECT id FROM genznews.articles";
		let response = await queryDB(query, []);
		response = response.rows;

		for (let i = 0; i < response.length; i++) {
			smStream.write({ url: `/article/${response[i].id}`, changefreq: 'daily', priority: 0.7 });
		}

		// cache the response
		streamToPromise(pipeline).then(sm => sitemap = sm)
		// make sure to attach a write stream such as streamToPromise before ending
		smStream.end()
	} catch (e) {
		console.error(e)
	}
}