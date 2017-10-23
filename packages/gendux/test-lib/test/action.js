"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const ava_1 = require("ava");
const mobx_state_tree_1 = require("mobx-state-tree");
ava_1.test.cb("context should always be valid", t => {
    const givenContext = Object.freeze({ $CONTEXT: true });
    const Todo = mobx_state_tree_1.types.model({
        done: mobx_state_tree_1.types.boolean
    });
    const toggle = src_1.action({
        todo: Todo
    }, mobx_state_tree_1.types.boolean)(function* ({ todo }, context) {
        // check valid context and params
        t.is(context, givenContext);
        t.is(todo, instance);
        // perform some actions
        todo.done = true;
        // check if they did something
        t.is(todo.done, true);
        // end
        t.end();
    });
    const instance = Todo.actions(self => ({ toggle })).create({ done: false });
    src_1.runWithContext(givenContext, () => instance.toggle({ todo: instance }));
});
