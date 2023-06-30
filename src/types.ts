export interface Config {
    
    /**
     * BulkData Group ID
     */
    groupId: string
    
    /**
     * Path to destination folder for ndjson downloads and logs. Can be absolute
     * or relative to CWD
     */
    destination: string

    /**
     * Delay in milliseconds between HTTP requests (in case you need to reduce
     * the load on the server)
     */
    throttle: number

    /**
     * While we are waiting for the bulk export the server might send back a
     * "retry-after" header. If so, we will try to respect that within a
     * reasonable boundaries. Otherwise, the `poolInterval` option will be used
     * to suggest after what delay to check again.
     * NOTE: The value is in milliseconds.
     */
    poolInterval: number

    /**
     * Don't allow the bulk status pool interval to be smaller than this. This
     * can be useful when you want to "correct" the retry-after delay
     * recommended by the server.
     * NOTE: The value is in milliseconds and must be <= `poolInterval`.
     */
    minPoolInterval: number

    /**
     * Don't allow the bulk status pool interval to be bigger than this. This
     * can be useful when you want to "correct" the retry-after delay
     * recommended by the server.
     * NOTE: The value is in milliseconds and must be >= `poolInterval`.
     */
    maxPoolInterval: number

    /**
     * Downloaded files are named as `<prefix>.<ResourceType>.ndjson` where
     * <prefix> start from `1`. While the file size is less then this, new lines
     * will be appended to it. Once that size is reached another fille will be
     * created with incremented <prefix> and the lines will be appending to it.
     */
    maxFileSize: number

    /**
     * Retried failed requests if they returned one of these status codes.
     * NOTE: Only failed requests are retried.
     */
    retryStatusCodes: number[]
    
    /**
     * Wait this many milliseconds before retrying a failed request
     */
    retryDelay: number

    /**
     * How many times to retry failed requests. Set to 0 to disable retrying.
     */
    retryLimit: number

    /**
     * - `1` (or less) means serial downloads
     * - `>1` means that there is one download process for each resourceType other
     * than Patient, but not more than this number.
     * For example (if this is set to 10):
     * 1. If you are downloading 5 resource types, setting this to 10 is the
     * same as setting it to 5.
     * 2. If you are downloading 50 resource types the first 10 will be started
     * immediately and work in parallel and the rest will start whenever a
     * worker becomes available.
     */
    parallel: number,

    /**
     * Map of resource types we want to download and their corresponding query
     * string.
     * NOTE: #{patientId} will be replaced with the current patient ID
     */
    resources: {
        [resourceType: string]: string
    }
    
    /**
     * Client settings for FHIR API calls.
     * NOTE: In Cerner this must be a separate client. In Epic it can be the
     * same (although it can also be separate).
     */
    fhirClient: ClientConfig

    /**
     * Client settings for Bulk Data export
     */
    bulkClient: ClientConfig
}

export interface ClientConfig {
    /**
     * Registered client ID
     */
    clientId: string
    
    /**
     * The base URL of the FHIR server
     */
    baseUrl: string
    
    /**
     * Token URL (Can be found in the CapabilityStatement)
     */
    tokenEndpoint: string

    /**
     * - If this is a string it should be your Client Secret and the client will 
     *   use basic auth.
     * - Otherwise this must be your private key as JWK object and the client
     *   will use Backend Services auth
     */
    privateJWKorSecret: Record<string, any> | string
}


export interface ExportManifest {
    transactionTime: string // FHIR instant
    request: string
    requiresAccessToken: boolean
    output: ExportManifestFile[]
    error: ExportManifestFile<"OperationOutcome">[]
    deleted?: ExportManifestFile<"Bundle">[]
    extension?: Record<string, any>
}

export interface ExportManifestFile<Type = string> {
    type: Type
    url: string 
    count?: number
}