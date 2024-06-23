const ARTICLE_LOAD_SIZE = 10;
let nextLoadPosition = 0;
let loading = false;

document.addEventListener('DOMContentLoaded', function () {
	createSkeleton();
	loadPopularArticles();
	loadLatestArticles();
});

async function load() {
	if (loading) {
		return;
	}

	loading = true;

	document.getElementById('more').innerHTML = 'LOADING...';

	await loadLatestArticles();

	loading = false;
	document.getElementById('more').innerHTML = 'MOAR!!! ▼';

}

function createSkeleton() {
	let popular = document.getElementById('list_popular');
	let latest = document.getElementById('list_latest');

	for (let i = 0; i < 5; i++) {
		popular.appendChild(createSkeletonItem());
	}

	for (let i = 0; i < ARTICLE_LOAD_SIZE; i++) {
		latest.appendChild(createSkeletonItem());
	}
}

function createSkeletonItem() {
	let item = document.createElement('div');
	item.className = 'item skeleton';

	let div = document.createElement('div');

	item.appendChild(div.cloneNode());
	item.appendChild(div.cloneNode());
	item.appendChild(div.cloneNode());
	item.appendChild(div.cloneNode());

	return item;
}

async function loadPopularArticles() {
	let popular = document.getElementById('list_popular');
	let temp = document.createElement('div');

	let articles = await fetch(host + '/api/popular');
	articles = await articles.json();

	for (let article of articles) {
		let item = createItem(article.title, article.time, article.image, article.id);
		temp.appendChild(item);
	}

	popular.innerHTML = temp.innerHTML;
}

async function loadLatestArticles() {
	let latest = document.getElementById('list_latest');
	let temp = document.createElement('div');

	let articles = await fetch(host + '/api/articles?' + new URLSearchParams({
		start: nextLoadPosition,
		size: ARTICLE_LOAD_SIZE
	}));

	articles = await articles.json();

	for (let article of articles) {
		let item = createItem(article.title, article.time, article.image, article.id);
		temp.appendChild(item);
	}

	if (nextLoadPosition == 0) {
		latest.innerHTML = temp.innerHTML;
	}
	else {
		latest.innerHTML += temp.innerHTML;
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