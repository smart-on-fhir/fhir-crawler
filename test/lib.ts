import { join }   from "path"
import { spawn }  from "child_process"
import MockServer from "./MockServer"
import {
    ClientConfig,
    Config
} from "../src/types"
import {
    existsSync,
    readdirSync,
    rmSync,
    writeFileSync,
    statSync
} from "fs"




export const mockServer = new MockServer("Mock Server", true)

export const DEFAULT_CONFIG = {
    groupId        : "group-id",
    destination    : "./test/tmp",
    poolInterval   : 10,
    minPoolInterval: 10,
    maxPoolInterval: 200,
    throttle       : 0,
    maxFileSize: 1024 * 1024 * 1024, // 1 GB
    retryStatusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
    retryDelay: 1000,
    retryLimit: 5,
    bulkClient: {
        clientId: "bulkClientId",
        baseUrl: "",
        tokenEndpoint: "",
        privateJWKorSecret: "secret"
    },
    fhirClient: {
        clientId: "fhirClientId",
        baseUrl: "",
        tokenEndpoint: "",
        privateJWKorSecret: "secret"
    },
    resources: {
        // Encounter        : `?patient=#{patientId}&date=gt2018-01-01T05:00:00.000Z`,
        // Condition        : `?patient=#{patientId}`,
        // DocumentReference: `?patient=#{patientId}&date=gt2018-01-01T05:00:00.000Z&category=clinical-note`,
        // MedicationRequest: `?patient=#{patientId}`,
        // Observation      : `?patient=#{patientId}&date=gt2018-01-01T05:00:00.000Z&category=laboratory,vital-signs,social-history`,
    }
};

before(async () => {
    await mockServer.start()
    DEFAULT_CONFIG.bulkClient.baseUrl       = mockServer.baseUrl + "/fhir"
    DEFAULT_CONFIG.bulkClient.tokenEndpoint = mockServer.baseUrl + "/auth/token"
    DEFAULT_CONFIG.fhirClient.baseUrl       = mockServer.baseUrl + "/fhir"
    DEFAULT_CONFIG.fhirClient.tokenEndpoint = mockServer.baseUrl + "/auth/token"
});

after(async () => {
    await mockServer.stop();
});

afterEach(async () => {
    mockServer.clear();
})

export function isFile(path: string) {
    return statSync(path).isFile()
}

export function emptyFolder(path: string) {
    if (existsSync(path)) {
        readdirSync(path, { withFileTypes: true }).forEach(entry => {
            if (entry.name !== ".gitkeep" && entry.isFile()) {
                rmSync(join(path, entry.name))
            }
        })
    }
}

interface InvokeOptions extends Partial<Omit<Config, "fhirClient" | "bulkClient">> {
    fhirClient?: Partial<ClientConfig>
    bulkClient?: Partial<ClientConfig>
}

/**
 * Invokes the client and replies with a promise that will resolve when the
 * download is complete
 */
export async function invoke({
    options = {},
    timeout = 30000
}: {
    /**
     * Any custom options to pass
     */
    options?: InvokeOptions
    
    /**
     * Timeout in milliseconds. Defaults to `30000`.
     */
    timeout?: number,
} = {}): Promise<{
    exitCode: number | null
    signal: NodeJS.Signals | null
}>
{
    return new Promise((resolve, reject) => {

        const fullOptions = {
            ...DEFAULT_CONFIG,
            ...options,
            bulkClient: {
                ...DEFAULT_CONFIG.bulkClient,
                ...options.bulkClient
            },
            fhirClient: {
                ...DEFAULT_CONFIG.fhirClient,
                ...options.fhirClient
            },
            destination: "./test/tmp"
        };

        const configPath  = "./test/tmp/config.ts"

        writeFileSync(configPath,  "export default " + JSON.stringify(fullOptions, null, 4), "utf8")
        
        const client = spawn("ts-node", [ "./src/index.ts", "-c", configPath ], {
            cwd: join(__dirname, ".."),
            timeout,
            stdio: "pipe"
        })

        const errors: string[] = [];

        client.stderr.on("data", data => {
            errors.push(data.toString("utf8"))
        })

        client.on("exit", (code, signal) => {
            if (!code) {
                resolve({ exitCode: code, signal })
            } else {
                reject(new Error(errors.join("\n") || `Child process exited with code ${code} and signal ${signal}`))
            }
        });
    })
}
