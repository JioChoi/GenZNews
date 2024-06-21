const ARTICLE_LOAD_SIZE = 10;
let nextLoadPosition = 0;

document.addEventListener('DOMContentLoaded', function () {
	loadPopularArticles();
	loadLatestArticles();
});

async function loadPopularArticles() {
	let popular = document.getElementById('list_popular');

	let articles = await fetch(host + '/api/popular');
	articles = await articles.json();

	for (let article of articles) {
		let item = createItem(article.title, article.time, article.image, article.id);
		popular.appendChild(item);
	}
}

async function loadLatestArticles() {
	let latest = document.getElementById('list_latest');

	let articles = await fetch(host + '/api/articles?' + new URLSearchParams({
		start: nextLoadPosition,
		size: ARTICLE_LOAD_SIZE
	}));

	articles = await articles.json();

	for (let article of articles) {
		let item = createItem(article.title, article.time, article.image, article.id);
		latest.appendChild(item);
	}

	nextLoadPosition += articles.length;
}

function createItem(title, time, image, id) {
	let date = toUSTime(time);

	let a = document.createElement('a');
	a.href = '/article/' + id;

	let item = document.createElement('div');
	item.className = 'item';

	let itemImage = document.createElement('img');
	itemImage.src = image;

	let itemTitle = document.createElement('h2');
	itemTitle.innerHTML = title;

	let itemDate = document.createElement('p');
	itemDate.innerHTML = date;

	item.appendChild(itemImage);
	item.appendChild(itemTitle);
	item.appendChild(itemDate);

	a.appendChild(item);

	return a;
}