/*
 * Copyright (c) ASNA, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { theDropDown as DropDown };

import { AsnaDataAttrName } from '../js/asna-data-attr.js';

class DropDown {
    initBoxes() {
        const elements = document.querySelectorAll(`input[${AsnaDataAttrName.VALUES}]`);

        for (let i = 0, l = elements.length; i < l; i++) {
            const input = elements[i];

            const values = input.getAttribute(AsnaDataAttrName.VALUES);
            const valuesText = input.getAttribute(AsnaDataAttrName.VALUES_TEXT);
            this.replaceInputWithSelect(input, this.parseAttribute(values), this.parseAttribute(valuesText));

            input.removeAttribute(AsnaDataAttrName.VALUES);
        }
    }

    parseAttribute(values) {
        if (!values)
            return [];

        let vals = [];
        let state = 'initial';
        let iLexeme = 0;
        let hasEmbbededQuotes = false;
        let valuesEos = values + '\0';

        for (let i = 0, l = valuesEos.length; i < l; i++) {
            const ch = valuesEos[i];

            switch (state) {
                case 'initial':
                    {
                        iLexeme = i;
                        if (ch === '\'')
                            state = 'in-quote';
                        else if (ch !== ' ')
                            state = 'unquoted';
                        break;
                    }
                case 'in-quote':
                    {
                        if (ch === '\'')
                            state = 'second-quote';
                        break;
                    }
                case 'second-quote':
                    {
                        if (ch !== '\'') {
                            state = 'end-quoted';
                        }
                        else {
                            state = 'in-quote';
                            hasEmbbededQuotes = true;
                        }
                        break;
                    }
                case 'unquoted':
                    {
                        if (ch === ',')
                            state = 'end-un-quoted';
                        break;
                    }
            }

            switch (state) {
                case 'end-quoted':
                    {
                        let lexeme = valuesEos.substring(iLexeme + 1, i - 1);
                        if (hasEmbbededQuotes)
                            lexeme = lexeme.Replace("''", "'");
                        vals.push(lexeme);
                        state = 'initial';
                        break;
                    }
                case 'end-end-unquoted':
                    {
                        vals.push(valuesEos.substring(iLexeme, i));
                        state = 'initial';
                        break;
                    }
            }
        }

        if (state === 'unquoted')
            vals.push(valuesEos.substring(iLexeme, i));

        return vals;
    }

    replaceInputWithSelect(input, optionsValues, optionTexts) {
        const select = document.createElement('select');
        select.style.gridColumn = input.style.gridColumn;
        select.name = input.name;
        if (input.tabIndex) {
            select.tabIndex = input.tabIndex;
        }

        const rowcol = input.getAttribute(AsnaDataAttrName.ROWCOL);
        if (rowcol) {
            select.setAttribute(AsnaDataAttrName.ROWCOL, rowcol);
        }

        const positionCursor = input.getAttribute(AsnaDataAttrName.POSITION_CURSOR);
        if (positionCursor !== null) {
            select.setAttribute(AsnaDataAttrName.POSITION_CURSOR, positionCursor);
        }

        for (let i = 0, l = optionsValues.length; i < l; i++) {
            const option = document.createElement('option');
            const optValue = optionsValues[i];
            const optText = optionTexts[i];
            option.value = optValue;
            if (DropDown.allZeroes(optValue) && optText === '0') {
                option.innerText = ' ';
            }
            else
                option.innerText = optText;

            select.appendChild(option);
        }

        input.parentNode.replaceChild(select, input); // Note: input will be destroyed during DOM's garbage collection.
    }

    static allZeroes(test) {
        if (!test) {
            return false;
        }

        for (let i = 0, l = test.length; i < l; i++) {
            if (test[i] !== '0') {
                return false;
            }
        }

        return true;
    }
}

const theDropDown = new DropDown();
