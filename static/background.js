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
		// Check if countGroupsSwitch is enabled
		if (options.countGroupsSwitch) {
			const remainingGroups = await groupsRemaining(options)
			let text2 = remainingGroups.toString()
			browser.action.setBadgeText({
				text: text1 + '|' + text2
			})
		} else {
			// If countGroupsSwitch is disabled, display only text1
			browser.action.setBadgeText({
				text: text1 
			})
		}
		browser.action.setBadgeBackgroundColor({
			color: "#7e7e7e"
		})
    })
}

const getOptions = () => new Promise((res, rej) => {
	browser.storage.sync.get("defaultOptions", (defaults) => {
		browser.storage.sync.get(defaults.defaultOptions, (options) => {
			res(options);
		})
	})
})

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


async function detectTooManyGroups(options) {
    // get options
    const options2 = await getOptions();
    if(!options2.countGroupsSwitch) { return new Promise(() => {});  }

    const count = await getGroupsCount();
    if (count > options.maxGroups) {
        return 'groups';
    }
    return new Promise(() => {});  
}


// let isDragging = false;
// let ForcedAlertTabId = null;
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
			// ForcedAlertTabId = tabs[0].id;  
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

const getGroupsCount = () => new Promise(res => {
    browser.tabGroups.query({}, function(groups) {
        res(groups.length); 
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
    if (options.exceedTabNewWindow && place === "window") { ////The pit left by Fernando, the place context has not been written yet, the business logic should be larger than a single page and smaller than multiple pages.
		browser.windows.create({ tabId: tab.id, focused: true }).catch(console.error);
    } else {
		const removeTab = () => {
            browser.tabs.remove(tab.id).then(() => {
			// ForcedAlertTabId = null;
            }).catch((error) => {
                if (error.message === "Tabs cannot be edited right now (user may be dragging a tab).") {  // maybe different in Chrome or Firefox
                    // If the tab is being dragged, try deleting it again after a 100 millisecond delay.
                    setTimeout(removeTab, 100);
                } else {
                    console.error(error);
                }
            });
        };
        removeTab();
    }
}

const handleTabCreated = tab => async options => {
    // collapseGroup is called here
    await app.collapseGroup(tab);
	return Promise.race([
		detectTooManyTabsInWindow(options),
		detectTooManyTabsInTotal(options),
		detectTooManyGroups(options)  
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
				maxTotal: 99,
				maxWindow: 99,
				exceedTabNewWindow: false,
				displayAlert: true,
				countPinnedTabs: false, // added
				countGroupedTabs: false, // added
				maxGroups: 35, // added
				countGroupsSwitch: true, // added
				expand1GroupOnly: true, // added
				displayBadge: true,
				alertMessage: browser.i18n.getMessage("string_7")
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

		browser.tabs.onActivated.addListener(app.collapseGroup)
		browser.tabs.onUpdated.addListener(app.collapseGroup) // moved to  const handleTabCreated = tab => async options => { await app.collapseGroup(tab);
		// browser.tabs.onCreated.addListener(app.collapseGroup)

		// browser.tabGroups.onCreated.addListener()
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
				}),
				getGroupsCount().then(count => {
					options.groupsCount = count;
				})
			]).then(() => {
				return browser.storage.sync.set({defaultOptions: options});
			}).then(() => {
				updateBadge(options);
			}).catch(error => {
				console.error('could be improved in future:', error);
			});
		});
	},

	collapseGroup: async function (activeInfo) {
		// get options
		const options = await getOptions();
		if(!options.expand1GroupOnly) { return; }
	
		if (typeof activeInfo.tabId !== 'number') {
			console.error(' activeInfo has been remove => Tab ID must be a number');
			return;
		}
		try {
			const tab = await browser.tabs.get(activeInfo.tabId);
			if (tab.active && tab.groupId !== -1) {
				const tabs = await browser.tabs.query({});
				let activeGroupId = tab.groupId;
				let otherGroupTabs = tabs.filter(t => t.groupId !== -1 && t.groupId !== activeGroupId);
				let otherGroupIds = [...new Set(otherGroupTabs.map(t => t.groupId))];
				otherGroupIds.forEach(groupId => {
					browser.tabGroups.update(groupId, { collapsed: true });
				});
			}
		} catch (error) {
			console.error('could be improved in future:', error);
		}
	}
};

app.init();
app.update();

function capitalizeFirstLetter(string) {
	return string[0].toUpperCase() + string.slice(1);
}
