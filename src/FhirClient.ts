import { FetchError } from "node-fetch"
import { format }     from "util"
import BaseClient     from "./BaseClient"
import {
    appendToNdjson,
    getPrefixedFileName,
    wait
} from "./utils"


export default class FhirClient extends BaseClient
{
    private async downloadAll(url: string, expectedType: string, visitor: (resource: fhir4.Resource) => Promise<void>) {

        const handleResource = async (resource: fhir4.Resource) => {
            if (!resource || !resource.resourceType) {
                throw new FetchError(format('GET %s -> Did not return a valid resource', url), "fetch-error-bad-response")
            }

            if (resource.resourceType.toLowerCase() === "bundle") {
                await forEachResource(resource as fhir4.Bundle)
            } else {
                if (expectedType !== resource.resourceType) {
                    throw new FetchError(
                        format('GET %s -> expected resource of type %j but got %j: %j', url, expectedType, resource.resourceType, resource),
                        "fetch-error-bad-response"
                    )
                }
                await visitor(resource)
            }    
        }

        const forEachResource = async (result: fhir4.Bundle) => {
            const arr = result.entry || [];
            for (const entry of arr) {
                await handleResource(entry.resource!)
            }
        
            let next = result.link?.find(l => l.relation == "next")?.url
            if (next) {
                await wait(this.options.throttle)
                await this.downloadAll(next!, expectedType, visitor)
            }
        }

        await wait(this.options.throttle)
        const { body } = await this.request<fhir4.Resource>(url)
        await handleResource(body)
    }

    public async downloadResource(uri: string, onResource?: (res: fhir4.Resource) => Promise<void>): Promise<void> {
        const expectedType = uri.replace(/\?.*/, "")
        const path = getPrefixedFileName(this.options.destination, expectedType + ".ndjson", this.options.maxFileSize)
        await this.downloadAll(uri, expectedType, async (resource) => {
            await appendToNdjson(resource, path)
            onResource && await onResource(resource)
            await wait(0)
        })
    }
}
