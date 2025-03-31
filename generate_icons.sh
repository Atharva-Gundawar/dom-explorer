#!/bin/bash

# Create icons directory if it doesn't exist
mkdir -p icons

# Generate icons using Chrome
google-chrome --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf=icons/icon16.png generate_icons.html
google-chrome --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf=icons/icon48.png generate_icons.html
google-chrome --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf=icons/icon128.png generate_icons.html

echo "Icons have been generated in the icons directory" 