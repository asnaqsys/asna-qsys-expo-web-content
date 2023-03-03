﻿/*
 * Copyright (c) ASNA, Inc. and its affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { theDropDown as DropDown };
export { theContextMenu as ContextMenu };

import { AsnaDataAttrName } from './asna-data-attr.js';
import { StringExt } from './string.js';
import { DdsGrid } from './dds-grid.js';
import { EXPO_SUBFILE_CLASS, SubfileController, Subfile } from './subfile-paging/dom-init.js';

class DropDown {
    initBoxes() {
        const elements = document.querySelectorAll(`input[${AsnaDataAttrName.VALUES}]`);

        for (let i = 0, l = elements.length; i < l; i++) {
            const input = elements[i];

            const values = input.getAttribute(AsnaDataAttrName.VALUES);
            const valuesText = input.getAttribute(AsnaDataAttrName.VALUES_TEXT);
            this.replaceInputWithSelect(input, this.parseAttribute(values), this.parseAttribute(valuesText));
            // Note: no need to remove AsnaDataAttrName.VALUES, AsnaDataAttrName.VALUES_TEXT, etc. (input was replaced).
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
        if (optionsValues.length !== optionTexts.length) {
            window.alert(`${input.name} field define ${optionsValues.length} Values and ${optionTexts.length} ValuesText. Collection size must match!`);
            return;
        }

        const select = document.createElement('select');
        DropDown.copyNonValuesAttributes(select, input);

        for (let i = 0, l = optionsValues.length; i < l; i++) {
            const optValue = optionsValues[i];
            const optText = optionTexts[i];
            if (optText.length > 0) { // Skip when empty.
                const option = document.createElement('option');
                option.value = optValue;
                if (DropDown.allZeroes(optValue) && optText === '0') {
                    option.innerText = ' ';
                }
                else
                    option.innerText = optText;

                select.appendChild(option);
            }
        }

        const value = input.value ? input.value : null;
        input.parentNode.replaceChild(select, input); // Note: input will be destroyed during DOM's garbage collection.
        if (value) {
            for (let i = 0, l = select.options.length; i < l; i++) {
                if ( DropDown.isSameOptionValue(select.options[i].value, value)) {
                    select.selectedIndex = i;
                    break;
                }
            }
        }
    }

    static copyNonValuesAttributes(target, source) {
        if (!source.attributes) { return; }

        for (let i = 0, l = source.attributes.length; i < l; i++) {
            const attr = source.attributes[i];
            if (!attr.name || attr.name === AsnaDataAttrName.VALUES || attr.name === AsnaDataAttrName.VALUES_TEXT) {
                continue;
            }

            target.setAttribute(attr.name, attr.value);
        }
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

    static isSameOptionValue(optVal, val) {
        if (typeof optVal === 'string' && typeof optVal === typeof val) {
            return StringExt.trim(optVal) == StringExt.trim(val);
        }
        else if (typeof optVal === typeof val) {
            return optVal == val;
        }

        if (typeof optVal === 'string' && typeof val === 'number') {
            const optNumVal = parseInt(StringExt.trim(optVal), 10);
            return optNumVal === val;
        }
        return false; // Don't know
    }
}

const MENU_NAV_SELECTOR = 'nav.dds-menu';

class ContextMenu {
    constructor() {
        this.initData = [];
        this.list = [];
    }

    add(record, menu) {
        this.initData.push({ record: record, menu: menu });
    }

    prepare(main) {
        if (!main) { return; }

        this.initData.forEach((data) => {
            const menuEl = ContextMenu.createMenu(main, data);
            if (menuEl) {
                this.list.push(menuEl);
            }
        });
    }

    static createMenu(main, menuData) {
        const leftTop = ContextMenu.findRelPosition(main, menuData);

        if (!leftTop) { return null; }

        const div = document.createElement('div');
        div.classList.add('dds-menu-anchor');
        div.style.position = 'absolute';
        div.style.left = `${leftTop.l}px`;
        div.style.top = `${leftTop.t}px`;

        const button = document.createElement('button');
        const nav = document.createElement('nav');
        const ul = document.createElement('ul');

        button.type = 'button';
        button.className = 'dds-menu-anchor';
        button.innerText = '☰';
        button.addEventListener('click', (e) => {
            const me = e.target;
            const menu = me.parentElement;
            if (menu && menu._row) {
                const row = menu._row;
                const recordsContainer = row.closest('div[data-asna-row]');
                if (recordsContainer) {
                    SubfileController.setCurrentSelection(recordsContainer, menu._row, true);
                }
            }
            const nav = me.parentElement.querySelector(MENU_NAV_SELECTOR);
            if (nav) {
                nav.style.display = 'inline-block';
            }
        });
        button.addEventListener('mouseover', (e) => {
            const me = e.target;
            const menu = me.parentElement; 
            if (menu && menu._row) {
                menu._row.classList.add(EXPO_SUBFILE_CLASS.CANDIDATE_CURRENT_RECORD);
            }
        });

        nav.className = 'dds-menu';

        div.appendChild(button);
        div.appendChild(nav);

        nav.appendChild(ul);

        menuData.menu.forEach((menuOption) => {
            const item = document.createElement('li');
            if (menuOption.text === "--" && menuOption.aidKeyName === "None" ) {
                item.className = 'dds-menu-divider';
                const hRule = document.createElement('hr');
                item.appendChild(hRule);
            }
            else {
                const menuButton = document.createElement('button');
                menuButton.type = 'button';
                item.appendChild(menuButton);

                menuButton.innerText = menuOption.text;
                menuButton.addEventListener('click', (e) => {
                    const me = e.target;
                    const nav = me.closest(MENU_NAV_SELECTOR);
                    if (nav) {
                        nav.style.display = 'none';
                    }
                    const row = nav.parentElement._row;
                    if (row) {
                        let virtRowCol = menuOption.vRowCol;
                        if (menuOption.focusField) {
                            const inputs = row.querySelectorAll('input[name]:not([type="hidden"])');
                            if (inputs) {
                                let inputName = '';
                                inputs.forEach((input) => {
                                    const name = input.getAttribute('name');
                                    if (Subfile.matchRowFieldName(name, menuOption.focusField)) {
                                        inputName = name;
                                        if (!virtRowCol) {
                                            virtRowCol = input.getAttribute(AsnaDataAttrName.ROWCOL);
                                        }
                                    }
                                });
                                if (inputName) {
                                    setTimeout(() => {
                                        asnaExpo.page.pushKey(menuOption.aidKeyName, inputName, menuOption.fieldValue, virtRowCol);
                                    }, 1);
                                }
                            }
                        }
                        else if (menuOption.aidKeyName) {
                            setTimeout(() => {
                                asnaExpo.page.pushKey(menuOption.aidKeyName, "", "", virtRowCol);
                            }, 1);
                        }
                    }
                });
            }
            ul.appendChild(item);
        });

        const menu = main.appendChild(div);

        const recordsContainer = DdsGrid.findRowSpanDiv(menuData.record);
        if (recordsContainer) {
            const rows = SubfileController.selectAllRowsIncludeTR(recordsContainer);
            rows.forEach((row) => {
                row.addEventListener('mouseover', () => {
                    ContextMenu.collapse(menu);
                    ContextMenu.positionAtRow(menu, row);
                });
            });
        }

        return menu;
    }

    static findRelPosition(main, menu) {
        // Temp !!! -- should use menu.name to find the record first ...
        const targets = main.querySelectorAll('div[data-asna-content-menu]');
        if (!targets || !targets.length) { return null; }
        const target = targets[0]; // Temp !!! - use the first.
        // const tp = target.parentNode;

        const rTarget = target.getBoundingClientRect();

        return { l: rTarget.left, t: rTarget.top };
    }

    static collapse(menu) {
        const nav = menu.querySelector(MENU_NAV_SELECTOR);
        if (nav) {
            nav.style.display = 'none';
        }
    }

    static positionAtRow(menu, row) {
        const rowRect = row.getBoundingClientRect();
        const lastRow = menu._row;
        menu.style.top = `${rowRect.top}px`;
        menu._row = row;
        if (lastRow) {
            lastRow.classList.remove(EXPO_SUBFILE_CLASS.CANDIDATE_CURRENT_RECORD);
        }
    }
}

const theDropDown = new DropDown();
const theContextMenu = new ContextMenu();
