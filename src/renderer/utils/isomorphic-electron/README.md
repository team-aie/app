There are times when the main process depends on a utilility function and then the program crashes, because one of the
utilities imports `@electron/remote`. This script simply finds the intersection types of `electron` and
`@electron/remote` and use that as the export. If the user of the code needs more functions from `@electron/remote`,
they should import `@electron/remote` directly.
