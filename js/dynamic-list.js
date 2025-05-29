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
        this.arrayControlIDs = [];
        this.listID = ''; // Added to store the list ID for AJAX requests
        this.comboInput = null; // Reference to the input element
        this.dropdownList = null; // Reference to the select element

        // Bind all handlers to this instance
        this.handleClickEvent = this.handleClickEvent.bind(this);
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
                // alert(ex);
            }
            DynamicList.replaceInputWithComboDropdownList(input, options);
        }
    }

    static replaceInputWithComboDropdownList(input, options) {
        // Create a new DynamicList instance for this control
        const dynList = new DynamicList();
        dynList.specKey = options.specKey;
        dynList.arrayControlIDs = options.arrayControlIDs;
        dynList.listID = options.specKey; // Assuming specKey can be used as listID

        // Create container div to hold the combo elements
        const comboContainer = document.createElement('div');
        comboContainer.className = 'combo-dropdown-container';

        // Create the input element that will display the selected value
        const comboInput = document.createElement('input');

        // Copy all attributes from original input
        for (let i = 0; i < input.attributes.length; i++) {
            const attr = input.attributes[i];
            if (attr.name !== AsnaDataAttrName.DYNAMIC_LIST_OPTIONS) {
                comboInput.setAttribute(attr.name, attr.value);
            }
        }

        // Set read-only property for combo input
        comboInput.setAttribute('readonly', 'readonly');
        comboInput.className = input.className;
        dynList.comboInput = comboInput; // Store reference to the input

        // Create drop-down button
        const dropdownButton = document.createElement('div');
        dropdownButton.className = 'combo-dropdown-button';
        dropdownButton.innerHTML = DROPDOWN_BUTTON_SVG;

        // Create the hidden drop-down list (initially empty)
        const dropdownList = document.createElement('select');
        dropdownList.className = 'combo-dropdown-list';
        dropdownList.style.display = 'none';
        dynList.dropdownList = dropdownList; // Store reference to the drop-down

        // Store reference to options for AJAX request
        dropdownList.setAttribute('data-spec-key', options.specKey);

        // Store reference to container for outside click detection
        dynList.comboContainer = comboContainer;

        // Add event listeners
        comboInput.addEventListener('click', dynList.handleClickEvent);
        dropdownButton.addEventListener('click', dynList.handleClickEvent);
        dropdownList.addEventListener('change', dynList.handleDropdownChangeEvent);
        document.addEventListener('click', dynList.handleOutsideClickEvent);

        // Assemble the combo drop-down component
        comboContainer.appendChild(comboInput);
        comboContainer.appendChild(dropdownButton);
        comboContainer.appendChild(dropdownList);

        // Replace the original input with the combo container
        input.parentNode.replaceChild(comboContainer, input);

        return dynList;
    }

    handleClickEvent(event) {
        // Toggle drop-down visibility when clicked
        if (this.dropdownList.style.display === 'none') {
            this.dropdownList.style.display = 'block';
            // Fetch data only if the list is empty
            if (this.dropdownList.options.length === 0) {
                this.requestListValues();
            }
        } else {
            this.dropdownList.style.display = 'none';
        }
    }

    handleDropdownChangeEvent(event) {
        if (this.dropdownList.selectedIndex >= 0) {
            this.comboInput.value = this.dropdownList.options[this.dropdownList.selectedIndex].text;
            this.dropdownList.style.display = 'none';
        }
    }

    handleOutsideClickEvent(event) {
        if (this.comboContainer && !this.comboContainer.contains(event.target)) {
            this.dropdownList.style.display = 'none';
        }
    }

    handleAjaxResponseEvent(jsonStr) {
        // Process the AJAX response here
        // This would typically involve populating the drop-down with options
        if (jsonStr && jsonStr.items && Array.isArray(jsonStr.items)) {
            // Clear existing options
            while (this.dropdownList.firstChild) {
                this.dropdownList.removeChild(this.dropdownList.firstChild);
            }

            // Add new options
            jsonStr.items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.value || '';
                option.text = item.text || '';
                this.dropdownList.appendChild(option);
            });
        }
    }

    requestListValues() {
        const data = {
            action: 'getDynamicListItems',
            dynamicListID: this.listID,
        };

        // Get the currently selected value from the input field
        // If no value is present, use '' (empty) as a default/initial value.
        const currentValue = this.comboInput && this.comboInput.value ? this.comboInput.value.trim() : '';
        data.elementsValues = currentValue;

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

