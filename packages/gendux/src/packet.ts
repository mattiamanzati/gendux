import { observable } from "mobx"
import { IContext } from "./context"

type IPacket = {
    action(name: string, fn: Function): void
}

class Packet {
    readonly context: IContext
    readonly name: string
    actions = observable.shallowMap<Function>()
    entities = observable.shallowMap<IEntity<any>>()

    constructor(context: IContext, name: string) {
        this.context = context
        this.name = name
    }

    action(name: string, fn: Function) {
        // check if fn.name and name are the same, if not, throw
        if (fn.name !== name) {
            throw `Function name ${fn.name} differs from the name ${name} provided in package.json, this is not ideal; 
                please update either the function or package.json to make them match.`
        }
        // set in registry
        this.actions.set(name, fn)
    }
}

export function packet(packetName: string, initializer: (packet: IPacket) => void) {
    return (context: IContext) => {
        const addedPacket = new Packet(context, packetName)
        context.addPacket(addedPacket)
        initializer(addedPacket)
    }
}
