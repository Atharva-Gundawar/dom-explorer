/**
 * DOM Element Highlighter - Popup Script
 * This script handles the popup UI and communication with the content script.
 */

// Debug mode - set to false for production
const DEBUG_MODE = true;

/**
 * Debug logging function
 */
function debug(message) {
    if (DEBUG_MODE) {
        console.log(`[DOM Highlighter Popup] ${message}`);
    }
}

debug('Popup script loaded');

document.addEventListener('DOMContentLoaded', function() {
    //=============================================
    // INITIALIZE UI ELEMENTS
    //=============================================
    const toggleCheckbox = document.getElementById('highlightToggle');
    const downloadBtn = document.getElementById('downloadBtn');
    const elementIdInput = document.getElementById('elementId');
    const highlightElementBtn = document.getElementById('highlightElementBtn');
    const statusText = document.getElementById('statusText');
    const maxElementsInput = document.getElementById('maxElements');
    const updateMaxElementsBtn = document.getElementById('updateMaxElementsBtn');
    
    /**
     * Updates the status message in the popup
     */
    function updateStatus(message) {
        statusText.textContent = message;
    }
    
    //=============================================
    // COMMUNICATION FUNCTIONS
    //=============================================
    
    /**
     * Gets the current active tab
     */
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
    
    /**
     * Sends a message to the content script with retry functionality
     */
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

    //=============================================
    // INITIALIZATION
    //=============================================
    
    /**
     * Initializes the popup UI and state
     */
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
    
    //=============================================
    // EVENT HANDLERS
    //=============================================
    
    /**
     * Handles toggling the highlight mode
     */
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
    
    /**
     * Handles downloading the website tree as JSON
     */
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
    
    /**
     * Handles highlighting a specific element by ID
     */
    highlightElementBtn.addEventListener('click', function() {
        const elementId = elementIdInput.value.trim();
        if (!elementId) {
            updateStatus('Please enter an element ID');
            return;
        }
        
        // First, ensure "Highlight All" is turned off
        sendMessageToContentScript({
            action: 'toggleHighlight',
            forceState: false
        }, function() {
            // Update the checkbox state
            toggleCheckbox.checked = false;
            
            // Now highlight the specific element
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
    });
    
    /**
     * Handle keyboard input for element ID field
     */
    elementIdInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            highlightElementBtn.click();
        }
    });
    
    /**
     * Handles updating the maximum number of elements to highlight
     */
    updateMaxElementsBtn.addEventListener('click', function() {
        const maxElements = parseInt(maxElementsInput.value);
        if (isNaN(maxElements) || maxElements < 1) {
            updateStatus('Please enter a valid number');
            return;
        }
        
        updateStatus('Updating maximum elements...');
        sendMessageToContentScript({
            action: 'updateMaxElements',
            maxElements: maxElements
        }, function(response) {
            if (response && response.success) {
                updateStatus(`Maximum elements updated to ${maxElements}`);
                // If highlighting is active, refresh it
                if (toggleCheckbox.checked) {
                    sendMessageToContentScript({
                        action: 'toggleHighlight',
                        forceState: true
                    });
                }
            } else {
                updateStatus('Failed to update maximum elements');
            }
        });
    });
    
    // Initialize the popup
    initPopup();
}); 