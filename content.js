let isHighlighting = false;
let highlightContainer = null;
let elementColorMap = new Map(); // Store colors for element types
let debounceTimer = null;
let mutationDebounceTimer = null;

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
    box.dataset.elementSignature = getElementSignature(element);
    return box;
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
    // Clear the color map for new page
    elementColorMap.clear();
    
    // Create container if it doesn't exist
    if (!highlightContainer) {
        highlightContainer = createHighlightContainer();
    } else {
        // Clear existing highlights but keep the container
        while (highlightContainer.firstChild) {
            highlightContainer.removeChild(highlightContainer.firstChild);
        }
    }

    // Get only the main visible elements - limit to 500 max
    const allElements = document.querySelectorAll('div, section, article, header, footer, nav, main, aside, button, a, form, input, img, h1, h2, h3');
    const elementsArray = Array.from(allElements).slice(0, 500);

    // Process elements in batches
    processBatch(elementsArray, 0);

    // Add scroll event listener
    window.addEventListener('scroll', updateHighlightPositions);
    // Add resize event listener
    window.addEventListener('resize', updateHighlightPositions);
}

// Process elements in batches to avoid UI freezing
function processBatch(elements, startIndex, batchSize = 50) {
    if (!highlightContainer || !isHighlighting) return;
    
    const endIndex = Math.min(startIndex + batchSize, elements.length);
    
    for (let i = startIndex; i < endIndex; i++) {
        const element = elements[i];
        
        // Skip the highlight boxes and container
        if (element.className === 'dom-highlight-box' || element.id === 'dom-highlight-container') continue;
        
        const box = createBoundingBox(element);
        if (box) {
            highlightContainer.appendChild(box);
        }
    }
    
    // Process next batch if there are more elements
    if (endIndex < elements.length) {
        setTimeout(() => {
            processBatch(elements, endIndex, batchSize);
        }, 0);
    }
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