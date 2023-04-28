import { Config } from "../src/types"

/**
 * FHIR Date parameter to be used in the query strings below.
 */
const SINCE = "2018-01-01T05:00:00.000Z"

/**
 * Client settings for Bulk Data export
 */
const bulkClient = {
    baseUrl      : "BULK DATA SERVER BASE URL",
    clientId     : "BULK DATA CLIENT ID",
    tokenEndpoint: "BULK DATA AUTH SERVER TOKEN URL", // Can be found in the CapabilityStatement
    privateJWK   : { /* PRIVATE KEY AS JWK */ },
    clientSecret : "SECRET FOR BASIC AUTH" // Remove/comment privateJWK if you use this
}

/**
 * Client settings for FHIR API calls.
 * NOTE: In Cerner this must be a separate client. In Epic it can be the same
 * (although it can also be separate). To reuse the same client you can repeat
 * the same settings or just do:
 * ```
 * const fhirClient = bulkClient;
 * ```
 */
const fhirClient = {
    baseUrl      : "FHIR SERVER BASE URL",
    clientId     : "FHIR CLIENT ID",
    tokenEndpoint: "AUTH SERVER TOKEN URL", // Can be found in the CapabilityStatement
    privateJWK   : { /* PRIVATE KEY AS JWK */ },
    clientSecret : "SECRET FOR BASIC AUTH" // Remove/comment privateJWK if you use this
}

const config: Config = {
    /**
     * BulkData Group ID
     */
    groupId: "BULK GROUP ID",
    
    /**
     * Path to destination folder for ndjson downloads and logs. Can be absolute
     * or relative to CWD
     */
    destination : "PATH TO DOWNLOADS FOLDER",

    /**
     * Delay in milliseconds between HTTP requests (in case you need to reduce
     * the load on the server)
     */
    throttle: 0,

    /**
     * While we are waiting for the bulk export the server might send back a
     * "retry-after" header. If so, we will try to respect that within a
     * reasonable boundaries. Otherwise, the `poolInterval` option will be used
     * to suggest after what delay to check again.
     * NOTE: The value is in milliseconds.
     */
    poolInterval: 5 * 60 * 1000, // 5 min

    /**
     * Downloaded files are named as `<prefix>.<ResourceType>.ndjson` where
     * <prefix> start from `1`. While the file size is less then this, new lines
     * will be appended to it. Once that size is reached another fille will be
     * created with incremented <prefix> and the lines will be appending to it.
     */
    maxFileSize : 1024 * 1024 * 100, // ~ 1 GB

    /**
     * Client settings for Bulk Data export
     */
    bulkClient,

    /**
     * Client settings for FHIR API calls
     */
    fhirClient,

    /**
     * Map of resource types we want to download and their corresponding query
     * string.
     * NOTE: #{patientId} will be replaced with the current patient ID
     */
    resources: {
        Encounter        : `?patient=#{patientId}&date=gt${SINCE}`,
        Condition        : `?patient=#{patientId}`,
        DocumentReference: `?patient=#{patientId}&date=gt${SINCE}&category=clinical-note`,
        MedicationRequest: `?patient=#{patientId}`,
        Observation      : `?patient=#{patientId}&date=gt${SINCE}&category=laboratory,vital-signs,social-history`,
    }
}

export default config
