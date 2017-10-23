import { packet } from "gendux"

export { default as addTodo } from "./addTodo"
import { default as addTodo } from "./addTodo"

export default packet("gendux-stack-router", packet => {
    packet.action("addTodo", addTodo)
    packet.override(addTodo, base => (params, context) => {
        base(params)
    })
})
