import { join }   from "path"
import { existsSync, readdirSync, rmSync } from "fs"

export function emptyFolder(path: string) {
    if (existsSync(path)) {
        readdirSync(path, { withFileTypes: true }).forEach(entry => {
            if (entry.name !== ".gitkeep" && entry.isFile()) {
                rmSync(join(path, entry.name))
            }
        })
    }
}
