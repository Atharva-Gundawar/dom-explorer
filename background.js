// Debug function
function debug(message) {
    console.log(`[DOM Highlighter Background] ${message}`);
}

debug('Background script loaded');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debug(`Received message: ${JSON.stringify(request)}`);
    
    if (request.action === 'contentScriptReady') {
        debug(`Content script ready in tab ${sender.tab.id}`);
        sendResponse({status: 'acknowledged'});
    }
    
    return true;
});

// Listen for tab updates to ensure content script is injected
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        debug(`Tab ${tabId} updated, checking content script`);
        
        // Try sending a test message to see if content script is loaded
        chrome.tabs.sendMessage(tabId, {action: 'ping'}, response => {
            const injected = chrome.runtime.lastError ? false : true;
            debug(`Content script in tab ${tabId} is ${injected ? 'loaded' : 'not loaded'}`);
            
            if (!injected) {
                debug(`Injecting content script into tab ${tabId}`);
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                }).catch(err => {
                    debug(`Error injecting script: ${err}`);
                });
            }
        });
    }
}); 