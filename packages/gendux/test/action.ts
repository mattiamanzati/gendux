import { action, runWithContext } from "../src"
import { test } from "ava"
import { types } from "mobx-state-tree"

test.cb("context should always be valid", t => {
    const givenContext = Object.freeze({ $CONTEXT: true })

    const Todo = types.model({
        done: types.boolean,
        name: types.string
    })

    const toggle = action(
        {
            todo: Todo
        },
        types.boolean
    )(function*({ todo }, context) {
        // check valid context and params
        t.is(context, givenContext)
        t.is(todo, instance)
        // perform some actions
        todo.done = true
        // check if they did something
        t.is(todo.done, true)
        // end
        t.end()
    })

    const instance = Todo.actions(self => ({ toggle })).create({ done: false })

    runWithContext(givenContext, () => instance.toggle({ todo: instance }))
})
