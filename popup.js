// Debug function
function debug(message) {
    console.log(`[DOM Highlighter Popup] ${message}`);
}

debug('Popup script loaded');

document.addEventListener('DOMContentLoaded', function() {
    const toggleCheckbox = document.getElementById('highlightToggle');
    const downloadBtn = document.getElementById('downloadBtn');
    const elementIdInput = document.getElementById('elementId');
    const highlightElementBtn = document.getElementById('highlightElementBtn');
    const statusText = document.getElementById('statusText');
    
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
        updateStatus('Ready');
        
        // Check if highlighting is active
        sendMessageToContentScript({action: 'getState'}, function(response) {
            if (response && response.isHighlighting !== undefined) {
                toggleCheckbox.checked = response.isHighlighting;
                updateStatus(response.isHighlighting ? 'Highlighting active' : 'Ready');
            }
        });
    }
    
    // Add click handler for the toggle
    toggleCheckbox.addEventListener('change', function() {
        updateStatus(toggleCheckbox.checked ? 'Activating...' : 'Deactivating...');
        
        // Disable the element ID input when highlighting all elements
        if (toggleCheckbox.checked) {
            elementIdInput.value = '';
        }
        
        sendMessageToContentScript({
            action: 'toggleHighlight',
            forceState: toggleCheckbox.checked
        }, function(response) {
            if (response && response.isHighlighting !== undefined) {
                toggleCheckbox.checked = response.isHighlighting;
                updateStatus(response.isHighlighting ? 'Highlighting active' : 'Ready');
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
    
    // Add highlight specific element handler
    highlightElementBtn.addEventListener('click', function() {
        const elementId = elementIdInput.value.trim();
        if (!elementId) {
            updateStatus('Please enter an element ID');
            return;
        }
        
        // Uncheck the highlight all checkbox
        toggleCheckbox.checked = false;
        
        updateStatus(`Highlighting element: ${elementId}...`);
        sendMessageToContentScript({
            action: 'highlightElementById',
            elementId: elementId
        }, function(response) {
            if (response && response.success) {
                updateStatus(`Element highlighted: ${elementId}`);
            } else {
                updateStatus(response && response.error ? response.error : `Element not found: ${elementId}`);
            }
        });
    });
    
    // Also trigger highlight on Enter key in the input field
    elementIdInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            highlightElementBtn.click();
        }
    });
    
    // Initialize
    initPopup();
}); 