﻿/*
 * Copyright (c) ASNA, Inc. and its affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { BufferMapping };

import { TerminalDOM } from './terminal-dom.js';

class BufferMapping {
    constructor(_5250cols) {
        this._5250cols = _5250cols;
    }
    coordToPos(row, col) {
        return col + row * this._5250cols;
    }

    rowFromPos(pos) {
        return pos / this._5250cols >> 0;  // Integer division  
    }

    colFromPos(pos) {
        return pos % this._5250cols >> 0; // Integer modulo
    }
    static rowToPixel(row, termLayout) {
        return row * parseFloat(TerminalDOM.getGlobalVarValue('--term-row-height')); //   termLayout._5250.cursor.h;
    }
    static colToPixel(col, termLayout) {
        return col * parseFloat(TerminalDOM.getGlobalVarValue('--term-col-width')); /*termLayout._5250.cursor.w;*/
    }
}

