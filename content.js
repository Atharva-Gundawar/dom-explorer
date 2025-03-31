/**
 * DOM Element Highlighter - Content Script
 * This script handles all the DOM element highlighting and tree generation functionality.
 */

//=============================================
// VARIABLES
//=============================================
let isHighlighting = false;
let highlightContainer = null;
let elementColorMap = new Map(); // Store colors for element types
let debounceTimer = null;
let mutationDebounceTimer = null;
let domElementsMap = new Map(); // Map to store dom elements by unique ID

// Debug mode - set to false for production
const DEBUG_MODE = true;

//=============================================
// UTILITY FUNCTIONS
//=============================================

/**
 * Debug logging function - only logs if debug mode is enabled
 */
function debug(message) {
    if (DEBUG_MODE) {
        console.log(`[DOM Highlighter] ${message}`);
    }
}

// Log initial load
debug('Content script loaded');

/**
 * Generates a random color for element highlighting
 */
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 */
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

/**
 * Simple string hashing function
 */
function hashString(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

//=============================================
// ELEMENT IDENTIFICATION
//=============================================

/**
 * Gets the DOM path for an element for persistent identification
 */
function getDomPath(element) {
    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
        let selector = element.nodeName.toLowerCase();
        if (element.id) {
            selector += `#${element.id}`;
            path.unshift(selector);
            break;
        } else {
            let sibling = element;
            let siblingIndex = 1;
            while (sibling = sibling.previousElementSibling) {
                if (sibling.nodeName.toLowerCase() === selector) {
                    siblingIndex++;
                }
            }
            
            if (element.className) {
                selector += `.${Array.from(element.classList).join('.')}`;
            }
            
            selector += `:nth-child(${siblingIndex})`;
        }
        path.unshift(selector);
        element = element.parentNode;
    }
    return path.join(' > ');
}

/**
 * Generates a stable ID for DOM elements that persists across page reloads
 */
function generateStableId(element) {
    // Get basic element info
    const tagName = element.tagName.toLowerCase();
    const id = element.id || '';
    const classNames = Array.from(element.classList || []).join('.');
    const text = element.innerText ? element.innerText.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_') : '';
    
    // Get attributes based on element type
    let attributes = '';
    switch (tagName) {
        case 'a':
            attributes = element.href ? `_href_${element.href.replace(/[^a-zA-Z0-9]/g, '_').substr(-30)}` : '';
            break;
        case 'img':
            attributes = element.src ? `_src_${element.src.replace(/[^a-zA-Z0-9]/g, '_').substr(-30)}` : '';
            break;
        case 'input':
            attributes = element.name ? `_name_${element.name}` : '';
            attributes += element.placeholder ? `_placeholder_${element.placeholder.replace(/[^a-zA-Z0-9]/g, '_').substr(0, 20)}` : '';
            break;
    }
    
    // Use DOM path for more precise identification
    const domPath = getDomPath(element);
    const domPathHash = hashString(domPath);
    
    // Combine all information into a stable ID
    return `${tagName}${id ? '_id_' + id : ''}${classNames ? '_class_' + classNames : ''}${text ? '_text_' + text : ''}${attributes}_path_${domPathHash}`;
}

/**
 * Finds an element by its stable ID even after page reload
 */
function findElementByStableId(stableId) {
    debug(`Looking for element with stable ID: ${stableId}`);
    
    // Extract tag name from the stable ID
    const tagMatch = stableId.match(/^([a-z0-9]+)/);
    if (!tagMatch) return null;
    
    const tagName = tagMatch[1];
    
    // Check if we have an ID in the stable ID
    const idMatch = stableId.match(/_id_([^_]+)/);
    if (idMatch) {
        const elementId = idMatch[1];
        const element = document.getElementById(elementId);
        if (element && element.tagName.toLowerCase() === tagName) {
            debug(`Found element by ID: ${elementId}`);
            return element;
        }
    }
    
    // Extract path hash from stable ID
    const pathMatch = stableId.match(/_path_([^_]+)/);
    if (!pathMatch) return null;
    
    // Get all elements of the tag type and check each one
    const elements = document.getElementsByTagName(tagName);
    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const elementPath = getDomPath(element);
        const elementPathHash = hashString(elementPath);
        
        if (pathMatch[1] === elementPathHash) {
            debug(`Found element by path hash: ${elementPathHash}`);
            return element;
        }
    }
    
    // If still not found, try with more relaxed criteria
    debug(`Element not found by direct match, trying with more relaxed criteria`);
    
    // Extract class from stable ID
    const classMatch = stableId.match(/_class_([^_]+)/);
    const textMatch = stableId.match(/_text_([^_]+)/);
    
    if (classMatch || textMatch) {
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            
            // Check class match
            if (classMatch) {
                const classNames = classMatch[1];
                const elementClasses = Array.from(element.classList || []).join('.');
                if (elementClasses !== classNames) continue;
            }
            
            // Check text content match
            if (textMatch) {
                const textContent = textMatch[1];
                const elementText = element.innerText ? element.innerText.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_') : '';
                if (elementText !== textContent) continue;
            }
            
            // If we get here, we have a potential match
            debug(`Found element by partial match (class/text)`);
            return element;
        }
    }
    
    debug(`Element not found: ${stableId}`);
    return null;
}

