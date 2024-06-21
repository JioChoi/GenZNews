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

/* Express */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
	origin: ['https://nekonews.onrender.com', 'http://127.0.0.1', 'https://nekonews.cc'],
	optionsSuccessStatus: 200
}));

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/src/index.html');
});

app.listen(port, () => {
	process.env.TZ = "America/New_York";
	
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

	// Generate article every 2 minutes
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
	let image = await generateImage(content);

	console.log("Creating article...");
	await createArticle(title, image, generatedContent);

	console.log("Done!");
}

async function generateArticleContent(content) {
	const prompt = [
		{text: "input: Write news article like gen-z. Use excessive gen-z slangs.\n\nHere are some example of formal English sentence and its gen-z translation:\n\nThat was really funny.\tI'm weak.\nThat looks really good.\tThat's bussin'.\nShe looks very attractive.\tShe's a snack.\nThat song is amazing.\tThat song is a bop.\nHe is very talented.\tHe's the G.O.A.T.\nThey are very good looking.\tThey're snatched.\nThis is very stylish.\tThis has drip.\nShe is overreacting.\tShe's being extra.\nHe is trying too hard to impress.\tHe's simping.\nI agree with what you said.\tFacts.\nHe is very arrogant.\tHe's a Chad.\nI can't believe this happened.\tI oop.\nYou are being unreasonable.\tThis ain't it, chief.\nThat's very embarrassing.\tBig yikes.\nThey are gossiping about someone.\tThey're sipping tea.\nI am very excited about this.\tIt's giving excitement.\nYou did a great job.\tYou understood the assignment.\nThey are ignoring me.\tThey're ghosting me.\nI'm going to go now.\tI'm finna dip.\nI understand what you mean.\tIykyk.\nI'm very impressed.\tSheesh.\nI'm really upset about this.\tI'm salty.\nLet's start this.\tLet's get this bread.\nThat's very typical of him.\tClassic Chad.\nShe did well in her transformation.\tShe had a major glow-up.\nThat's very common.\tThat's basic.\nHe is showing off his new car.\tHe's flexing his new ride.\nShe is very successful.\tShe's killing it.\nThis is very exciting.\tThis is lit.\nHe is very annoying.\tHe's so extra.\nThat's a great opportunity.\tThat's a big win.\nI disagree with that.\tThat's cap.\nThey did not perform well.\tThat was mid.\nThat was a smart move.\tBig brain move.\nShe is not very smart.\tShe's a clown.\nI'm tired of this.\tI'm so done.\nHe did something amazing.\tHe popped off.\nShe is very manipulative.\tShe knows how to finesse.\nThat's an excellent plan.\tThat's high-key a good plan.\nI need to think about this.\tLet me vibe on this.\nThat was a very close game.\tThat game was clutch.\nHe is very charismatic.\tHe's got that main character energy.\nThey are very dramatic.\tThey're serving drama.\nThat was a bold statement.\tThat was a hot take.\nI'm very surprised.\tThat had me shook.\nHe is very predictable.\tHe's basic.\nThat was very awkward.\tThat was cringe.\nShe is trying to be trendy.\tShe's being cheugy.\nI'm very bored.\tThis is so dead.\nThat's a bad idea.\tThat's a no from me, dawg.\nI'm feeling very relaxed.\tI'm chilling.\nHe looks very handsome.\tHe's looking like a zaddy.\nThis situation is confusing.\tThis is sus.\nThey are very passionate.\tThey're going hard.\nI am very disappointed.\tI'm low-key hurt.\nWe need to start over.\tWe gotta reset.\nThat was a difficult task.\tThat was a tough grind.\nI'm very curious about this.\tThis has me wondering.\nShe is being very secretive.\tShe's keeping it low key.\nThat's very impressive.\tThat slaps.\nHe is being unreasonable.\tHe's being a Karen.\nThis is very important.\tThis is major.\nI'm very anxious about this.\tI'm stressed af.\nThey are very unreliable.\tThey're not it.\nShe is behaving childishly.\tShe's being a total Karen.\nI'll see you tomorrow if you're available.\tBet, I'll catch you tomorrow if you're low key free.\nThat restaurant was really good, especially the pizza.\tThat spot was bussin', especially the pizza, no cap.\nShe performed very well in the concert last night.\tShe totally slayed in the concert last night, sis.\nHe is always showing off his new car.\tHe's always tryna flex with his new whip.\nThis party is amazing!\tThis party is lit af!\nShe's very good at manipulating people to get what she wants.\tShe's got mad finesse, always getting her way.\nI cannot believe how well you did!\tI'm weak, you really ate that up!\nHe is very popular among his peers due to his charm.\tHe's a total main character, fam, everyone digs him.\nI've decided to stop talking to him.\tI'm gonna ghost him, periodt.\nShe's always gossiping about others.\tShe stays sipping tea about everyone.\nThey are in a very complicated romantic relationship.\tThey're in a whole situationship, it's messy.\nYou need to improve your attitude if you want to succeed.\tYou gotta vibe check yourself if you wanna slay, fr.\nThis old movie is surprisingly good.\tThis old flick hits different, yas!\nI'm very excited about the plans for this weekend!\tI'm high-key hyped about this weekend's plans!\nHe didn't do his part of the project at all.\tHe was sleeping on his part of the project, smh.\nShe looks very attractive tonight.\tShe's looking like a total snack tonight.\nThey are always trying to be the center of attention.\tThey're always doing the most, so extra.\nI think you're overreacting to the situation.\tYou're being big mad over nothing, ngl.\nHe didn't understand the task and failed miserably.\tHe didn't understand the assignment and it was a major fail, big yikes.\nI love how confident you've become.\tGlow up is real, I'm all for this confident vibe.\nIf you keep practicing, I'm sure you'll be able to achieve your goals.\tKeep grinding, and I swear you're gonna reach those goals, no cap.\nI was very disappointed by the outcome of the meeting today.\tToday's meeting was a major letdown, fr, had me all kinds of salty.\nShe has a natural ability to make everyone feel comfortable around her.\tShe's got this vibe that just makes everyone feel all comfy, it's giving main character energy.\nHe tends to exaggerate his achievements to impress others.\tHe stays capping about his wins to flex on everyone.\nYou should consider changing your approach if you want better results.\tYou might wanna switch up your vibe if you're tryna see some real gains, tbh.\nThe concert last night was one of the best I've ever attended.\tLast night's concert slapped so hard, best one I've been to, periodt.\nShe needs to stop talking about her personal life at work.\tShe gotta chill with all that personal tea at work, sis needs to sip that quietly.\nIt seems like he's not interested in maintaining a serious relationship.\tLooks like he's not about cuffing for real, just wants to keep it casual.\nThis is an excellent opportunity for you to show what you're capable of.\tThis is your shot to flex what you got, go off!\nI can't believe how calm you were during that intense discussion.\tHow you kept it so chill in that heated convo is beyond me, I'm shook.\nThey often neglect their duties and blame others for their failures.\tThey always sleeping on their tasks and then tryna throw shade when things go left.\nYou're trying too hard to fit in with people who don't appreciate you.\tYou're doing the most to vibe with folks who don't even clap for you, big yikes.\nI've noticed a significant improvement in your work lately.\tI'm seeing some real glow-up in your work lately, you're killing it!\nHe always makes sure everyone has what they need during meetings.\tHe's always on point making sure everyone's set during meetings, total dad vibes.\nShe's very careful with her words when discussing sensitive topics.\tShe's mad careful with her words when it's about touchy stuff, really understands the assignment.\nI think you're letting your fear of failure prevent you from trying.\tYou're letting the fear of taking an L keep you from even stepping up, don't sleep on yourself.\nThey were very rude to the waiter for no apparent reason.\tThey were extra rude to the waiter for no reason, was giving major Karen energy.\nI'm always amazed by your ability to solve complex problems quickly.\tYour skills at busting out solutions for tough probs fast always has me gagged.\nIt's clear that you've put a lot of effort into this project.\tYou really went all out on this project, it shows, and it's bussin'.\nWe should collaborate more often; we make a great team.\tWe gotta link up more, we vibe well and make a dope team, fr.\n\nRules:\nThe first sentence is title of the article.\nWrite a long news article.\nNever use emoji.\n\nWrite based on this news article:\n\n" + content},
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
		{text: "I want to find a thumbnail for this news article. Please give me one keyword to search. Give me only the keyword. Do not give me people's name.\n\n" + content},
		{text: "output: "},
	];

	let response = await gemini(prompt);

	if (response == null) {
		return await getUnsplashImage("cat");
	}

	let image = await getUnsplashImage(response);
	return image;
}

function setIntervalAndExecute(fn, t) {
    fn();
    return(setInterval(fn, t));
}

/* DB */
const client = new pg.Pool({
	user: "avnadmin",
	password: process.env.DB_PASS,
	host: process.env.DB_HOST,
	port: 17890,
	database: "defaultdb",

	ssl: {
		require: true,
		rejectUnauthorized: false
    }
});

client.connect(err => {
	if (err) {
		console.error('connection error', err.stack);
	} else {
		console.log('connected');
	}
});

async function queryDB(query, params) {
	try {
		let response = await client.query(query, params);
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

async function createArticle(title, image, content) {
	let date = Date.now();

	let id = Math.floor(date / 1000).toString(16);
	id = id.substring(6, 8) + id.substring(0, 6);

	let query = "INSERT INTO genznews.articles (id, title, content, image, time) VALUES ($1, $2, $3, $4, $5)";
	await queryDB(query, [id, title, content, image, date]);

	return id;
}

/* News */
let news = [];
let foxLastTitle = "";
let nbcLastTitle = "";
let cbsUSLastTitle = "";
let cbsWorldLastTitle = "";

async function updateNews() {
	updateFoxNews();
	updateCbsUSNews();
	updateCbsWorldNews();
	updateNbcNews();
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

		let tempTitle = cbsWorldLastTitle;

		for (let i = 0; i < articles.length; i++) {
			const article = articles[i];

			let title = article.querySelector(".item__hed").textContent.trim();
			let link = article.querySelector("a").href;

			if (title == cbsWorldLastTitle) {
				break;
			}

			news.push({
				title: title,
				url: link,
				query: ".content__body > p"
			});

			if (i == 0) {
				tempTitle = title;
			}
		}

		cbsWorldLastTitle = tempTitle;
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
	
		let tempTitle = cbsUSLastTitle;
	
		for (let i = 0; i < articles.length; i++) {
			const article = articles[i];
	
			let title = article.querySelector(".item__hed").textContent.trim();
			let link = article.querySelector("a").href;
	
			if (title == cbsUSLastTitle) {
				break;
			}
	
			news.push({
				title: title,
				url: link,
				query: ".content__body > p"
			});
	
			if (i == 0) {
				tempTitle = title;
			}
		}
	
		cbsUSLastTitle = tempTitle;
	} catch (e) {
		console.log("Error in updateCbsUSNews()");
		console.log(e);
	}
}

async function updateNbcNews(time) {
	try {

		let response = await axios.get('https://www.nbcnews.com/latest-stories');
		//response = await pretty(response.data);
		response = response.data;
	
		const dom = new JSDOM(response);
		let articles = dom.window.document.querySelectorAll(".wide-tease-item__info-wrapper");
	
		let tempTitle = nbcLastTitle;
	
		for (let i = 0; i < articles.length; i++) {
			const article = articles[i];
	
			let title = article.querySelector(".wide-tease-item__headline").textContent.trim();
			let link = article.querySelectorAll("a")[1].href;
	
			if (title == nbcLastTitle) {
				break;
			}
	
			news.push({
				title: title,
				url: link,
				query: ".article-body__content > p"
			});
	
			if (i == 0) {
				tempTitle = title;
			}
		}
	
		nbcLastTitle = tempTitle;
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
	
		let tempTitle = foxLastTitle;
	
		for (let i = 0; i < articles.length; i++) {
			const article = articles[i];
	
			if (article.isLive == true || article.url.includes('/video/')) {
				continue;
			}
	
			if (article.title == foxLastTitle) {
				break;
			}
	
			news.push({
				title: article.title,
				url: new URL(article.url, "https://www.foxnews.com").href,
				query: ".article-body p:not(p:has(strong, span))" // Removes ads and captions
			});
	
			if(i == 0) {
				tempTitle = article.title;
			}
		}
	
		foxLastTitle = tempTitle;
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

async function getUnsplashImage(query) {
	let config = {
		method: 'get',
		url: `https://unsplash.com/napi/search/photos?query=${query}&per_page=30`,
	};

	let response = await axios(config);
	response = response.data.results;
	response = response.filter(x => x.premium == false);
	response = response.splice(0, 5);

	if (response.length == 0) {
		return await getUnsplashImage("cat");
	}

	let index = Math.floor(Math.random() * response.length);
	
	let url = response[index].urls.regular;
	url = url.split('&');
	url = url.filter(x => x.indexOf('ixid=') == -1);
	url = url.filter(x => x.indexOf('ixlib=') == -1);
	url = url.join('&');

	return url;
}

async function getFlickrImage(query) {
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
				per_page: 20,
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
			return await getFlickrImage("cat");
		}

		console.log(response);
		let image = response[Math.floor(Math.random() * response.length)];
		console.log(image);

		return image.url_l;
	} catch (e) {
		console.log("Error in getFlickrImage()");
		console.log(e);
		return null;
	}
}