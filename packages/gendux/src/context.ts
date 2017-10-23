export type IContext = {}
export type IServiceProvider = {
    register(context: IContext): void
}

let currentContext: IContext | null = null
export function runWithContext(context: IContext, fn: Function) {
    const prevContext = currentContext
    try {
        currentContext = context
        return fn()
    } finally {
        currentContext = prevContext
    }
}

export function getCurrentContext() {
    if (currentContext === null) {
        throw `Could not get context!`
    }
    return currentContext
}

export function createContext(serviceProviders: IServiceProvider[]): IContext {
    const context = {}

    // run the service providers
    serviceProviders.forEach(service => service.register(context))

    // return the context as-is
    return context
}
