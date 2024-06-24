let host;

document.addEventListener('DOMContentLoaded', function () {
	host = window.location.origin;
});

function toUSTime(time) {
	let date = moment(Number(time)).tz("America/New_York").format('LLL');
	return date;
}

function home() {
	window.location.href = '/';
}