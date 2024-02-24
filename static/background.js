const browser = chrome || browser

const tabQuery = (options, params = {}) => new Promise(res => {
    if (!options.countPinnedTabs) params.pinned = false
    if (!options.countGroupedTabs) params.groupId = browser.tabGroups.TAB_GROUP_ID_NONE
    browser.tabs.query(params, tabs => res(tabs))
})

const windowRemaining = options =>
	tabQuery(options, { currentWindow: true })
		.then(tabs => options.maxWindow - tabs.length)

const totalRemaining = options =>
	tabQuery(options)
		.then(tabs => options.maxTotal - tabs.length)

const updateBadge = options => {
	if (!options.displayBadge) {
		browser.action.setBadgeText({
		text: "" })
		return;
	}

	Promise.all([windowRemaining(options), totalRemaining(options)])
	.then(remaining => {
		browser.action.setBadgeText({
			text: Math.min(...remaining).toString()
		});
		chrome.action.setBadgeBackgroundColor({
			color: "#7e7e7e"
		})
	})
}

const detectTooManyTabsInWindow = options => new Promise(res => {
	tabQuery(options, { currentWindow: true }).then(tabs => {
		if (options.maxWindow < 1) return;
		if (tabs.length > options.maxWindow) res("window");
	});
})

const detectTooManyTabsInTotal = options => new Promise(res => {
	tabQuery(options).then(tabs => {
		if (options.maxTotal < 1) return;
		if (tabs.length > options.maxTotal) res("total");
	});
})

const getOptions = () => new Promise((res, rej) => {
	browser.storage.sync.get("defaultOptions", (defaults) => {
		browser.storage.sync.get(defaults.defaultOptions, (options) => {
			res(options);
		})
	})
})

const displayAlert = (options, place) => new Promise((res, rej) => {
	if (!options.displayAlert) { return res(false) }

	const replacer = (match, p1, offset, string) => {
		switch (p1) {
			case "place":
			case "which":
				return place === "window" ?
					"one window" : "total";
				break;

			case "maxPlace":
			case "maxWhich":
				return options[
					"max" + capitalizeFirstLetter(place)
				];
				break;

			default:
				return options[p1] || "?";
		}
	};

	const renderedMessage = options.alertMessage.replace(
		/{\s*(\S+)\s*}/g,
		replacer
	)
	alert(renderedMessage);
})

let tabCount = -1
let previousTabCount = -1
let amountOfTabsCreated = -1

const updateTabCount = () => new Promise(res => browser.tabs.query({}, tabs => {
	if (tabs.length == tabCount) {
		return res(amountOfTabsCreated);
	}

	previousTabCount = tabCount
	tabCount = tabs.length
	amountOfTabsCreated =
		~previousTabCount ? tabCount - previousTabCount : 0
	res(amountOfTabsCreated)
}))

let passes = 0;

const handleExceedTabs = (tab, options, place) => {
	console.log(place)
	if (options.exceedTabNewWindow && place === "window") {
		browser.windows.create({ tabId: tab.id, focused: true});
	} else {
		browser.tabs.remove(tab.id);
	}
}

const handleTabCreated = tab => options => {
	return Promise.race([
		detectTooManyTabsInWindow(options),
		detectTooManyTabsInTotal(options)
	])
	.then((place) => updateTabCount().then(amountOfTabsCreated => {
		if (passes > 0) {
			console.log("passed with pass no. ", passes)
			passes--;
			return;
		}
		console.log("amountOfTabsCreated", amountOfTabsCreated)
		displayAlert(options, place)
		if (amountOfTabsCreated === 1) {
			handleExceedTabs(tab, options, place);
			app.update()
		} else if (amountOfTabsCreated > 1) {
			passes = amountOfTabsCreated - 1
		} else if (amountOfTabsCreated === -1) {
			handleExceedTabs(tab, options, place);
			app.update()
		} else {
			throw new Error("weird: multiple tabs closed after tab created")
		}
	}))
}

const app = {
	init: function() {
		browser.storage.sync.set({
			defaultOptions: {
				maxTotal: 20,
				maxWindow: 20,
				exceedTabNewWindow: false,
				displayAlert: true,
				countPinnedTabs: false,
				countGroupedTabs: false, // added
				displayBadge: true,
				alertMessage: chrome.i18n.getMessage("string_7")
			}
		});

		browser.tabs.onCreated.addListener(tab =>
			getOptions().then(handleTabCreated(tab))
		)

		console.log("init", this)
		browser.windows.onFocusChanged.addListener(app.update)
		browser.tabs.onCreated.addListener(app.update)
		browser.tabs.onRemoved.addListener(app.update)
		browser.tabs.onUpdated.addListener(app.update)
	},
	update: () => {
		updateTabCount();
		getOptions().then(updateBadge)
	}
};

app.init();
app.update();

function capitalizeFirstLetter(string) {
	return string[0].toUpperCase() + string.slice(1);
}