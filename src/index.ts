import Path           from "path"
import { format }     from "util"
import { Command }    from "commander"
import { writeFile }  from "fs/promises"
import pkg            from "../package.json"
import BulkDataClient from "./BulkDataClient"
import FhirClient     from "./FhirClient"
import { Config }     from "./types"
import Logger         from "./Logger"
import {
    formatDuration,
    ndjsonEntries,
    print,
    sweep
} from "./utils"


const program = new Command();
program.name("node .")
program.version(pkg.version)
program.option("-c, --config [path]", "Path to JS config file")

program.action(async args => {
    
    if (!args.config) {
        console.log(`Please provide the path to your config file as "-c" or "--config" option!\n`)
        return program.help()
    }

    const configPath = Path.resolve(process.cwd(), args.config)
    const config: Config = require(configPath).default

    sweep(config.destination)

    const logger = new Logger(config.destination)
    logger.clearErrors()
    logger.clearRequests()

    const bulkClient = new BulkDataClient({
        ...config.bulkClient,
        groupId         : config.groupId,
        retryAfterMSec  : config.poolInterval,
        resources       : Object.keys(config.resources),
        maxFileSize     : config.maxFileSize,
        minPoolInterval : config.minPoolInterval,
        maxPoolInterval : config.maxPoolInterval,
        retryLimit      : config.retryLimit,
        retryDelay      : config.retryDelay,
        retryStatusCodes: config.retryStatusCodes,
        logger
    })

    const fhirClient = new FhirClient({
        ...config.fhirClient,
        resources       : Object.keys(config.resources),
        destination     : config.destination,
        throttle        : config.throttle,
        maxFileSize     : config.maxFileSize,
        retryLimit      : config.retryLimit,
        retryDelay      : config.retryDelay,
        retryStatusCodes: config.retryStatusCodes,
        logger
    })

    const start = Date.now()

    const counts: Record<string, number> = {
        Patient: 0,
        "Total FHIR Resources": 0
    }
    for (const resourceType in config.resources) {
        counts[resourceType] = 0
    }
        
    // Download Patients -------------------------------------------------------
    print("Exporting patients")
    const statusLoc = await bulkClient.kickOff()
    print("Waiting for patients export...")
    let progressChecks = 0
    const manifest = await bulkClient.waitForExport(statusLoc, status => print(`Waiting for patients export: ${status} (${++progressChecks})`))
    await writeFile(Path.join(config.destination, "manifest.json"), JSON.stringify(manifest, null, 4), "utf8")
    print("Downloading patients")
    const files = await bulkClient.download(manifest, config.destination)
    // const files = [Path.join(__dirname, "Epic.Patient.ndjson")];

    // Download Patient data ---------------------------------------------------
    for (const loc of files) {    
        for (const patient of ndjsonEntries(loc)) {
            if (!patient || typeof patient !== "object" || patient.resourceType !== "Patient") {
                throw new Error(format(`A non-patient entry found in the Patient ndjson file: %o`, patient))
            }
            counts.Patient++
            counts["Total FHIR Resources"]++
            for (const resourceType of Object.keys(config.resources)) {
                const query = config.resources[resourceType].replace("#{patientId}", patient.id)
                await fhirClient.downloadResource(`${resourceType}${query}`, async (res) => {
                    counts[res.resourceType] = (counts[res.resourceType] || 0) + 1
                    counts["Total FHIR Resources"]++
                    counts["Total FHIR Requests"] = bulkClient.requestsCount + fhirClient.requestsCount
                    const lines = Object.keys(counts).map(x => `${x}: ${Number(counts[x]).toLocaleString()}`)
                    lines.push("Duration: " + formatDuration(Date.now() - start))
                    print(lines)
                })
            }
        }
        print.commit()
    }
})

program.parseAsync(process.argv).catch(e => {
    console.error(e.stack)
    process.exit(1)
});
