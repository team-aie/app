let globalKeyDownHandlers: EventListener[] = [];
const globalKeyDownHandlerIndexMap = new WeakMap<EventListener, number>();
let globalKeyUpHandlers: EventListener[] = [];
const globalKeyUpHandlerIndexMap = new WeakMap<EventListener, number>();

const addGlobalKeyDownHandler = (handler: EventListener): void => {
  if (globalKeyDownHandlerIndexMap.has(handler)) {
    throw new Error('Adding multiple instances of the same handler is not supported!');
  }
  const index = globalKeyDownHandlers.push(handler) - 1;
  globalKeyDownHandlerIndexMap.set(handler, index);
};
export { addGlobalKeyDownHandler };

const removeGlobalKeyDownHandler = (handler: EventListener): void => {
  if (!globalKeyDownHandlerIndexMap.has(handler)) {
    throw new Error('Handler was never added!');
  }
  const index = globalKeyDownHandlerIndexMap.get(handler);
  globalKeyDownHandlerIndexMap.delete(handler);
  globalKeyDownHandlers = globalKeyDownHandlers.filter((v, i) => i !== index);
};
export { removeGlobalKeyDownHandler };

const addGlobalKeyUpHandler = (handler: EventListener): void => {
  if (globalKeyUpHandlerIndexMap.has(handler)) {
    throw new Error('Adding multiple instances of the same handler is not supported!');
  }
  const index = globalKeyUpHandlers.push(handler) - 1;
  globalKeyUpHandlerIndexMap.set(handler, index);
};
export { addGlobalKeyUpHandler };

const removeGlobalKeyUpHandler = (handler: EventListener): void => {
  if (!globalKeyUpHandlerIndexMap.has(handler)) {
    throw new Error('Handler was never added!');
  }
  const index = globalKeyUpHandlerIndexMap.get(handler);
  globalKeyUpHandlerIndexMap.delete(handler);
  globalKeyUpHandlers = globalKeyUpHandlers.filter((v, i) => i !== index);
};
export { removeGlobalKeyUpHandler };

const globalKeyDownHandler: EventListener = (event) => {
  if (event.defaultPrevented) {
    return;
  }
  globalKeyDownHandlers.forEach((handler) => handler(event));
};
export { globalKeyDownHandler };

const globalKeyUpHandler: EventListener = (event) => {
  if (event.defaultPrevented) {
    return;
  }
  globalKeyUpHandlers.forEach((handler) => handler(event));
};
export { globalKeyUpHandler };
