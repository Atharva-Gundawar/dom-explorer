let isHighlighting = false;
let highlightContainer = null;
let elementColorMap = new Map(); // Store colors for element types

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
    const classes = Array.from(element.classList).sort().join('.');
    return `${element.tagName.toLowerCase()}${classes ? '.' + classes : ''}`;
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
}

// Function to create a bounding box element
function createBoundingBox(element) {
    const rect = element.getBoundingClientRect();
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
    box.dataset.elementSignature = getElementSignature(element);
    return box;
}

// Function to update highlight positions
function updateHighlightPositions() {
    const boxes = document.getElementsByClassName('dom-highlight-box');
    const elements = document.getElementsByTagName('*');
    
    for (let i = 0; i < boxes.length; i++) {
        const element = elements[i];
        if (element && element.className !== 'dom-highlight-box' && !element.id.includes('dom-highlight')) {
            const rect = element.getBoundingClientRect();
            boxes[i].style.left = `${rect.left + window.scrollX}px`;
            boxes[i].style.top = `${rect.top + window.scrollY}px`;
            boxes[i].style.width = `${rect.width}px`;
            boxes[i].style.height = `${rect.height}px`;
        }
    }
}

// Function to highlight all elements
function highlightElements() {
    // Clear the color map for new page
    elementColorMap.clear();
    
    // Create container if it doesn't exist
    if (!highlightContainer) {
        highlightContainer = createHighlightContainer();
    }

    const elements = document.getElementsByTagName('*');
    for (let element of elements) {
        // Skip the highlight boxes and container
        if (element.className === 'dom-highlight-box' || element.id === 'dom-highlight-container') continue;
        
        // Skip elements with no dimensions
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        
        const box = createBoundingBox(element);
        highlightContainer.appendChild(box);
    }

    // Add scroll event listener
    window.addEventListener('scroll', updateHighlightPositions);
    // Add resize event listener
    window.addEventListener('resize', updateHighlightPositions);
}

// Function to remove all highlights
function removeHighlights() {
    // Remove scroll and resize listeners
    window.removeEventListener('scroll', updateHighlightPositions);
    window.removeEventListener('resize', updateHighlightPositions);
    
    // Remove the container and all highlights
    if (highlightContainer) {
        highlightContainer.remove();
        highlightContainer = null;
    }
}

// Function to toggle highlighting
function toggleHighlight(forceState = null) {
    if (forceState !== null) {
        isHighlighting = forceState;
    } else {
        isHighlighting = !isHighlighting;
    }

    if (isHighlighting) {
        highlightElements();
    } else {
        removeHighlights();
    }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'toggleHighlight':
            toggleHighlight(request.forceState);
            sendResponse({isHighlighting});
            break;
        case 'getState':
            sendResponse({isHighlighting});
            break;
    }
    return true;
});

// Re-apply highlighting when the page content changes
const observer = new MutationObserver(() => {
    if (isHighlighting) {
        removeHighlights();
        highlightElements();
    }
});

// Start observing the document with the configured parameters
observer.observe(document.body, {
    childList: true,
    subtree: true
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

// Handle initial page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (isHighlighting) {
            highlightElements();
        }
    });
} else {
    if (isHighlighting) {
        highlightElements();
    }
} 