import assert                            from "assert"
import { format }                        from "util"
import { createWriteStream }             from "fs"
import BaseClient, { BaseClientOptions } from "./BaseClient"
import { getPrefixedFileName, wait }     from "./utils"
import { ExportManifest }                from "./types"


interface BulkDataClientOptions extends BaseClientOptions {
    groupId        : string
    retryAfterMSec : number
    minPoolInterval: number
    maxPoolInterval: number
}

export default class BulkDataClient extends BaseClient
{
    constructor(options: BulkDataClientOptions) {
        super(options)
    }

    public async kickOff(): Promise<string> {
        const url = `Group/${this.options.groupId}/$export?_type=Patient`
        const { response } = await this.request(url, {
            headers: {
                prefer: "respond-async",
                accept: "application/fhir+json"
            }
        })
        const location = response.headers.get("content-location")
        assert.ok(location, "The kick-off response did not include content-location header")
        return location
    }

    public async waitForExport(statusEndpoint: string, onProgress?: (status: string) => void): Promise<ExportManifest> {
        let { retryAfterMSec, minPoolInterval, maxPoolInterval } = this.options
        const { response, body } = await this.request(statusEndpoint, { headers: { accept: "application/json" }})

        if (response.status == 200) {
            return body
        }

        if (response.status == 202) {
            const retryAfter  = String(response.headers.get("retry-after") || "").trim();

            if (retryAfter) {
                if (retryAfter.match(/\d+/)) {
                    retryAfterMSec = parseInt(retryAfter, 10) * 1000
                } else {
                    let d = new Date(retryAfter);
                    retryAfterMSec = Math.ceil(d.getTime() - Date.now())
                }
            }

            const poolDelay = Math.min(Math.max(retryAfterMSec, minPoolInterval), maxPoolInterval)
            onProgress && onProgress(String(response.headers.get("X-Progress") || "working..."))
            await wait(poolDelay)
            return this.waitForExport(statusEndpoint, onProgress)
        }

        throw new Error(format("Unexpected bulk status response %s %s. Body: %j", response.status, response.statusText, body))
    }

    async download(manifest: ExportManifest, destination: string) {
        const files: string[] = [];
        for (const entry of manifest.output) {
            const { url, type } = entry
            const dst = getPrefixedFileName(destination, type + ".ndjson", this.options.maxFileSize)
            await this.downloadFile(url, dst, manifest.requiresAccessToken)
            files.push(dst)
        }
        return files
    }
    
    async downloadFile(url: string, path: string, authorize = true) {
        const headers: any = {
            accept: "application/fhir+ndjson",
            "accept-encoding": "gzip, deflate, br, identity"
        }
        if (!authorize) {
            headers.authorization = undefined // Disables authorization
        }
        const response = await this.request(url, { headers }, true);
        assert.ok(response.body, "No response body")
        const fileStream = createWriteStream(path);
        await new Promise((resolve, reject) => {
            response.body!.pipe (fileStream);
            response.body!.on("error", reject);
            fileStream.on ("finish", resolve);
        });
    }
}
