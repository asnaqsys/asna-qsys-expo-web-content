/*
 * Copyright (c) ASNA, Inc. and its affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { DynamicList };

import { AsnaDataAttrName } from './asna-data-attr.js';
import { Fetch } from './ajax/ajax-fetch.js';

const AJAX_RESPOSE_TIMEOUT = 1 * 60 * 1000; // 1 minutes

class DynamicList {
    constructor() {
        this.specKey = '';
        this.arrayControlIDs = [];
        this.handleMouseClickEvent = this.handleMouseClickEvent.bind(this);
    }

    static init() {
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
        this.specKey = options.specKey;
        this.arrayControlIDs = options.arrayControlIDs;

        // Create container div to hold the combo elements
        const comboContainer = document.createElement('div');
        comboContainer.className = 'combo-dropdown-container';
        comboContainer.style.position = 'relative';
        comboContainer.style.display = 'inline-block';
        comboContainer.style.width = '100%';

        // Create the input element that will display the selected value
        const comboInput = document.createElement('input');

        // Copy all attributes from original input
        for (let i = 0; i < input.attributes.length; i++) {
            const attr = input.attributes[i];
            if (attr.name !== AsnaDataAttrName.DYNAMIC_LIST_OPTIONS) {
                comboInput.setAttribute(attr.name, attr.value);
            }
        }

        // Set specific properties for combo input
        comboInput.style.paddingRight = '20px'; // Make room for drop-down button
        comboInput.setAttribute('readonly', 'readonly');
        comboInput.className = input.className;

        // Create dropdown button
        const dropdownButton = document.createElement('div');
        dropdownButton.className = 'combo-dropdown-button';
        dropdownButton.innerHTML = `
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" 
            style="position:absolute; right:3px; top:50%; transform:translateY(-50%); opacity:0.5" 
            height="16" width="16" 
            viewBox="-128 -1536 1792 1792" 
            preserveAspectRatio="xMidYMid meet">
            <g transform="scale(1, -1)">
                <path style="fill: blue" 
                    d="M1611 832q0 -53 -37 -90l-651 -651q-38 -38 -91 -38q-54 0 -90 38l-651 651q-38 36 -38 90q0 53 38 91l74 75q39 37 91 37q53 0 90 -37l486 -486l486 486q37 37 90 37q52 0 91 -37l75 -75q37 -39 37 -91z">
                </path>
            </g>
        </svg>`;

        // Create the hidden drop-down list (initially empty)
        const dropdownList = document.createElement('select');
        dropdownList.className = 'combo-dropdown-list';
        dropdownList.style.display = 'none';
        dropdownList.style.position = 'absolute';
        dropdownList.style.left = '0';
        dropdownList.style.right = '0';
        dropdownList.style.top = '100%';
        dropdownList.style.zIndex = '1000';
        dropdownList.style.maxHeight = '200px';
        dropdownList.style.overflowY = 'auto';

        // Store reference to options for AJAX request
        dropdownList.setAttribute('data-spec-key', options.specKey);

        // Create dynamic list instance for event handling
        const dynList = new DynamicList();
        dynList.specKey = options.specKey;
        dynList.arrayControlIDs = options.arrayControlIDs;

        // Add event listeners
        const handleClick = function () {
            // Toggle dropdown visibility when clicked
            if (dropdownList.style.display === 'none') {
                dropdownList.style.display = 'block';
                // Fetch data only if the list is empty
                if (dropdownList.options.length === 0) {
                    dynList.requestListValues();
                }
            } else {
                dropdownList.style.display = 'none';
            }
        };

        comboInput.addEventListener('click', handleClick);
        dropdownButton.addEventListener('click', handleClick);

        dropdownList.addEventListener('change', function () {
            if (this.selectedIndex >= 0) {
                comboInput.value = this.options[this.selectedIndex].text;
                dropdownList.style.display = 'none';
            }
        });

        // Add click outside handler to close drop-down
        document.addEventListener('click', function (event) {
            if (!comboContainer.contains(event.target)) {
                dropdownList.style.display = 'none';
            }
        });

        // Assemble the combo drop-down component
        comboContainer.appendChild(comboInput);
        comboContainer.appendChild(dropdownButton);
        comboContainer.appendChild(dropdownList);

        // Replace the original input with the combo container
        input.parentNode.replaceChild(comboContainer, input);

        // Return the dynamic list instance (can be used to add custom event handlers)
        return dynList;
    }


    handleMouseClickEvent(event) {
        this.requestListValues();
    }

    requestListValues() {
        const data = {
            action: 'getDynamicListItems',
            dynamicListID: listID,
        };

        data.elementsValues = 'A';  // First element is the currently selected value

        Fetch.fetchWithTimeout(decodeURI(document.URL), data, AJAX_RESPOSE_TIMEOUT)
            .then(function (response) {
                response.json().then(function (jsonStr) {
                    ajaxRespEventHandler(jsonStr);
                }
                ).catch(function (err) {
                    console.error(`JSON decode error:${err}`);
                });
            }
            ).
            catch(function (err) {
                console.error(`Request List Values failed error:${err}`);
            }
        );
    }
}
