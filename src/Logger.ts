import { format }        from "util"
import Path              from "path"
import { writeFileSync } from "fs"
import { appendFile }    from "fs/promises"
import { Response }      from "node-fetch"


export default class Logger
{
    protected destination: string;

    constructor(destination: string) {
        this.destination = destination
    }

    public async error(...args: any[]) {
        const path = Path.join(this.destination, "error_log.txt")
        return appendFile(path, format(...args) + "\n")
    }

    public async request(url: string, res: Response, options: any, time: string) {
        if (options.headers?.authorization) {
            options = {
                ...options,
                headers: {
                    ...options.headers,
                    authorization: "*****"
                }
            }
        }

        const path = Path.join(this.destination, "request_log.tsv")
        return appendFile(path, format(
            "%s\t%s\t%s\t%s\t%s\t%j\t%j",
            options.method || "GET",
            url,
            res.status,
            res.statusText,
            time,
            options,
            res.headers.raw()
        ) + "\n")
    }

    public clearErrors() {
        writeFileSync(Path.join(this.destination, "error_log.txt"), "", "utf-8")
    }

    public clearRequests() {
        writeFileSync(
            Path.join(this.destination, "request_log.tsv"),
            "Method\tURL\tStatus Code\tStatus Text\tTime (ms)\tOptions\tResponse Headers\n",
            "utf-8"
        )
    }
}