let host = 'http://127.0.0.1'

function toUSTime(time) {
	let date = moment(Number(time)).tz("America/New_York").format('LLL');
	return date;
}

function home() {
	window.location.href = '/';
}