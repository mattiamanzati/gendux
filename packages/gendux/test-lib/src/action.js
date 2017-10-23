"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mobx_state_tree_1 = require("mobx-state-tree");
let currentContext = null;
function runWithContext(context, fn) {
    const prevContext = currentContext;
    try {
        currentContext = context;
        return fn();
    }
    finally {
        currentContext = prevContext;
    }
}
exports.runWithContext = runWithContext;
function getCurrentContext() {
    if (currentContext === null) {
        throw `Could not get context!`;
    }
    return currentContext;
}
exports.getCurrentContext = getCurrentContext;
function wrapGeneratorWithContext(generator) {
    const fn = function (args) {
        const context = getCurrentContext();
        const iterator = generator(args, context);
        return {
            [Symbol.iterator]: fn,
            next: (value) => runWithContext(context, () => iterator.next(value)),
            return: (value) => runWithContext(context, () => (iterator.return ? iterator.return(value) : undefined)),
            throw: (error) => runWithContext(context, () => (iterator.throw ? iterator.throw(error) : undefined))
        };
    };
    return fn;
}
function action(input, output) {
    return generator => {
        // wrap the generator
        const wrappedGenerator = function (args) {
            const context = getCurrentContext();
            const iterator = generator(args, context);
            return {
                [Symbol.iterator]: wrappedGenerator,
                next: (value) => runWithContext(context, () => iterator.next(value)),
                return: (value) => runWithContext(context, () => (iterator.return ? iterator.return(value) : undefined)),
                throw: (error) => runWithContext(context, () => (iterator.throw ? iterator.throw(error) : undefined))
            };
        };
        return mobx_state_tree_1.process(wrappedGenerator);
    };
}
exports.action = action;
