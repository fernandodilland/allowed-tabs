const browser = chrome || browser

const tabQuery = (options, params = {}) => new Promise(res => {
	if (!options.countPinnedTabs && params.pinned === undefined) params.pinned = false
    if (!options.countGroupedTabs && params.groupId === undefined) params.groupId = browser.tabGroups.TAB_GROUP_ID_NONE
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
		browser.action.setBadgeBackgroundColor({
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

let alertTabId = null;
const displayAlert = (options, place) => {
    return new Promise((res, rej) => {
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
		console.log( renderedMessage)
		// // // fix: alert(confirm) dialog not working 
		browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
			alertTabId = tabs[0].id;  
			browser.scripting.executeScript({
				target: {tabId: tabs[0].id},
				function: function(message) {
					return new Promise((resolve, reject) => {
						const result = window.confirm(message);
						resolve(result);
					});
				},
				args: [renderedMessage]  // pass renderedMessage as args 
			}, function(results) {
				if (browser.runtime.lastError) {
					console.error(browser.runtime.lastError.message);
					res(false);
				} else if (results && results.length > 0 && results[0].result !== null) {
					res(results[0].result);
				} else {
					browser.scripting.executeScript({
						target: {tabId: tabs[0].id},
						function: function(message) {
							return new Promise((resolve, reject) => {
								const result = window.confirm(message);
								resolve(result);
							});
						},
						args: [renderedMessage]  // pass renderedMessage as args 
					}, function(results) {
						if (browser.runtime.lastError) {
							console.error(browser.runtime.lastError.message);
							res(false);
						} else if (results && results.length > 0 && results[0].result !== null) {
							res(results[0].result);
						} else {
							rej('No result from confirm dialog');
						}
					});
				}
			});
		});

    });
}




const getPinnedTabsCount = () => new Promise(res => {
    browser.tabs.query({pinned: true}, tabs => res(tabs.length));
});

const getGroupedTabsCount = () => new Promise(res => {
    browser.tabs.query({}, tabs => {
        const groupedTabs = tabs.filter(tab => tab.groupId !== browser.tabGroups.TAB_GROUP_ID_NONE);
        res(groupedTabs.length);
    });
});

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
		browser.tabs.remove(tab.id, function() {
			alertTabId = null;
			if (browser.runtime.lastError) {
				console.error(browser.runtime.lastError.message);
			} else {}
		});
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

		// fix: wait displayAlert Promise
		return displayAlert(options, place)  
		.then(() => {
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
		});
	}))
}

const app = {
	init: function() {
		browser.storage.sync.set({
			defaultOptions: {
				maxTotal: 56,
				maxWindow: 56,
				exceedTabNewWindow: false,
				displayAlert: true,
				countPinnedTabs: false, // added
				countGroupedTabs: false, // added
				displayBadge: true,
				alertMessage: browser.i18n.getMessage("string_7")
			}
		});

		browser.tabs.onCreated.addListener(tab =>
			getOptions().then(handleTabCreated(tab))        
		)

		browser.tabs.onActivated.addListener(activeInfo => {
			if (alertTabId !== null && alertTabId !== activeInfo.tabId) {
				browser.windows.update(activeInfo.windowId, {focused: true})//test
				browser.tabs.update(alertTabId, {active: true})
			}
		});

		console.log("init", this)
		browser.windows.onFocusChanged.addListener(app.update)
		browser.tabs.onCreated.addListener(app.update)
		browser.tabs.onRemoved.addListener(app.update)
		browser.tabs.onUpdated.addListener(app.update)
	},
	update: () => {
		updateTabCount();
		getOptions().then(options => {
			Promise.all([
				getPinnedTabsCount().then(count => {
					options.pinnedTabsCount = count;
				}),
				getGroupedTabsCount().then(count => {
					options.groupedTabsCount = count;
				})
			]).then(() => {
				browser.storage.sync.set({defaultOptions: options});
				updateBadge(options);
			});
		});
	}
};

app.init();
app.update();

function capitalizeFirstLetter(string) {
	return string[0].toUpperCase() + string.slice(1);
}
