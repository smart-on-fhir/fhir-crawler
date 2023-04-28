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
     * Downloaded files are named as `<prefix>.<ResourceType>.ndjson` where
     * <prefix> start from `1`. While the file size is less then this, new lines
     * will be appended to it. Once that size is reached another fille will be
     * created with incremented <prefix> and the lines will be appending to it.
     */
    maxFileSize: number

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

interface ClientConfigCommon {
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
}

interface ClientConfigWithJWK extends ClientConfigCommon {
    /**
     * The private key as KWK (not JWKS!)
     */
    privateJWK?: Record<string, any>
}

interface ClientConfigWithSecret extends ClientConfigCommon {
    /**
     * Client Secret
     */
    clientSecret?: string
}

/**
 * Clients can authenticate using either Backend Services or Basic Auth
 */
export type ClientConfig = ClientConfigWithJWK | ClientConfigWithSecret

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