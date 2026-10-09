# Grove Task 1 — Hana App SDK signature notes

Source: read-only bundled `hana-app-creator/assets/sdk/hana-app-sdk.tgz`, extracted scaffold copy at `apps/grove/sdk/`; declarations are under `package/dist/app-contract/`. This is the SDK bundled with the Creator scaffold used for Task 1 (package version is reflected by `apps/grove/manifest.json` `minAppVersion`).

## Registration receipt and entry operations

- `AppRegistration` (`registration.d.ts`): callable synchronous disposer `(): void`, plus `ready: Promise<void>` and `disposeAsync(): Promise<void>`.
- In the isolated App entry, registrations return `AppRegistration` synchronously; await `receipt.ready` to know the registration finished. `disposeAsync()` is the async teardown path. A receipt is not just a bare function.
- `sdk.tools.register(registration: AppToolRegistration<T>): Promise<AppRegistration>` (`server-client.d.ts`). The registration requires `name`, `description`, `parameters`, and `execute(args)`; tool `execute` returns a value or Promise.
- `sdk.commands.register(registration: HanaPluginCommandRegistrationV2): Promise<AppRegistration>`; required fields are `name` and `handler(invocation)`, with `aliases`, `description`, and `usage` optional (`entry-context.d.ts` maps `HanaPluginCommandsV2.register`).
- `sdk.bus.subscribe(callback, filter?): Promise<AppRegistration>` (`entry-context.d.ts` maps `HanaPluginBusV2.subscribe`). The callback/filter are typed by the bus contract; `subscribe` registration receipt has the same `ready`/`disposeAsync` shape.
- `sdk.routes.register(registrar: (app: unknown) => unknown): Promise<AppRegistration>` (`entry-context.d.ts` maps `HanaPluginRoutesV2.register`).

## Global storage

`sdk.storage.global` is an `AppEntryStorageScope`. Its methods are asynchronous through the entry bridge:

- `get(key: string, fallback?: unknown): Promise<unknown>`
- `getAll(): Promise<Record<string, unknown>>`
- `set(key: string, value: unknown): Promise<void>`
- `delete(key: string): Promise<void>`
- `keys(): Promise<readonly string[]>`
- `onChanged(callback: (keys: readonly string[]) => void): Promise<AppRegistration>`

The underlying synchronous storage declarations (`context.d.ts`) return values/void, but `entry-context.d.ts` wraps cross-process calls as Promises and turns the `onChanged` disposer into an `AppRegistration`. Task 3/8 adapters should use the entry SDK signatures above, await operations, and normalize registration receipts via `disposeAsync()` (or the callable sync disposer when deliberately chosen).

## Declaration locations checked

- `apps/grove/sdk/app-contract/server-client.d.ts`: server `tools.register` return type.
- `apps/grove/sdk/app-contract/entry-context.d.ts`: tools, commands, bus, routes and global storage bridge signatures.
- `apps/grove/sdk/app-contract/context.d.ts`: underlying tool/command/bus/storage declaration shapes.
- `apps/grove/sdk/app-contract/registration.d.ts`: `AppRegistration` receipt.
