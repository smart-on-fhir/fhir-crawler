import BaseClient from "./BaseClient"
import {
    appendToNdjson,
    getPrefixedFileName,
    wait
} from "./utils"


export default class FhirClient extends BaseClient
{
    private async downloadAll(url: string, visitor: (resource: fhir4.Resource, url: string) => Promise<void>) {

        const forEachResource = async (result: fhir4.Bundle) => {
            const arr = result.entry || [];
            for (const entry of arr) {
                if ((entry.resource?.resourceType || "").toLowerCase() == "bundle") {
                    await forEachResource(entry.resource as fhir4.Bundle)
                } else {
                    await visitor(entry.resource as fhir4.Resource, url)
                }
            }
        
            let next = result.link?.find(l => l.relation == "next")?.url
            if (next) {
                await wait(this.options.throttle)
                await this.downloadAll(next!, visitor)
            }
        }

        await wait(this.options.throttle)
        const { body } = await this.request<fhir4.Resource>(url)
        
        if (body.resourceType.toLowerCase() === "bundle") {
            await forEachResource(body as fhir4.Bundle)
        } else {
            await visitor(body, url)
        }
    }

    public async downloadResource(uri: string, onResource?: (res: fhir4.Resource) => Promise<void>) {
        const expectedType = uri.replace(/\?.*/, "")
        const path = getPrefixedFileName(this.options.destination, expectedType + ".ndjson", this.options.maxFileSize)
        await this.downloadAll(uri, async (resource, url) => {
            if (expectedType !== resource.resourceType) {
                // In Epic we can get OperationOutcome if our search has no results. That is OK but log it just in case
                await this.options.logger.error('GET %s -> expected resource of type %j but got %j: %j', url, expectedType, resource.resourceType, resource)
            } else {
                await appendToNdjson(resource, path)
                onResource && await onResource(resource)
            }
            await wait(0)
        });
    }
}
