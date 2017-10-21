# gendux
An ongoing experiment about mobx-state-tree, generators, microservices and graphql

### WARNING! NOT TO USE IN PRODUCTION, NOT READY YET AND MAYBE NEVER? JUST EXPERIMENTING!

## Introduction
Gendux is an ongoing experiment. DO NOT USE IT FOR PRODUCTION.

The idea behind gendux is to provide a strict application architecture based on asyncronimous functions, replayability and data serialization.

## Models
### Declaring a Model
Gendux is all about knowing exactly how models are shaped. To easily define models, you can write models using a .json file containing a JSONSchema draft-6. 

JSONSchema files are really neat, because they allow to easily define tree shapes, but they also allow graphs of models through "$ref" and they also provide metadata fields for your model like title, description, etc... and standard validation rules.

An example valid JSONSchema will be the following:

```json
{
    "type": "object",
    "properties": {
        "name": { "type": "string", "maxLength": 255, "default": ""},
        "done": { "type": "boolean", "default": false }
    }
}
```

### Compiling a JSONSchema to a JavaScript Model

JSONSchema are neat indeed, but... how we can create a JavaScript model instance from a JSONSchema?

Gendux will ship a command line utility that will setup for you all the compilation of JSONSchema and TypeScript to JavaScript & TS Definition files.

Generated models are MobX-State-Tree models, enriched with the informations from the JSONSchema.

To tell Gendux which JSONSchema to compile and where to find them, you just need to add a section named "models" to your package.json file, that will contain a map of where to resolve the JSONSchema for that model name.

```json
{
    "gendux": {
        "models": {
            "Todo": "./models/Todo.json"
        }
    }
}
```

The name of the model must be alphanumeric, variable-like.

You can now move your terminal onto your folder and run `gendux build:watch` to automatically update your compiled files.

### Referencing other models

While defining your models, you may need to put a reference to an already defined model, for example define an array of Todos.

You can easily do that using JSONSchema $ref, and use as URI the name of the module, slash, the name of the model in the models object.

```json
{
    "type": "object",
    "properties": {
        "todos": { "type": "array", "items": { "$ref": "todos-module/Todo" }}
    }
}
```

You can now update your package.json accordingly.

```json
{

    "gendux": {
        "models": {
            "Todo": "./models/Todo.json",
            "TodoStore": "./models/TodoStore.json"
        }
    }
}
```

## Actions

### Defining actions

Gedux actions are the only place where you are allowed to change your application state. 

```javascript
export default action(function* toggleTodo({ todo }){
    todo.done != todo.done
})
```

Actions are always async, and expressed through generators, like you'll do using the "co" npm package.

```javascript
export default action(function* fetchTodos({ store }){
    const res = yield fetch('http://api.todos.com')
    const todos = yield res.json()
    store.todos = todos
})
```

As you can see actions can receive a parameter object, but every item in that object should be either a serializable object or a Gendux (MST) model.

Passing functions as argument will make the action throw when called.

You can use actions inside other actions, you just need to import them!

```javascript
import toggleTodo from './toggleTodo'

export default action(function* changeTodo({ todo }){
    // the todo is already done, do nothing
    if(todo.done) return

    // toggle as done and change the description
    yield toggleTodo({ todo })
    todo.name = 'DONE: ' + todo.name
})
```
### Exporting actions

To export your action from the current module to be used up in another module, you just need to define an "actions" section into your package.json


```json
{

    "gendux": {
        "models": {
            "Todo": "./models/Todo.json",
            "TodoStore": "./models/TodoStore.json"
        },
        "actions": {
            "createTodo": "./actions/createTodo.js",
            "toggleTodo": "./actions/toggleTodo.js"
        }
    }
}
```

Action names used as key should be a valid variable-like identifier.

It will be prefixed with the package name automatically.

### Building actions

As happends with models, Gendux actions will need to pass through the compiler.
This is not just because generators needs to be transpiled, but will also create the entry file for the module that will export all the actions with the name used in the package.json.

Running `gendux build:watch` will do the job.

### Gendux-Server

Having all actions to be async is a benefit, here's why:

Thanks to the package.json thingy, we have an unique identifier for each action in our application. Actions are always assumed to be asyc, so ideally when you call a function you can, instead of execute some code, call a REST/GraphQL endpoint and return the result of that call.

Let's take back the previous example and refactor it out a little:

```javascript
export default action(function* fetchTodos({ store }){
    const res = yield fetch('http://api.todos.com')
    const todos = yield res.json()
    store.todos = todos
})
```

now let's extract the fetching logic onto a separate microfunction.

```javascript
export default action(function* fetchTodos({ store }){
    const todos = yield getTodosFromAPI({})
    store.todos = todos
})
```

```javascript
export default action(function* getTodosFromAPI(){
    const res = yield fetch('http://api.todos.com')
    return yield res.json()
})
```

Ok, pretty simple right? Right. 

Now, what if getTodosFromAPI needs to be a query to a SQL database to fetch data to return? If your code would be only server-side you could just write something like that:

```javascript
export default action(function* getTodosFromAPI(){
    return yield query(`SELECT * FROM todos`)
})
```

The interesting thing, is that when we call the getTodosFromAPI on the client, we don't know much about the function, and since it is an asyncronous function, we could just replace that with a request to the server on the client!

With Gendux-Server you can mark some actions to be executed only server-side; a REST api server will be automatically built up from your gendux actions and client-side call to server-side actions will be replaced by a fetch request.

Each action URL endpoint will look like:
`http://localhost/<package-name>/<action-name>`

And here's why action parameter object should be either serializable or a MST model instance.

You can perform a POST request to the url; any post parameter will be passed to the action called server side.

If the parameter is an MST model instance, its snapshot will be passed instead along with the model type id. E.g.:

```json
{
    "todo": {
        "$TYPE": "todos-module/Todo",
        "$SNAPSHOT": {
            "name": "Hello",
            "done": false
        }
    },
    "newTitle": "Hello World!"
}
```

TODO: Could we avoid this $TYPE? Maybe we could define action parameters as MST models? So we can get typings and serialization/deserialization for free. Something like `action({ newTitle: t.string, todo: Todo})( function(){ ... })`

The response of the endpoint will be the function return value, along with any patch of changes did in the entire application store.