/*
 * Copyright (c) ASNA, Inc. and its affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { DynamicList };

import { AsnaDataAttrName } from './asna-data-attr.js';
import { Fetch } from './ajax/ajax-fetch.js';
import { Base64 } from './base-64.js';

const AJAX_RESPOSE_TIMEOUT = 1 * 60 * 1000; // 1 minutes
const DROPDOWN_BUTTON_SVG = `
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" 
        height="16" width="16" 
        viewBox="-128 -1536 1792 1792" 
        preserveAspectRatio="xMidYMid meet">
        <g transform="scale(1, -1)">
            <path style="fill: blue" 
                d="M1611 832q0 -53 -37 -90l-651 -651q-38 -38 -91 -38q-54 0 -90 38l-651 651q-38 36 -38 90q0 53 38 91l74 75q39 37 91 37q53 0 90 -37l486 -486l486 486q37 37 90 37q52 0 91 -37l75 -75q37 -39 37 -91z">
            </path>
        </g>
    </svg>`;

class DynamicList {
    constructor() {
        this.specKey = '';
        this.csvControlIDs = '';
        this.listID = ''; // Added to store the list ID for AJAX requests
        this.dropdownList = null; // Reference to the select element
        this.targetField = null; // Target field to sync with
        this.dropdownButton = null; // Reference to the dropdown button

        // Bind all handlers to this instance
        this.handleClickEvent = this.handleClickEvent.bind(this);
        this.handleKeyDownEvent = this.handleKeyDownEvent.bind(this);
        this.handleDropdownChangeEvent = this.handleDropdownChangeEvent.bind(this);
        this.handleOutsideClickEvent = this.handleOutsideClickEvent.bind(this);
        this.handleAjaxResponseEvent = this.handleAjaxResponseEvent.bind(this);
    }

    static init(form) {
        const elements = form.querySelectorAll(`input[${AsnaDataAttrName.DYNAMIC_LIST_OPTIONS}]`);

        for (let i = 0, l = elements.length; i < l; i++) {
            const input = elements[i];

            const encOptions = input.getAttribute(AsnaDataAttrName.DYNAMIC_LIST_OPTIONS);
            let options = {}
            try {
                options = JSON.parse(Base64.decode(encOptions));
            }
            catch (ex) {
                console.error('Error decoding dynamic list options:', ex);
            }
            DynamicList.replaceInputWithComboDropdownList(input, options);
        }
    }

    static replaceInputWithComboDropdownList(input, options) {
        let mainPanel = document.querySelector('[role=main]');
        if (!mainPanel) { return; }

        let targetInput = mainPanel.querySelector(`[name="${options.targetField}"]`);
        if (!targetInput) {
            if (input.parentNode) {
                input.parentNode.removeChild(input); // Target field is required. If not present, then the dynamic-list should not be displayed.
            }
            return;
        }

        // Create a new DynamicList instance for this control
        const dynList = new DynamicList();
        dynList.specKey = options.specKey;
        dynList.csvControlIDs = options.arrayControlIDs; // Not used yet !!!
        dynList.listID = options.specKey; // Assuming specKey can be used as listID

        // Store target field if provided
        if (options.targetField) {
            dynList.targetField = targetInput;
        }

        // Create container div to hold the combo elements
        const comboContainer = document.createElement('div');
        comboContainer.className = 'dds-dynalist-combo-dropdown-container';

        // Copy all attributes from original input, except style
        for (let i = 0; i < input.attributes.length; i++) {
            const attr = input.attributes[i];
            if (attr.name !== AsnaDataAttrName.DYNAMIC_LIST_OPTIONS) {
                comboContainer.setAttribute(attr.name, attr.value);
            }
        }

        // Create drop-down button
        const dropdownButton = document.createElement('div');
        dropdownButton.className = 'dds-dynalist-combo-dropdown-button';
        dropdownButton.innerHTML = DROPDOWN_BUTTON_SVG;
        dropdownButton.style.cursor = 'pointer';
        dropdownButton.style.display = 'block'; // Initially visible
        dynList.dropdownButton = dropdownButton; // Store reference to button

        // Create the hidden drop-down list (initially empty)
        const dropdownList = document.createElement('select');
        dropdownList.className = 'dds-dynalist-combo-dropdown-list';
        dropdownList.style.display = 'none';
        dropdownList.size = options.optionsVisible;

        dropdownList.addEventListener('mouseover', (event) => {
            if (event.target.tagName === 'OPTION') {
                // Remove hover class from all options
                Array.from(dropdownList.options).forEach(opt => {
                    opt.classList.remove('hover-selection');
                });
                // Add hover class to current option
                event.target.classList.add('hover-selection');
            }
        });

        dynList.dropdownList = dropdownList; // Store reference to the drop-down

        // Store reference to container for outside click detection
        dynList.comboContainer = comboContainer;

        // Add event listeners
        comboContainer.addEventListener('click', dynList.handleClickEvent);
        dropdownButton.addEventListener('click', dynList.handleClickEvent);
        dropdownList.addEventListener('change', dynList.handleDropdownChangeEvent);
        dropdownList.addEventListener('keydown', dynList.handleKeyDownEvent);
        document.addEventListener('click', dynList.handleOutsideClickEvent);

        // Assemble the combo drop-down component
        comboContainer.appendChild(dropdownButton);
        comboContainer.appendChild(dropdownList);

        // Replace the original input with the combo container
        input.parentNode.replaceChild(comboContainer, input);

        return dynList;
    }

    handleKeyDownEvent(event) {
        // Handle keyboard navigation
        switch (event.key) {
            case 'ArrowDown':
            case 'Down':
                if (this.dropdownList.style.display === 'none') {
                    this.showDropdown();
                } else {
                    // Select next option
                    let nextIndex = this.dropdownList.selectedIndex + 1;
                    if (nextIndex < this.dropdownList.options.length) {
                        this.dropdownList.selectedIndex = nextIndex;
                        this.dropdownList.options[nextIndex].scrollIntoView({ block: 'nearest' });
                        this.updateTargetField();
                    }
                }
                event.preventDefault();
                break;

            case 'ArrowUp':
            case 'Up':
                if (this.dropdownList.style.display === 'none') {
                    this.showDropdown();
                } else {
                    // Select previous option
                    let prevIndex = this.dropdownList.selectedIndex - 1;
                    if (prevIndex >= 0) {
                        this.dropdownList.selectedIndex = prevIndex;
                        this.dropdownList.options[prevIndex].scrollIntoView({ block: 'nearest' });
                        this.updateTargetField();
                    }
                }
                event.preventDefault();
                break;

            case ' ':  // Space key
            case 'Spacebar':  // For older browsers
                if (this.dropdownList.style.display !== 'none') {
                    // Find the option with hover-selection class
                    const hoveredOption = Array.from(this.dropdownList.options).find(opt =>
                        opt.classList.contains('hover-selection'));

                    if (hoveredOption) {
                        // Set the selected index to the hovered option
                        this.dropdownList.selectedIndex = Array.from(this.dropdownList.options).indexOf(hoveredOption);
                    }

                    // Now update target field with current selection
                    if (this.dropdownList.selectedIndex >= 0) {
                        this.updateTargetField();
                        this.hideDropdown();
                        event.preventDefault();
                    }
                }
                break;

            case 'Enter':
                if (this.dropdownList.style.display !== 'none') {
                    // Similar logic as space - check for hover-selection first
                    const hoveredOption = Array.from(this.dropdownList.options).find(opt =>
                        opt.classList.contains('hover-selection'));

                    if (hoveredOption) {
                        // Set the selected index to the hovered option
                        this.dropdownList.selectedIndex = Array.from(this.dropdownList.options).indexOf(hoveredOption);
                    }

                    if (this.dropdownList.selectedIndex >= 0) {
                        // Update target field if specified
                        this.updateTargetField();
                        // Hide the dropdown
                        this.hideDropdown();
                    }

                    // Stop propagation to prevent the form submission
                    event.stopPropagation();
                    event.preventDefault();
                    return false; // This ensures the event doesn't bubble up
                } else {
                    this.showDropdown();
                    event.stopPropagation();
                    event.preventDefault();
                    return false;
                }
                break;

            case 'Escape':
            case 'Esc':
                if (this.dropdownList.style.display !== 'none') {
                    this.hideDropdown();
                    event.preventDefault();
                }
                break;
        }
    }

    showDropdown() {
        // Show the dropdown
        this.dropdownList.style.display = 'block';

        // Hide the dropdown button
        if (this.dropdownButton) {
            this.dropdownButton.style.display = 'none';
        }

        // Ensure dropdown is visible with multiple rows
        this.dropdownList.setAttribute('size', this.dropdownList.options.length || 5);
        this.dropdownList.style.height = 'auto';
        this.dropdownList.style.overflow = 'visible';

        // Fetch data if needed
        if (this.dropdownList.options.length === 0) {
            this.requestListValues();
        }

        // Focus the dropdown list for keyboard navigation
        setTimeout(() => {
            this.dropdownList.focus();

            // Scroll to selected option if any
            if (this.dropdownList.selectedIndex >= 0) {
                this.dropdownList.options[this.dropdownList.selectedIndex].scrollIntoView({ block: 'nearest' });
            }
        }, 10);
    }

    hideDropdown() {
        // Hide the dropdown list
        this.dropdownList.style.display = 'none';

        // Show the dropdown button
        if (this.dropdownButton) {
            this.dropdownButton.style.display = 'block';
        }
    }

    toggleDropdown() {
        if (this.dropdownList.style.display === 'none') {
            this.showDropdown();
        } else {
            this.hideDropdown();
        }
    }

    updateTargetField() {
        if (this.targetField && this.dropdownList.selectedIndex >= 0) {
            this.targetField.value = this.dropdownList.options[this.dropdownList.selectedIndex].value;
        }
    }

    handleClickEvent(event) {
        // Prevent the click from propagating to document to avoid immediate close
        event.stopPropagation();

        if (this.dropdownList && this.dropdownList.options.length === 0) {
            this.requestListValues();
            return;
        }

        this.toggleDropdown();
    }

    handleDropdownChangeEvent(event) {
        if (this.dropdownList.selectedIndex >= 0) {
            // Update target field if specified
            this.updateTargetField();

            // Hide the dropdown without forcing focus back to input
            this.hideDropdown();
        }
    }

    handleOutsideClickEvent(event) {
        // Only hide the dropdown if the click was outside the container
        if (this.comboContainer && !this.comboContainer.contains(event.target)) {
            // Just hide the dropdown without forcing focus
            if (this.dropdownList.style.display !== 'none') {
                this.hideDropdown();
            }
        }
    }

    handleAjaxResponseEvent(json) {
        // Clear existing options
        while (this.dropdownList.firstChild) {
            this.dropdownList.removeChild(this.dropdownList.firstChild);
        }

        if (json && typeof json.theList === 'string') {
            const lines = json.theList.split('\r\n');
            for (let line of lines) {
                if (!line.trim()) continue; // skip empty lines
                const cols = line.split('\u0009');
                if (cols.length < 3) continue; // skip malformed lines

                const value = cols[0];
                const isSelected = cols[1].trim().toLowerCase() === 'selected';
                const text = cols[2];

                const option = document.createElement('option');
                option.value = value;
                option.text = text;
                if (isSelected) {
                    option.selected = true;
                }

                option.addEventListener('mouseover', () => {
                    Array.from(this.dropdownList.options).forEach(opt => {
                        opt.classList.remove('hover-selection');
                    });
                    option.classList.add('hover-selection');
                });

                this.dropdownList.appendChild(option);
            }

            // Set the input value to the selected option's text, if any
            const selectedOption = this.dropdownList.selectedOptions[0];
            if (selectedOption) {
                this.updateTargetField();
            }

            // Show the dropdown after populating it with data
            // Update the size attribute to match the number of options
            this.dropdownList.setAttribute('size', this.dropdownList.options.length || 5);
            this.showDropdown();
        }
    }

    requestListValues() {
        const data = {
            action: 'getDynamicListItems',
            dynamicListID: this.listID,
        };

        if (this.targetField) {
            data.elementsValues = this.targetField.value;
        }

        // Using 'this' inside the fetch callbacks
        const self = this;

        Fetch.fetchWithTimeout(decodeURI(document.URL), data, AJAX_RESPOSE_TIMEOUT)
            .then(function (response) {
                response.json().then(function (jsonStr) {
                    self.handleAjaxResponseEvent(jsonStr);
                }).catch(function (err) {
                    console.error(`JSON decode error:${err}`);
                });
            })
            .catch(function (err) {
                console.error(`Request List Values failed error:${err}`);
            });
    }
}