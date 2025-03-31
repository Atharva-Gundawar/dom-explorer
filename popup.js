// Debug function
function debug(message) {
    console.log(`[DOM Highlighter Popup] ${message}`);
}

debug('Popup script loaded');

document.addEventListener('DOMContentLoaded', function() {
    const toggleCheckbox = document.getElementById('highlightToggle');
    const statusText = document.createElement('div');
    statusText.style.marginTop = '10px';
    statusText.style.fontSize = '12px';
    statusText.style.color = '#666';
    document.body.appendChild(statusText);
    
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download Website Tree';
    downloadBtn.style.marginTop = '10px';
    downloadBtn.style.padding = '5px 10px';
    downloadBtn.style.width = '100%';
    downloadBtn.style.backgroundColor = '#4285f4';
    downloadBtn.style.color = 'white';
    downloadBtn.style.border = 'none';
    downloadBtn.style.borderRadius = '4px';
    downloadBtn.style.cursor = 'pointer';
    document.body.appendChild(downloadBtn);
    
    function updateStatus(message) {
        statusText.textContent = message;
    }
    
    // Get the current tab
    function getCurrentTab(callback) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs && tabs.length > 0) {
                callback(tabs[0]);
            } else {
                updateStatus('No active tab found');
                debug('No active tab found');
            }
        });
    }
    
    // Send message to content script with retry
    function sendMessageToContentScript(message, callback, attempts = 0) {
        getCurrentTab(function(tab) {
            debug(`Sending message to tab ${tab.id}: ${JSON.stringify(message)}`);
            
            chrome.tabs.sendMessage(tab.id, message, function(response) {
                if (chrome.runtime.lastError) {
                    debug(`Error: ${chrome.runtime.lastError.message}`);
                    updateStatus(`Error: ${chrome.runtime.lastError.message}`);
                    
                    // Retry up to 3 times
                    if (attempts < 3) {
                        debug(`Retrying... (${attempts + 1}/3)`);
                        setTimeout(() => {
                            sendMessageToContentScript(message, callback, attempts + 1);
                        }, 500);
                    } else if (message.action === 'toggleHighlight') {
                        // Try to inject content script as a last resort
                        debug('Trying to inject content script');
                        updateStatus('Trying to inject content script...');
                        
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['content.js']
                        }).then(() => {
                            debug('Content script injected, retrying in 500ms');
                            setTimeout(() => {
                                sendMessageToContentScript(message, callback, 0);
                            }, 500);
                        }).catch(err => {
                            debug(`Failed to inject: ${err}`);
                            updateStatus('Failed to inject content script');
                        });
                    }
                } else if (response) {
                    debug(`Response: ${JSON.stringify(response)}`);
                    if (callback) callback(response);
                }
            });
        });
    }

    // Initialize the popup
    function initPopup() {
        debug('Initializing popup');
        updateStatus('Checking highlighting state...');
        
        // Check if highlighting is active
        sendMessageToContentScript({action: 'getState'}, function(response) {
            if (response && response.isHighlighting !== undefined) {
                toggleCheckbox.checked = response.isHighlighting;
                updateStatus(response.isHighlighting ? 'Highlighting active' : 'Highlighting inactive');
            } else {
                updateStatus('Ready');
            }
        });
    }
    
    // Add click handler for the toggle
    toggleCheckbox.addEventListener('change', function() {
        updateStatus(toggleCheckbox.checked ? 'Activating...' : 'Deactivating...');
        
        sendMessageToContentScript({
            action: 'toggleHighlight',
            forceState: toggleCheckbox.checked
        }, function(response) {
            if (response && response.isHighlighting !== undefined) {
                toggleCheckbox.checked = response.isHighlighting;
                updateStatus(response.isHighlighting ? 'Highlighting active' : 'Highlighting inactive');
            }
        });
    });
    
    // Add download website tree handler
    downloadBtn.addEventListener('click', function() {
        updateStatus('Generating website tree...');
        sendMessageToContentScript({action: 'downloadDomTree'}, function(response) {
            if (response && response.success) {
                updateStatus('Website tree downloaded');
            } else {
                updateStatus(response && response.error ? response.error : 'Failed to generate tree');
            }
        });
    });
    
    // Initialize
    initPopup();
}); 