console.log('Exporter add-on loaded');

const onMessage = async function (request, sender, sendResponse) {
	if (!/https?:\/\/\w+\.rsrsdb\.com/.test(sender.url)) return;
	switch (request.type) {
		case 'start':
			let result = await importData(request.deviceCode);
			sendResponse(result);
			break;
		case 'ping':
			sendResponse();
			break;
		default:
			throw `Unrecognized message received: ${msg.type}`;
	}
};
chrome.runtime.onMessageExternal.addListener(onMessage);

let output = [];
async function importData(deviceCode) {
	output = [];

	let playerInfo = null;
	let playerSummary = null;

	try {
		// Start importing
		printOut('Acquiring token... ');
		let token = await acquireToken(deviceCode);
		if (!token) {
			printOut('Invalid token...', true);
			outputClass = 'danger';
			return { outputClass: outputClass, output: output, playerInfo: playerInfo, playerSummary: playerSummary };
		}
		printOut('OK!', true);

		printOut('Verifying data and assets versions... ');
		let masterVersion, assetVersion;
		[masterVersion, assetVersion] = await getVersionStatus(deviceCode, token);
		printOut('OK!', true);

		printOut('Fetching player record... ');
		let playerId = await getPlayerData(deviceCode, token, masterVersion, assetVersion);
		printOut(`Player ID: ${playerId}`, true);

		printOut('Fetching player info... ');
		playerInfo = await getPlayerInfo(deviceCode, token, masterVersion, assetVersion);
		printOut(`Rank: ${playerInfo.rank}, Stamina: ${playerInfo.stamina} / ${playerInfo.max_stamina}`, true);

		printOut('Fetching data... ');
		playerSummary = await getPlayerSummary(deviceCode, token, masterVersion, assetVersion);
		printOut('OK!', true);
		outputClass = 'success';
	} catch (err) {
		console.error(err);
		output.push(err.message);
		outputClass = 'danger';
	}

	return { outputClass: outputClass, output: output, playerInfo: playerInfo, playerSummary: playerSummary };
}

function printOut(line, appendLastLine = false) {
	console.log(line);
	if (output.length < 1 && appendLastLine) appendLastLine = false;
	if (appendLastLine) output[output.length - 1] += line;
	else output.push(line);
}

async function acquireToken(deviceCode) {
	let result = await run('auth/signin', undefined, deviceCode);
	return result.token;
}

async function getVersionStatus(deviceCode, token) {
	let result = await run('status', undefined, deviceCode, token);
	return [result.master_version, result.assets_version];
}

async function getPlayerData(deviceCode, token, masterVersion, assetVersion) {
	let body = JSON.stringify({ language: 1, lives_in_eea: false, is_16_years_old_or_over: null, country: 'US', nick_name: 'Polka', device_type: 2 });
	let result = await run('player/create', body, deviceCode, token, masterVersion, assetVersion);
	return result.player_id;
}

async function getPlayerInfo(deviceCode, token, masterVersion, assetVersion) {
	return await run('player/info', undefined, deviceCode, token, masterVersion, assetVersion);
}

async function getPlayerSummary(deviceCode, token, masterVersion, assetVersion) {
	return await run('player/summary', undefined, deviceCode, token, masterVersion, assetVersion);
}

async function run(path, body, deviceCode, token, masterVersion, assetVersion) {
	let headers = {
		'Content-Type': 'application/json',
		'X-Mikoto-Request-Id': uuidv4(),
		'X-Mikoto-Client-Version': '1.17.20-f0d41edcdb594bdc3830203dc336e6f4',
		'X-Mikoto-Platform': 'android',
		'X-Mikoto-Device-Secret': deviceCode
	};
	if (token) headers['X-Mikoto-Token'] = token;
	if (masterVersion) headers['X-Mikoto-Master-Version'] = masterVersion;
	if (assetVersion) headers['X-Mikoto-Assets-Version'] = assetVersion;

	let result = await fetch(`https://production-api.rs-us.aktsk.com/${path}`, {
		method: 'post',
		headers: headers,
		body: body
	});
	return result.json();
}
function uuidv4(a) {
	return a ? (a ^ ((Math.random() * 16) >> (a / 4))).toString(16) : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, uuidv4);
}