/**
 * Gets element signature for consistent coloring
 */
function getElementSignature(element) {
    try {
        const classes = Array.from(element.classList || []).sort().join('.');
        return `${element.tagName.toLowerCase()}${classes ? '.' + classes : ''}`;
    } catch (e) {
        debug('Error getting element signature: ' + e.message);
        return element.tagName.toLowerCase();
    }
}

/**
 * Gets or creates a color for an element type
 */
function getColorForElement(element) {
    const signature = getElementSignature(element);
    if (!elementColorMap.has(signature)) {
        elementColorMap.set(signature, getRandomColor());
    }
    return elementColorMap.get(signature);
}

//=============================================
// HIGHLIGHTING FUNCTIONS
//=============================================

/**
 * Creates a container for all highlight elements
 */
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

/**
 * Creates a bounding box element for highlighting
 */
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

/**
 * Update highlight positions on scroll/resize (debounced)
 */
const updateHighlightPositions = debounce(() => {
    if (!highlightContainer) return;
    
    removeHighlights();
    highlightElements();
}, 100);

/**
 * Highlights a specific element by ID
 */
function highlightElementById(stableId) {
    debug(`Highlighting element with ID: ${stableId}`);
    
    // Safety check for document.body
    if (!document.body) {
        debug('Document body not available');
        return false;
    }
    
    // Clear existing highlights
    removeHighlights();
    
    // Try to find the element
    const element = findElementByStableId(stableId);
    if (!element) {
        debug(`Element with ID ${stableId} not found`);
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
            
            // Set highlighting state to false (since we're in single-element mode)
            isHighlighting = false;
            
            return true;
        }
    } catch (e) {
        debug(`Error highlighting element: ${e.message}`);
    }
    
    return false;
}

/**
 * Highlights all visible elements
 */
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
        // Select the most common important elements
        const mainElements = document.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6, a, button, img, input, form, section, article, nav, aside');
        debug(`Found ${mainElements.length} elements to highlight`);
        
        // Process only the first 100 elements for now to prevent performance issues
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

/**
 * Removes all highlights
 */
function removeHighlights() {
    debug('Removing highlights');
    
    // Remove the container and all highlights
    if (highlightContainer) {
        highlightContainer.remove();
        highlightContainer = null;
    }
}

/**
 * Toggles element highlighting
 */
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

//=============================================
// DOM TREE GENERATION
//=============================================

/**
 * Extracts important information from a DOM element
 */
function extractElementInfo(element) {
    // Generate a stable ID for this element
    const stableId = generateStableId(element);
    
    // Store a reference to the element for later highlighting (useful during the same session)
    domElementsMap.set(stableId, element);
    
    const info = {
        uniqueId: stableId,
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        classes: Array.from(element.classList || []),
        path: getDomPath(element)
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

/**
 * Generates a tree structure of the DOM
 */
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

/**
 * Downloads the DOM tree as a JSON file
 */
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

//=============================================
// EVENT HANDLERS
//=============================================

/**
 * Message handler for communication with popup
 */
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

/**
 * Debounced mutation handler for DOM changes
 */
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

// Listen for popstate events for SPA navigation
window.addEventListener('popstate', () => {
    if (isHighlighting) {
        setTimeout(() => {
            removeHighlights();
            highlightElements();
        }, 100);
    }
});

//=============================================
// INITIALIZATION
//=============================================

/**
 * Makes sure we have the document body before setting up
 */
function initializeWhenReady() {
    debug('Initializing when ready');
    if (document.body) {
        debug('Document body is ready');
        
        // Setup mutation observer with optimized parameters
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });
        
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