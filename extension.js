var successColor = '#5cb85c';
var warningColor = '#f0ad4e';
var errorColor = '#d9534f';
var okLimit = 1;
var warningLimit = 3;
var pollInterval = 1;   //in minutes
var usernameURL = 'https://api.github.com/user';
var searchReviewsURL = 'https://api.github.com/search/issues?q=type:pr is:open review-requested:';
var searchAssigneesURL = 'https://api.github.com/search/issues?q=type:pr is:open assignee:';

var assigneesURL = 'https://github.com/pulls/assigned';
var reviewsURL = 'https://github.com/pulls/review-requested';
var optionsURL = 'chrome://extensions/?options=' + chrome.runtime.id;

var tokenOk = true;
var reviewsCounter = 0;
var pullRequestUrls = [];

// open options page on a fresh installation
chrome.runtime.onInstalled.addListener(function (object) {
    if (chrome.runtime.OnInstalledReason.INSTALL === object.reason) {
        chrome.tabs.create({url: optionsURL});
    }
});

chrome.alarms.create('update-counter', {
    periodInMinutes: pollInterval
});
chrome.alarms.onAlarm.addListener((alarm) => {
    updateCounter();
});

init();

function openCurrentURL() {
    function hasAssignedPullRequests() {
        return pullRequestUrls.length !== reviewsCounter;
    }

    if (tokenOk) {
        if (pullRequestUrls.length === 1) {
            chrome.tabs.create({'url': pullRequestUrls[0]});
        }
        else {
            if (pullRequestUrls.length === 0 || hasAssignedPullRequests()) {
                chrome.tabs.create({'url': assigneesURL});
            }
            if (reviewsCounter > 0) {
                chrome.tabs.create({'url': reviewsURL});
            }
        }
    }
    else {
        chrome.tabs.create({'url': optionsURL});
    }
}

function init() {
    tokenOk = true;
    chrome.action.onClicked.removeListener(openCurrentURL);
    chrome.action.onClicked.addListener(openCurrentURL);
    updateCounter();
}


function getHtmlUrls(issues) {
    return issues.items.map(function(review) { return review.pull_request.html_url; });
}

function getUniquePullRequestUrls(reviewsResponse, assigneesResponse) {
    var reviewPullRequestUrls = getHtmlUrls(reviewsResponse);
    var assignedPullRequestUrls = getHtmlUrls(assigneesResponse);
    return reviewPullRequestUrls.concat(assignedPullRequestUrls).filter(function(v, i, a){ return a.indexOf(v) === i});
}

function chooseColor(counter) {
    var color = errorColor;
    if (counter < okLimit) {
        color = successColor;
    }
    else if (counter < warningLimit) {
        color = warningColor;
    }
    else {
        color = errorColor;
    }
    return color;
}

function elaborateResponse(reviewsResponse, assigneesResponse) {
    pullRequestUrls = getUniquePullRequestUrls(reviewsResponse, assigneesResponse);
    reviewsCounter = reviewsResponse.total_count;
    chrome.action.setBadgeText({text: '' + pullRequestUrls.length});
    var color = chooseColor(pullRequestUrls.length);
    chrome.action.setBadgeBackgroundColor({color: color});
}

async function executeRequest(url, token) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + btoa(':' + token),
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (response.status === 200) {
            const json = await response.json();
            return json;
        } else if (response.status === 401) {
            chrome.action.setBadgeText({text: 'X'});
            chrome.action.setBadgeBackgroundColor({color: errorColor});
            tokenOk = false;
            return null;
        } else {
            return null;
        }
    } catch (e) {
        chrome.action.setBadgeText({text: 'X'});
        chrome.action.setBadgeBackgroundColor({color: errorColor});
        tokenOk = false;
        return null;
    }
}

async function updateCounter() {
    let reviewsResponse;
    let assigneesResponse;
    let token;
    let username;

    chrome.storage.sync.get({
        token: null, username: null
    }, async function (items) {
        token = items.token;
        username = items.username;
        if (username === null) {
            const userResponse = await executeRequest(usernameURL, token);
            if (userResponse && userResponse.login) {
                username = userResponse.login;
                chrome.storage.sync.set({username: username});
            }
        }
        reviewsResponse = await executeRequest(searchReviewsURL + username, token);
        assigneesResponse = await executeRequest(searchAssigneesURL + username, token);
        if (reviewsResponse && assigneesResponse) {
            elaborateResponse(reviewsResponse, assigneesResponse);
        }
    });
}
