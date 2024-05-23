const browser = chrome || browser
const tabQuery = (options, params = {}) => new Promise(res => {
	if (!options.countPinnedTabs && params.pinned === undefined) params.pinned = false
    if (!options.countGroupedTabs && params.groupId === undefined) params.groupId = browser.tabGroups.TAB_GROUP_ID_NONE
    browser.tabs.query(params, tabs => res(tabs))
})

// tabQuery({countPinnedTabs: false, countGroupedTabs: false})

const getGroupsCount = () => new Promise(res => {
    browser.tabGroups.query({}, function(groups) {
        res(groups.length); 
    });
});

const windowRemaining = options =>
	tabQuery(options, { currentWindow: true })
		.then(tabs => options.maxWindow - tabs.length)

const totalRemaining = options =>
	tabQuery(options)
		.then(tabs => options.maxTotal - tabs.length)

const groupsRemaining = options =>
	getGroupsCount()
		.then(count => options.maxGroups - count)

const updateBadge = options => {
	if (!options.displayBadge) {
		browser.action.setBadgeText({ text: "" })
		return;
	}

	Promise.all([windowRemaining(options), totalRemaining(options)])
    .then(async remaining => {
        let text1 = Math.min(...remaining).toString();
        const remainingGroups = await groupsRemaining(options)
		let text2 = remainingGroups.toString()
		browser.action.setBadgeText({
			text: text1 + '|' + text2
		})
		browser.action.setBadgeBackgroundColor({
			color: "#7e7e7e"
		})
    })
}

let $inputs;

const saveOptions = () => {

	const values = {};

	for (let i = 0; i < $inputs.length; i++) {
		const input = $inputs[i];

		const value =
			input.type === "checkbox" ?
			input.checked :

			input.value;

		values[input.id] = value;
	}

	const options = values;

	browser.storage.sync.set(options, () => {

		const status = document.getElementById('status');
		status.className = 'notice';
		status.textContent = browser.i18n.getMessage("string_9");
		setTimeout(() => {
			status.className += ' invisible';
		}, 100);

		updateBadge(options)
	});
}

const restoreOptions = () => {
	browser.storage.sync.get("defaultOptions", (defaults) => {
		browser.storage.sync.get(defaults.defaultOptions, (options) => {

			for (let i = 0; i < $inputs.length; i++) {
				const input = $inputs[i];

				const valueType =
					input.type === "checkbox" ?
					"checked" :
					"value";

				input[valueType] = options[input.id];
			};
		
		 document.getElementById('pinnedTabsCount').innerText = options.pinnedTabsCount;
		 document.getElementById('groupedTabsCount').innerText = options.groupedTabsCount;
		 document.getElementById('groupsCount').innerText = options.groupsCount;

		});
	});
}

document.addEventListener('DOMContentLoaded', () => {
	restoreOptions();

	$inputs = document.querySelectorAll('#options input');

	const onChangeInputs =
		document.querySelectorAll('#options [type="checkbox"], #options [type="number"]');
	const onKeyupInputs =
		document.querySelectorAll('#options [type="text"], #options [type="number"]');

	for (let i = 0; i < onChangeInputs.length; i++) {
		onChangeInputs[i].addEventListener('change', saveOptions);
	}
	for (let i = 0; i < onKeyupInputs.length; i++) {
		onKeyupInputs[i].addEventListener('keyup', saveOptions);
	}

	if (!localStorage.getItem('readMessage') && (new Date() < new Date('09-20-2020'))) {
		document.querySelector('.message').classList.remove('hidden')
		setTimeout(() => {
			localStorage.setItem('readMessage', true)
		}, 2000);
	}
});