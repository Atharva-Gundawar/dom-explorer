let isHighlighting = false;

// Function to get a random color
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Function to create a bounding box element
function createBoundingBox(element) {
    const rect = element.getBoundingClientRect();
    const box = document.createElement('div');
    box.style.position = 'fixed';
    box.style.left = `${rect.left + window.scrollX}px`;
    box.style.top = `${rect.top + window.scrollY}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.style.border = '2px solid ' + getRandomColor();
    box.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    box.style.pointerEvents = 'none';
    box.style.zIndex = '10000';
    box.className = 'dom-highlight-box';
    return box;
}

// Function to highlight all elements
function highlightElements() {
    const elements = document.getElementsByTagName('*');
    for (let element of elements) {
        // Skip the highlight boxes themselves
        if (element.className === 'dom-highlight-box') continue;
        
        // Skip elements with no dimensions
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        
        const box = createBoundingBox(element);
        document.body.appendChild(box);
    }
}

// Function to remove all highlights
function removeHighlights() {
    const boxes = document.getElementsByClassName('dom-highlight-box');
    while (boxes.length > 0) {
        boxes[0].remove();
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