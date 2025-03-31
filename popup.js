document.addEventListener('DOMContentLoaded', function() {
    const toggleCheckbox = document.getElementById('highlightToggle');

    // Get the current tab to check its highlighting state
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        
        // Send message to content script to get current state
        chrome.tabs.sendMessage(currentTab.id, {action: 'getState'}, function(response) {
            if (response && response.isHighlighting) {
                toggleCheckbox.checked = true;
            }
        });
    });

    // Add click handler for the toggle
    toggleCheckbox.addEventListener('change', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            chrome.tabs.sendMessage(currentTab.id, {
                action: 'toggleHighlight',
                forceState: toggleCheckbox.checked
            });
        });
    });
}); 