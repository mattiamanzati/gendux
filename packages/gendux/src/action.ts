import { IType, process as flow, types as t } from "mobx-state-tree"
import { getCurrentContext, runWithContext, IContext } from "./context"

export type IModelProperties<SI, TI> = { [K in keyof TI]: IType<any, TI[K]> } &
    { [K in keyof SI]: IType<SI[K], any> }

export function action<SI, TI, SO, TO>(
    input: IModelProperties<SI, TI> | ((context: IContext) => IModelProperties<SI, TI>),
    output: IType<SO, TO> | ((context: IContext) => IType<SO, TO>)
): (generator: (params: TI, context: IContext) => IterableIterator<any>) => (params: TI) => TO {
    return generator => {
        // wrap the generator
        const wrappedGenerator = function(args: any) {
            const context = getCurrentContext()
            const iterator: IterableIterator<any> = generator(args, context)

            return {
                [Symbol.iterator]: wrappedGenerator,
                next: (value: any) => runWithContext(context, () => iterator.next(value)),
                return: (value: any) =>
                    runWithContext(
                        context,
                        () => (iterator.return ? iterator.return(value) : undefined)
                    ),
                throw: (error: any) =>
                    runWithContext(
                        context,
                        () => (iterator.throw ? iterator.throw(error) : undefined)
                    )
            }
        }

        // convert to a MST flow
        const finalFunction = flow(wrappedGenerator as any) as any

        // sets the final name same as the generator one
        Object.defineProperty(finalFunction, "name", { value: generator.name, writable: false })

        return finalFunction
    }
}
