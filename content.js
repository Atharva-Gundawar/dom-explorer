let isHighlighting = false;
let highlightContainer = null;
let elementColorMap = new Map(); // Store colors for element types
let debounceTimer = null;
let mutationDebounceTimer = null;
let domElementsMap = new Map(); // Map to store dom elements by unique ID

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

// Function to generate a unique ID for DOM elements
function generateUniqueId() {
    return 'dom_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
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

// Function to highlight a specific element by ID
function highlightElementById(uniqueId) {
    debug(`Highlighting element with ID: ${uniqueId}`);
    
    // Safety check for document.body
    if (!document.body) {
        debug('Document body not available');
        return false;
    }
    
    // Clear existing highlights
    removeHighlights();
    
    // Try to find the element
    const element = domElementsMap.get(uniqueId);
    if (!element) {
        debug(`Element with ID ${uniqueId} not found`);
        return false;
    }
    
    // Create container
    highlightContainer = createHighlightContainer();
    if (!highlightContainer) {
        debug('Failed to create container');
        return false;
    }
    
    // Highlight the element
    try {
        const box = createBoundingBox(element);
        if (box && highlightContainer) {
            // Use a distinctive color for the single highlighted element
            box.style.border = '3px solid red';
            box.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
            highlightContainer.appendChild(box);
            
            // Scroll the element into view
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
            
            return true;
        }
    } catch (e) {
        debug(`Error highlighting element: ${e.message}`);
    }
    
    return false;
}

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
            if (element.className === 'dom-highlight-box' || element.id === 'dom-highlight-container') continue;
            
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

// Function to extract important information from an element
function extractElementInfo(element) {
    // Generate a unique ID for this element
    const uniqueId = generateUniqueId();
    
    // Store a reference to the element for later highlighting
    domElementsMap.set(uniqueId, element);
    
    const info = {
        uniqueId: uniqueId,
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        classes: Array.from(element.classList || []),
    };
    
    // Get element type-specific attributes
    switch (info.tag) {
        case 'a':
            info.href = element.href || null;
            info.text = element.innerText.trim() || null;
            break;
        case 'img':
            info.src = element.src || null;
            info.alt = element.alt || null;
            info.width = element.width || null;
            info.height = element.height || null;
            break;
        case 'button':
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
        case 'p':
        case 'span':
        case 'div':
        case 'li':
            info.text = element.innerText.trim() || null;
            break;
        case 'input':
            info.type = element.type || null;
            info.placeholder = element.placeholder || null;
            info.value = element.value || null;
            break;
        case 'form':
            info.action = element.action || null;
            info.method = element.method || null;
            break;
    }
    
    // Get computed style information for layout
    try {
        const style = window.getComputedStyle(element);
        info.style = {
            display: style.display,
            position: style.position,
            width: style.width,
            height: style.height,
            color: style.color,
            backgroundColor: style.backgroundColor
        };
    } catch (e) {
        debug(`Error getting computed style: ${e.message}`);
    }
    
    // Get bounding box
    try {
        const rect = element.getBoundingClientRect();
        info.rect = {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height
        };
    } catch (e) {
        debug(`Error getting bounding rect: ${e.message}`);
    }
    
    return info;
}

// Function to generate a tree structure of the DOM
function generateDomTree(rootElement = document.body, maxDepth = 10, currentDepth = 0) {
    if (!rootElement || currentDepth > maxDepth) {
        return null;
    }
    
    const nodeInfo = extractElementInfo(rootElement);
    nodeInfo.children = [];
    
    // Skip certain elements that don't add much value
    if (rootElement.tagName.toLowerCase() === 'script' || 
        rootElement.tagName.toLowerCase() === 'style' || 
        rootElement.tagName.toLowerCase() === 'meta' ||
        rootElement.id === 'dom-highlight-container') {
        return null;
    }
    
    // Process children
    for (let i = 0; i < rootElement.children.length; i++) {
        const childElement = rootElement.children[i];
        const childInfo = generateDomTree(childElement, maxDepth, currentDepth + 1);
        if (childInfo) {
            nodeInfo.children.push(childInfo);
        }
    }
    
    return nodeInfo;
}

// Function to download the DOM tree as a JSON file
function downloadDomTree() {
    debug('Generating DOM tree');
    
    try {
        // Clear the previous map
        domElementsMap.clear();
        
        // Generate the DOM tree with a reasonable depth limit
        const tree = {
            title: document.title,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            tree: generateDomTree(document.body, 5)
        };
        
        // Convert to JSON
        const jsonString = JSON.stringify(tree, null, 2);
        
        // Create a Blob and download link
        const blob = new Blob([jsonString], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        // Create a link and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `website-tree-${window.location.hostname}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        debug('DOM tree download initiated');
        return true;
    } catch (e) {
        debug(`Error generating DOM tree: ${e.message}`);
        return false;
    }
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
            case 'downloadDomTree':
                const success = downloadDomTree();
                sendResponse({success});
                break;
            case 'highlightElementById':
                const highlighted = highlightElementById(request.elementId);
                sendResponse({success: highlighted});
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