document.addEventListener('DOMContentLoaded', function () {
	convertTimeToDate();
});

function convertTimeToDate() {
	let time = document.getElementById('date').innerText;
	let date = toUSTime(time);
	document.getElementById('date').innerText = date;
}