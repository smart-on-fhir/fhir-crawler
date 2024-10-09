import Path             from "path"
import { format }       from "util"
import { Command }      from "commander"
import { existsSync, statSync } from "fs"
import { writeFile, mkdir } from "fs/promises"
import clc              from "cli-color"
import pkg              from "../package.json"
import BulkDataClient   from "./BulkDataClient"
import FhirClient       from "./FhirClient"
import { Config }       from "./types"
import Logger           from "./Logger"
import humanizeDuration from "humanize-duration"
import {
    ndjsonEntries,
    print,
    readLine,
    sweep
} from "./utils"


const program = new Command();
program.name("node .")
program.version(pkg.version)
program.option("-p, --path [path]", "Path to directory containing the config file")
program.option(
    "--patients [paths...]",
    "Path to an NDJSON file with Patients or a text file with Patient IDs. " +
    "If passed, the bulk data part of the export will be skipped and " +
    "these patients will be used instead. " +
    "Can be specified multiple times for multiple patient files. " +
    "Paths should be relative to the input directory.",
    []
)

function getInputDirectory(arg = ""): string {
    const cwd = process.cwd()

    let inputDir = cwd

    if (arg) {
        inputDir = Path.resolve(cwd, arg)
        const stat = statSync(inputDir, { throwIfNoEntry: false })
        if (stat && !stat.isDirectory()) {
            console.log(
                `The provided path "${arg}" resolves to "${inputDir}" which ` +
                `is not a directory!\n`
            )
            program.help()
            process.exit(1)
        }
    }

    return inputDir
}

async function loadConfig(configDir: string): Promise<Config> {

    let configFilePath = Path.join(configDir, "config.js");
    const stat = statSync(configFilePath, { throwIfNoEntry: false })
    if (!stat || !stat.isFile()) {
        console.log(
            `No "config.js" file found in the input directory. Please create ` +
            `one or specify a custom path using the "-p" parameter.\n`
        )
        program.help()
        process.exit(1)
    }

    configFilePath = require.resolve(configFilePath);
    delete require.cache[configFilePath];
    const config = require(configFilePath);

    config.destination = Path.join(configDir, "output")
    
    if (!existsSync(config.destination)) {
        await mkdir(config.destination)
    } else {
        sweep(config.destination)
    }

    return config
}

/**
 Parses either an ndjson/jsonl file or a basic text file, and returns the Patient IDs found.
 * @param path The path to the file to read
 */
function *readPatientIdsFromFile(path: string): IterableIterator<string> {

    if (path.endsWith(".ndjson") || path.endsWith(".jsonl")) {
        for (const patient of ndjsonEntries(path)) {
            if (!patient || typeof patient !== "object" || patient.resourceType !== "Patient") {
                // istanbul ignore next
                throw new Error(format(`A non-patient entry found in the Patient ndjson file: %o`, patient))
            }
            yield patient.id;
        }
    }
    else {
        const lines = readLine(path);
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed)
                yield trimmed;
        }
    }
}

async function main(args: Record<string, any>) {

    const inputDir = getInputDirectory(args.path)
    const config   = await loadConfig(inputDir)
    const logger   = new Logger(config.destination)

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
        requestTimeout  : config.requestTimeout ?? 60000,
        destination     : config.destination,
        manualRetry     : !!config.manualRetry,
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
        requestTimeout  : config.requestTimeout ?? 60000,
        manualRetry     : !!config.manualRetry,
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

    let files: string[] = [];

    // Use existing patients ---------------------------------------------------
    if (args.patients?.length) {
        files = args.patients.map((p: string) => {
            const fullPath = Path.join(inputDir, p)
            const stat = statSync(fullPath, { throwIfNoEntry: false })
            if (!stat || !stat.isFile()) {
                throw new Error(`File "${fullPath}" does not exist.`)
            }
            return fullPath
        })
    }
    
    // Download patients -------------------------------------------------------
    else {
        print("Exporting patients")
        const statusLoc = await bulkClient.kickOff()
        print("Waiting for patients export...")
        let progressChecks = 0
        const manifest = await bulkClient.waitForExport(statusLoc, status => print(`Waiting for patients export: ${status} (${++progressChecks})`))
        await writeFile(Path.join(config.destination, "manifest.json"), JSON.stringify(manifest, null, 4), "utf8")
        print("Downloading patients")
        files = await bulkClient.download(manifest, config.destination)
    }

    // Wrap download URLs in a generator function so that we can just pull the
    // next available url (if any) whenever we are ready to download it
    const downloadUrls = (function*() {
        for (const loc of files) {
            for (const patientId of readPatientIdsFromFile(loc)) {
                counts.Patient++
                counts["Total FHIR Resources"]++
                for (const resourceType of Object.keys(config.resources)) {
                    const query = config.resources[resourceType].replace("#{patientId}", patientId)
                    yield `${resourceType}${query}`
                }
            }
        }
    })();

    // Update the stats in the terminal whenever a resource is downloaded 
    async function onResourceDownloaded(res: fhir4.Resource) {
        counts[res.resourceType] = (counts[res.resourceType] || 0) + 1
        counts["Total FHIR Resources"]++
        counts["Total FHIR Requests"] = bulkClient.requestsCount + fhirClient.requestsCount
        printState()
    }

    async function printState() {
        const duration = (Date.now() - start)
        const lines = Object.keys(counts).map(x => `${clc.bold(x)}: ${clc.cyan(Number(counts[x]).toLocaleString())}`)
        lines.push(clc.bold("Duration: ") + clc.cyan(humanizeDuration(duration)))
        const minutes = duration / 60000
        lines.push(clc.bold("Throughput: ") + clc.cyan(Math.round(counts["Total FHIR Resources"]/minutes * 100) / 100 + " resources per minute"))
        print(lines)
    }

    // Start the first `config.parallel` requests in parallel. Then, while there
    // are other URLs remaining, whenever a request is completed pull the next
    // one from the queue
    async function downloadAll() {
        const p = Math.max(config.parallel || 1, 1)
        const tasks: string[] = []
        let item: IteratorResult<string>
        do {
            item = downloadUrls.next()
            item.value && tasks.push(item.value)
        } while (!item.done && tasks.length < p)

        async function download(url: string) {
            await fhirClient.downloadResource(url, onResourceDownloaded).catch(async e => {
                counts["Total FHIR Requests"]++
                printState()
                await logger.error(e)
            })
            if (!item.done) {
                item = downloadUrls.next()
                item.value && await download(item.value)
            }
        }
        
        await Promise.all(tasks.map(url => download(url)))
        print.commit()
    }

    await downloadAll()
}

program.action(main)

// istanbul ignore next - Only start if not imported
if (require.main?.filename === __filename) {
    program.parseAsync(process.argv).catch(async error => {
        if (error.name === 'AbortError') {
            console.log(clc.bold('Request was aborted'));
        } else {
            console.log(clc.red(error.stack))
        }
        process.exit(1)
    });
}

export default main;
