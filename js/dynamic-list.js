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


/*
        const string dropDownButtonSVG = 
            "<svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" " +
                    "style=\"position:relative; top:3px; opacity:0.5\" " +
                    "x=\"0\" y=\"0\" " +
                    "height=\"16\" width=\"16\" " +
                    "viewBox=\"-128 -1536 1792 1792\" " +
                    "preserveAspectRatio=\"xMidYMid meet\">\r\n" +
                "<g transform=\"scale(1, -1)\">\r\n" +
                    "<path style=\"fill: blue\" " +
                        "d=\"M1611 832q0 -53 -37 -90l-651 -651q-38 -38 -91 -38q-54 0 -90 38l-651 651q-38 36 -38 90q0 53 38 91l74 75q39 37 91 37q53 0 90 -37l486 -486l486 486q37 37 90 37q52 0 91 -37l75 -75q37 -39 37 -91z\">\r\n" +
                    "</path>\r\n" +
                "</g>\r\n" +
            "</svg>";
*/