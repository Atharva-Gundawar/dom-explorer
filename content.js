let isHighlighting = false;
let highlightContainer = null;
let elementColorMap = new Map(); // Store colors for element types
let debounceTimer = null;
let mutationDebounceTimer = null;

// Debug function
function debug(message) {
    console.log(`[DOM Highlighter] ${message}`);
}

// Log initial load
debug('Content script loaded');

// Function to get a random color
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Function to get element signature (for consistent coloring)
function getElementSignature(element) {
    try {
        const classes = Array.from(element.classList || []).sort().join('.');
        return `${element.tagName.toLowerCase()}${classes ? '.' + classes : ''}`;
    } catch (e) {
        debug('Error getting element signature: ' + e.message);
        return element.tagName.toLowerCase();
    }
}

// Function to get or create color for element type
function getColorForElement(element) {
    const signature = getElementSignature(element);
    if (!elementColorMap.has(signature)) {
        elementColorMap.set(signature, getRandomColor());
    }
    return elementColorMap.get(signature);
}

// Function to create a container for highlights
function createHighlightContainer() {
    debug('Creating highlight container');
    try {
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '10000';
        container.id = 'dom-highlight-container';
        document.body.appendChild(container);
        return container;
    } catch (e) {
        debug('Error creating container: ' + e.message);
        return null;
    }
}

// Function to create a bounding box element
function createBoundingBox(element) {
    try {
        const rect = element.getBoundingClientRect();
        
        // Skip elements outside viewport or too small
        if (rect.bottom < 0 || rect.right < 0 || 
            rect.top > window.innerHeight || rect.left > window.innerWidth ||
            rect.width < 10 || rect.height < 10) {
            return null;
        }
        
        const box = document.createElement('div');
        box.style.position = 'absolute';
        box.style.left = `${rect.left + window.scrollX}px`;
        box.style.top = `${rect.top + window.scrollY}px`;
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
        box.style.border = '2px solid ' + getColorForElement(element);
        box.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
        box.style.pointerEvents = 'none';
        box.className = 'dom-highlight-box';
        return box;
    } catch (e) {
        debug('Error creating bounding box: ' + e.message);
        return null;
    }
}

// Debounce function to limit how often a function is called
function debounce(func, delay) {
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            func.apply(context, args);
        }, delay);
    };
}

// Function to update highlight positions (debounced)
const updateHighlightPositions = debounce(() => {
    if (!highlightContainer) return;
    
    removeHighlights();
    highlightElements();
}, 100);

// Function to highlight visible elements
function highlightElements() {
    debug('Highlighting elements');
    
    // Safety check for document.body
    if (!document.body) {
        debug('Document body not available');
        return;
    }
    
    // Clear existing highlights
    removeHighlights();
    
    // Create container
    highlightContainer = createHighlightContainer();
    if (!highlightContainer) {
        debug('Failed to create container');
        return;
    }

    // For testing, try a simple highlight first
    simpleHighlight();

    // Get elements - start with a smaller set
    try {
        const mainElements = document.querySelectorAll('div, p, h1, h2, h3, a, button');
        debug(`Found ${mainElements.length} elements to highlight`);
        
        // Process only the first 100 elements for now
        const elements = Array.from(mainElements).slice(0, 100);
        
        // Process elements immediately
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            // Skip our own elements
            if (element.className === 'dom-highlight-box' || element.id === 'dom-highlight-container' || element.id === 'test-highlight-box') continue;
            
            const box = createBoundingBox(element);
            if (box && highlightContainer) {
                highlightContainer.appendChild(box);
            }
        }
        
        debug('Finished highlighting elements');
    } catch (e) {
        debug('Error highlighting elements: ' + e.message);
    }
}

// Function to remove all highlights
function removeHighlights() {
    debug('Removing highlights');
    
    // Remove test highlight if it exists
    const testBox = document.getElementById('test-highlight-box');
    if (testBox) {
        testBox.remove();
    }
    
    // Remove the container and all highlights
    if (highlightContainer) {
        highlightContainer.remove();
        highlightContainer = null;
    }
}

// Function to toggle highlighting
function toggleHighlight(forceState = null) {
    debug(`Toggle highlight called with forceState: ${forceState}`);
    
    if (forceState !== null) {
        isHighlighting = forceState;
    } else {
        isHighlighting = !isHighlighting;
    }
    
    debug(`Highlighting is now: ${isHighlighting}`);

    if (isHighlighting) {
        highlightElements();
    } else {
        removeHighlights();
    }
    
    return isHighlighting;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debug(`Received message: ${JSON.stringify(request)}`);
    
    try {
        switch (request.action) {
            case 'toggleHighlight':
                const state = toggleHighlight(request.forceState);
                sendResponse({isHighlighting: state});
                break;
            case 'getState':
                sendResponse({isHighlighting});
                break;
            case 'testHighlight':
                simpleHighlight();
                sendResponse({success: true});
                break;
        }
    } catch (e) {
        debug('Error handling message: ' + e.message);
        sendResponse({error: e.message});
    }
    
    return true;
});

// Debounced mutation handler
const handleMutation = debounce(() => {
    if (isHighlighting) {
        removeHighlights();
        highlightElements();
    }
}, 500);

// Re-apply highlighting when the page content changes
const observer = new MutationObserver(() => {
    handleMutation();
});

// Start observing the document with optimized parameters
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
});

// Re-apply highlighting when navigation occurs within SPA
window.addEventListener('popstate', () => {
    if (isHighlighting) {
        setTimeout(() => {
            removeHighlights();
            highlightElements();
        }, 100);
    }
});

// Make sure we have the document body before setting up
function initializeWhenReady() {
    debug('Initializing when ready');
    if (document.body) {
        debug('Document body is ready');
        // Test if we can create elements
        try {
            const testDiv = document.createElement('div');
            testDiv.id = 'test-dom-highlighter';
            testDiv.style.display = 'none';
            document.body.appendChild(testDiv);
            testDiv.remove();
            debug('Test element creation successful');
        } catch (e) {
            debug('Error creating test element: ' + e.message);
        }
    } else {
        debug('Document body not ready, waiting...');
        setTimeout(initializeWhenReady, 100);
    }
}

// Initialize when page is loaded
if (document.readyState === 'loading') {
    debug('Document is loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', initializeWhenReady);
} else {
    debug('Document already loaded, initializing');
    initializeWhenReady();
}

// Let the popup know we're ready
chrome.runtime.sendMessage({action: 'contentScriptReady'}, response => {
    if (response) {
        debug('Background received ready message: ' + JSON.stringify(response));
    }
});

// Simple highlight function (for testing)
function simpleHighlight() {
    debug('Running simple highlight test');
    try {
        // Create a simple red border around the body
        const testBox = document.createElement('div');
        testBox.style.position = 'fixed';
        testBox.style.top = '10px';
        testBox.style.left = '10px';
        testBox.style.width = '100px';
        testBox.style.height = '100px';
        testBox.style.border = '5px solid red';
        testBox.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
        testBox.style.zIndex = '10001';
        testBox.id = 'test-highlight-box';
        document.body.appendChild(testBox);
        debug('Test highlight created');
    } catch (e) {
        debug('Error in simple highlight: ' + e.message);
    }
} 